import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as cloudtrail from 'aws-cdk-lib/aws-cloudtrail';
import * as ses from 'aws-cdk-lib/aws-ses';

interface DebriefDataStackProps extends cdk.StackProps {
  /**
   * App Runner service URL (https://...). Optional — when known, it is added
   * to the recordings-bucket CORS allow-list so the production web app can
   * issue presigned uploads/downloads. Localhost dev origins are always
   * included.
   */
  appRunnerUrl?: string;
}

/**
 * Debrief data-layer stack.
 *
 * Contains all persistent / stateful resources. These are RETAINED on stack
 * deletion because they hold PHI. Prototype cleanup: during active development
 * you can flip RemovalPolicy to DESTROY + autoDeleteObjects on buckets, but
 * NEVER in prod. Every resource lives in ca-central-1.
 */
export class DebriefDataStack extends cdk.Stack {
  public readonly kmsKey: kms.Key;
  public readonly vpc: ec2.Vpc;
  public readonly database: rds.DatabaseInstance;
  public readonly dbSecurityGroup: ec2.SecurityGroup;
  public readonly recordingsBucket: s3.Bucket;
  public readonly logsBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: DebriefDataStackProps) {
    super(scope, id, props);

    // --------------------------------------------------------------------
    // 1. KMS key — customer-managed, used for every encrypted resource.
    // --------------------------------------------------------------------
    this.kmsKey = new kms.Key(this, 'PhiKey', {
      alias: 'alias/debrief-phi',
      description: 'Customer-managed key for Debrief PHI (RDS, S3, SQS, Secrets)',
      enableKeyRotation: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // --------------------------------------------------------------------
    // 2. VPC — 2 AZs (RDS requirement), 1 NAT gateway (cost optimization).
    //    Public subnets for NAT + future ALB. Private (with egress) for RDS
    //    and Lambda/App Runner VPC connectors.
    // --------------------------------------------------------------------
    this.vpc = new ec2.Vpc(this, 'DebriefVpc', {
      vpcName: 'debrief-vpc',
      maxAzs: 2,
      natGateways: 1, // single-AZ NAT — prototype cost optimization
      subnetConfiguration: [
        {
          name: 'public',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
        {
          name: 'private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 24,
        },
        {
          name: 'isolated',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          cidrMask: 24,
        },
      ],
    });

    // VPC flow logs → CloudWatch (1 month retention for prototype budget).
    const flowLogGroup = new logs.LogGroup(this, 'VpcFlowLogs', {
      logGroupName: '/aws/vpc/debrief-flowlogs',
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    new ec2.FlowLog(this, 'VpcFlowLog', {
      resourceType: ec2.FlowLogResourceType.fromVpc(this.vpc),
      destination: ec2.FlowLogDestination.toCloudWatchLogs(flowLogGroup),
      trafficType: ec2.FlowLogTrafficType.ALL,
    });

    // --------------------------------------------------------------------
    // 2b. VPC endpoints — keep PHI-adjacent traffic on the AWS backbone
    //     instead of egressing through the NAT gateway to the public
    //     internet. S3 is a (free) gateway endpoint; the others are
    //     interface endpoints (ENI per AZ + hourly cost). All scoped to
    //     the private-with-egress subnets where Lambda + App Runner live.
    // --------------------------------------------------------------------
    const vpcEndpointSg = new ec2.SecurityGroup(this, 'VpcEndpointSg', {
      vpc: this.vpc,
      description: 'Debrief VPC interface endpoints — 443 from inside VPC only',
      allowAllOutbound: false,
    });
    vpcEndpointSg.addIngressRule(
      ec2.Peer.ipv4(this.vpc.vpcCidrBlock),
      ec2.Port.tcp(443),
      'HTTPS from inside the VPC',
    );

    this.vpc.addGatewayEndpoint('S3Endpoint', {
      service: ec2.GatewayVpcEndpointAwsService.S3,
      // Gateway endpoints attach to route tables, not subnets. Default
      // selection covers all private subnets, which is what we want.
    });

    const interfaceEndpointSubnets: ec2.SubnetSelection = {
      subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
    };

    this.vpc.addInterfaceEndpoint('SecretsEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER,
      privateDnsEnabled: true,
      subnets: interfaceEndpointSubnets,
      securityGroups: [vpcEndpointSg],
    });
    this.vpc.addInterfaceEndpoint('KmsEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.KMS,
      privateDnsEnabled: true,
      subnets: interfaceEndpointSubnets,
      securityGroups: [vpcEndpointSg],
    });
    this.vpc.addInterfaceEndpoint('SqsEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.SQS,
      privateDnsEnabled: true,
      subnets: interfaceEndpointSubnets,
      securityGroups: [vpcEndpointSg],
    });
    this.vpc.addInterfaceEndpoint('StsEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.STS,
      privateDnsEnabled: true,
      subnets: interfaceEndpointSubnets,
      securityGroups: [vpcEndpointSg],
    });

    // --------------------------------------------------------------------
    // 3. RDS PostgreSQL 16.
    // --------------------------------------------------------------------
    // Security group for the DB. We create it explicitly (rather than letting
    // CDK create a default) so the compute stack can import it by ID and add
    // ingress from Lambda/App Runner security groups.
    this.dbSecurityGroup = new ec2.SecurityGroup(this, 'DbSecurityGroup', {
      vpc: this.vpc,
      description: 'Debrief RDS — ingress from compute SGs only',
      allowAllOutbound: false,
    });

    // Parameter group: force SSL, enable pg_cron (required for the stuck-
    // session sweeper we're porting from Supabase).
    const paramGroup = new rds.ParameterGroup(this, 'DbParams', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_16_4,
      }),
      description: 'Debrief PG16 params — force_ssl + pg_cron',
      parameters: {
        'rds.force_ssl': '1',
        // pg_cron has to be preloaded via shared_preload_libraries.
        shared_preload_libraries: 'pg_cron',
        // pg_cron defaults to the postgres DB; leave default.
      },
    });

    this.database = new rds.DatabaseInstance(this, 'DebriefDb', {
      instanceIdentifier: 'debrief-db',
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_16_4,
      }),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.MICRO),
      vpc: this.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [this.dbSecurityGroup],
      publiclyAccessible: false,
      multiAz: false, // prototype — bump for prod
      allocatedStorage: 20,
      storageType: rds.StorageType.GP3,
      storageEncrypted: true,
      storageEncryptionKey: this.kmsKey,
      credentials: rds.Credentials.fromGeneratedSecret('debrief_admin', {
        secretName: 'debrief/rds/master',
        encryptionKey: this.kmsKey,
      }),
      backupRetention: cdk.Duration.days(7),
      deleteAutomatedBackups: false,
      copyTagsToSnapshot: true,
      deletionProtection: true, // PHI — do not disable in prod
      parameterGroup: paramGroup,
      cloudwatchLogsExports: ['postgresql'],
      cloudwatchLogsRetention: logs.RetentionDays.ONE_MONTH,
      enablePerformanceInsights: false, // prototype — cost
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      // prototype cleanup: set RemovalPolicy.SNAPSHOT during active dev if
      // you want to tear down. NEVER DESTROY on prod PHI.
    });

    // --------------------------------------------------------------------
    // 4. S3 logs bucket (must exist before recordings bucket references it).
    // --------------------------------------------------------------------
    this.logsBucket = new s3.Bucket(this, 'LogsBucket', {
      bucketName: `debrief-logs-${this.account}-${this.region}`,
      encryption: s3.BucketEncryption.S3_MANAGED, // CloudTrail + S3 logs; KMS adds perms friction
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      versioned: true,
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_PREFERRED,
      lifecycleRules: [
        {
          id: 'expire-old-logs',
          enabled: true,
          expiration: cdk.Duration.days(365),
          noncurrentVersionExpiration: cdk.Duration.days(90),
        },
      ],
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // --------------------------------------------------------------------
    // 5. S3 recordings bucket — holds audio + transcripts (PHI).
    // --------------------------------------------------------------------
    this.recordingsBucket = new s3.Bucket(this, 'RecordingsBucket', {
      bucketName: `debrief-recordings-${this.account}-${this.region}`,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: this.kmsKey,
      bucketKeyEnabled: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      versioned: true,
      serverAccessLogsBucket: this.logsBucket,
      serverAccessLogsPrefix: 'recordings-access/',
      // CORS — explicit allow-list. Wildcard origin is refused; the App
      // Runner production URL can be injected via stack props once known.
      cors: [
        {
          allowedOrigins: [
            'http://localhost:3000',
            'http://localhost:6969',
            'https://med-student-feedback-scribe.dev',
            ...(props?.appRunnerUrl ? [props.appRunnerUrl] : []),
          ],
          allowedMethods: [
            s3.HttpMethods.PUT,
            s3.HttpMethods.GET,
            s3.HttpMethods.HEAD,
          ],
          allowedHeaders: ['*'],
          exposedHeaders: ['ETag'],
          maxAge: 3000,
        },
      ],
      lifecycleRules: [
        {
          id: 'abort-incomplete-multipart',
          enabled: true,
          abortIncompleteMultipartUploadAfter: cdk.Duration.days(7),
        },
      ],
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      // prototype cleanup: set DESTROY + autoDeleteObjects: true during active
      // dev if needed, NEVER in prod.
    });

    // --------------------------------------------------------------------
    // 6. CloudTrail — multi-region trail, log file validation on.
    // --------------------------------------------------------------------
    new cloudtrail.Trail(this, 'Trail', {
      trailName: 'debrief-trail',
      bucket: this.logsBucket,
      s3KeyPrefix: 'cloudtrail/',
      isMultiRegionTrail: true,
      includeGlobalServiceEvents: true,
      enableFileValidation: true,
      sendToCloudWatchLogs: true,
      cloudWatchLogsRetention: logs.RetentionDays.ONE_MONTH,
    });

    // --------------------------------------------------------------------
    // 7. SES domain identity — med-student-feedback-scribe.dev.
    //    DKIM tokens + SPF/DMARC hints emitted as outputs for manual DNS.
    // --------------------------------------------------------------------
    const sesDomain = 'med-student-feedback-scribe.dev';
    const emailIdentity = new ses.EmailIdentity(this, 'SesDomainIdentity', {
      identity: ses.Identity.domain(sesDomain),
      // EasyDKIM is enabled by default in L2 construct; it generates 3 CNAME tokens.
    });

    // The L2 construct exposes dkimDnsTokenName1/2/3 + dkimDnsTokenValue1/2/3.
    new cdk.CfnOutput(this, 'SesDomain', {
      value: sesDomain,
      description: 'SES domain identity — add these DNS records to the zone',
    });
    new cdk.CfnOutput(this, 'SesDkim1Name', { value: emailIdentity.dkimDnsTokenName1 });
    new cdk.CfnOutput(this, 'SesDkim1Value', { value: emailIdentity.dkimDnsTokenValue1 });
    new cdk.CfnOutput(this, 'SesDkim2Name', { value: emailIdentity.dkimDnsTokenName2 });
    new cdk.CfnOutput(this, 'SesDkim2Value', { value: emailIdentity.dkimDnsTokenValue2 });
    new cdk.CfnOutput(this, 'SesDkim3Name', { value: emailIdentity.dkimDnsTokenName3 });
    new cdk.CfnOutput(this, 'SesDkim3Value', { value: emailIdentity.dkimDnsTokenValue3 });
    new cdk.CfnOutput(this, 'SesSpfHint', {
      value: `${sesDomain} TXT "v=spf1 include:amazonses.com ~all"`,
      description: 'Manual SPF record to add (TXT)',
    });
    new cdk.CfnOutput(this, 'SesDmarcHint', {
      value: `_dmarc.${sesDomain} TXT "v=DMARC1; p=quarantine; rua=mailto:dmarc@med-student-feedback-scribe.dev"`,
      description: 'Manual DMARC record to add (TXT)',
    });

    // --------------------------------------------------------------------
    // 8. Stack outputs — consumed by the compute stack (via prop ref) and
    //    by humans running `cdk deploy`.
    // --------------------------------------------------------------------
    new cdk.CfnOutput(this, 'KmsKeyArn', {
      value: this.kmsKey.keyArn,
      exportName: 'Debrief-KmsKeyArn',
    });
    new cdk.CfnOutput(this, 'VpcId', {
      value: this.vpc.vpcId,
      exportName: 'Debrief-VpcId',
    });
    new cdk.CfnOutput(this, 'RdsEndpoint', {
      value: this.database.dbInstanceEndpointAddress,
      exportName: 'Debrief-RdsEndpoint',
    });
    new cdk.CfnOutput(this, 'RdsSecretArn', {
      value: this.database.secret!.secretArn,
      exportName: 'Debrief-RdsSecretArn',
    });
    new cdk.CfnOutput(this, 'RdsSecurityGroupId', {
      value: this.dbSecurityGroup.securityGroupId,
      exportName: 'Debrief-RdsSgId',
    });
    new cdk.CfnOutput(this, 'RecordingsBucketName', {
      value: this.recordingsBucket.bucketName,
      exportName: 'Debrief-RecordingsBucketName',
    });
    new cdk.CfnOutput(this, 'RecordingsBucketArn', {
      value: this.recordingsBucket.bucketArn,
      exportName: 'Debrief-RecordingsBucketArn',
    });
    new cdk.CfnOutput(this, 'LogsBucketName', {
      value: this.logsBucket.bucketName,
      exportName: 'Debrief-LogsBucketName',
    });
  }
}
