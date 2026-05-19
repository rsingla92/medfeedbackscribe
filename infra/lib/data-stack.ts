import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as ses from 'aws-cdk-lib/aws-ses';

const SES_DOMAIN = 'debriefmd.ca';
const APP_HOSTNAME = `app.${SES_DOMAIN}`;

/**
 * Debrief data-layer stack — Plan B (minimal-cost variant).
 *
 * Persistent / stateful resources. RETAINED on stack deletion because they
 * hold PHI. Every resource lives in ca-central-1.
 *
 * Plan B simplifications vs the original PHIPA-hardened design:
 *   - VPC: 2 AZs, public + private-with-egress subnets only. No
 *     PRIVATE_ISOLATED (saved ~$0; just simplifies subnet count). Single
 *     NAT gateway (~$32/mo) is RETAINED — required so the pipeline Lambda
 *     can reach Vertex AI in Montreal without exposing RDS to the public
 *     internet.
 *   - RDS lives in private-with-egress subnets, NOT publicly addressable.
 *     SG ingress is restricted to the Fargate task SG + Lambda SG (rules
 *     added in the compute stack).
 *   - No interface VPC endpoints (~$28/mo saved). Compute reaches AWS
 *     services (Secrets Manager, KMS, SQS, STS) over the internet via NAT.
 *     Traffic stays inside the AWS network despite traversing the NAT.
 *     The free S3 gateway endpoint is kept since it has no fixed cost.
 *   - No CloudTrail trail or dedicated logs bucket — defer until we have
 *     real traffic worth auditing. AWS account-level CloudTrail history
 *     (90 days, free) still covers basic forensic needs.
 *
 * Hardening path when going to production traffic: re-add interface VPC
 * endpoints, CloudTrail with custom retention, move RDS to PRIVATE_ISOLATED,
 * add multi-AZ on RDS. All additive; the compute stack contract (SG
 * identifiers, KMS key, secret ARN) does not change.
 */
export class DebriefDataStack extends cdk.Stack {
  public readonly kmsKey: kms.Key;
  public readonly vpc: ec2.Vpc;
  public readonly database: rds.DatabaseInstance;
  public readonly dbSecurityGroup: ec2.SecurityGroup;
  public readonly recordingsBucket: s3.Bucket;
  public readonly pipelineQueue: sqs.Queue;
  public readonly pipelineDlq: sqs.Queue;
  public readonly sesDomain: string;
  public readonly sesFromEmail: string;
  public readonly appHostname: string;

  // Pin AZs explicitly so `ec2.Vpc` doesn't trigger an AWS account lookup
  // at synth time. The lookup requires CDK-bootstrap roles to exist in the
  // target account, which fails until first deploy.
  get availabilityZones(): string[] {
    return ['ca-central-1a', 'ca-central-1b'];
  }

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.sesDomain = SES_DOMAIN;
    this.sesFromEmail = `noreply@${SES_DOMAIN}`;
    this.appHostname = APP_HOSTNAME;

    // ────────────────────────────────────────────────────────────────────
    // 1. KMS — customer-managed key used by every encrypted resource.
    // ────────────────────────────────────────────────────────────────────
    // Account-root admin policy on the key so cross-stack `grantDecrypt`
    // calls don't try to add specific principals to the key policy (which
    // would create cross-stack dependency cycles). IAM permissions on
    // consumers (Lambda role, Fargate task role, App role) gate access.
    this.kmsKey = new kms.Key(this, 'PhiKey', {
      alias: 'alias/debrief-phi',
      description: 'Customer-managed key for Debrief PHI (RDS, S3, SQS, Secrets, ECR)',
      enableKeyRotation: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      policy: new iam.PolicyDocument({
        statements: [
          new iam.PolicyStatement({
            sid: 'AllowAccountAdmin',
            effect: iam.Effect.ALLOW,
            principals: [new iam.AccountRootPrincipal()],
            actions: ['kms:*'],
            resources: ['*'],
          }),
        ],
      }),
    });

    // ────────────────────────────────────────────────────────────────────
    // 2. VPC — 2 AZs, single-AZ NAT (cost-optimized).
    //    Public subnets host the ALB and NAT gateway. Private-with-egress
    //    subnets host RDS, Fargate tasks, and the Lambda pipeline worker.
    //    Outbound internet traffic from compute (Vertex AI, ECR, Secrets
    //    Manager, etc.) flows through the single NAT gateway in AZ-A.
    // ────────────────────────────────────────────────────────────────────
    this.vpc = new ec2.Vpc(this, 'DebriefVpc', {
      vpcName: 'debrief-vpc',
      maxAzs: 2,
      natGateways: 1, // single-AZ NAT — primary cost lever vs Plan A's $32/mo × 2 AZ.
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
      ],
    });

    // VPC flow logs — cheap, useful for forensics. CloudWatch retention 1 mo.
    const flowLogGroup = new logs.LogGroup(this, 'VpcFlowLogs', {
      logGroupName: '/aws/vpc/debrief-flowlogs',
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    new ec2.FlowLog(this, 'VpcFlowLog', {
      resourceType: ec2.FlowLogResourceType.fromVpc(this.vpc),
      destination: ec2.FlowLogDestination.toCloudWatchLogs(flowLogGroup),
      trafficType: ec2.FlowLogTrafficType.REJECT, // only rejects — keeps log volume down
    });

    // Free S3 gateway endpoint — keeps S3 traffic from Fargate/Lambda on
    // the AWS backbone instead of going out to the internet and back in.
    // Costs nothing, so we keep it even in the minimal variant.
    this.vpc.addGatewayEndpoint('S3Endpoint', {
      service: ec2.GatewayVpcEndpointAwsService.S3,
    });

    // ────────────────────────────────────────────────────────────────────
    // 3. RDS PostgreSQL 16.
    //    Publicly addressable but locked down by SG. Compute stack adds
    //    ingress rules from Fargate + Lambda SGs.
    // ────────────────────────────────────────────────────────────────────
    this.dbSecurityGroup = new ec2.SecurityGroup(this, 'DbSecurityGroup', {
      vpc: this.vpc,
      description: 'Debrief RDS — ingress only from compute SGs',
      allowAllOutbound: false,
    });

    const paramGroup = new rds.ParameterGroup(this, 'DbParams', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_16_4,
      }),
      description: 'Debrief PG16 — force_ssl + pg_cron',
      parameters: {
        'rds.force_ssl': '1',
        shared_preload_libraries: 'pg_cron',
      },
    });

    this.database = new rds.DatabaseInstance(this, 'DebriefDb', {
      instanceIdentifier: 'debrief-db',
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_16_4,
      }),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.MICRO),
      vpc: this.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      publiclyAccessible: false,
      securityGroups: [this.dbSecurityGroup],
      multiAz: false,
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
      deletionProtection: true,
      parameterGroup: paramGroup,
      cloudwatchLogsExports: ['postgresql'],
      cloudwatchLogsRetention: logs.RetentionDays.ONE_MONTH,
      enablePerformanceInsights: false,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // ────────────────────────────────────────────────────────────────────
    // 4. S3 recordings bucket — audio + transcripts (PHI).
    //    KMS-encrypted, blocked from public access, CORS allow-list for
    //    presigned PUT/GET from the web app.
    // ────────────────────────────────────────────────────────────────────
    this.recordingsBucket = new s3.Bucket(this, 'RecordingsBucket', {
      bucketName: `debrief-recordings-${this.account}-${this.region}`,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: this.kmsKey,
      bucketKeyEnabled: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      versioned: true,
      cors: [
        {
          allowedOrigins: [
            'http://localhost:3000',
            'http://localhost:6969',
            `https://${APP_HOSTNAME}`,
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
    });

    // ────────────────────────────────────────────────────────────────────
    // 4b. SQS pipeline queue + DLQ + S3 event notification.
    //     Lives in the data stack (not compute) to avoid a cyclic stack
    //     reference: the bucket's notification config references the queue
    //     ARN, so they must live together. The compute-stack Lambda
    //     consumes from this queue, depends on this stack, no cycle.
    // ────────────────────────────────────────────────────────────────────
    this.pipelineDlq = new sqs.Queue(this, 'PipelineDlq', {
      queueName: 'debrief-pipeline-dlq',
      encryption: sqs.QueueEncryption.KMS,
      encryptionMasterKey: this.kmsKey,
      retentionPeriod: cdk.Duration.days(14),
      enforceSSL: true,
    });

    this.pipelineQueue = new sqs.Queue(this, 'PipelineQueue', {
      queueName: 'debrief-pipeline-queue',
      encryption: sqs.QueueEncryption.KMS,
      encryptionMasterKey: this.kmsKey,
      retentionPeriod: cdk.Duration.days(14),
      // Lambda pipeline runs up to 300s — visibility timeout must exceed it.
      visibilityTimeout: cdk.Duration.seconds(360),
      enforceSSL: true,
      deadLetterQueue: {
        queue: this.pipelineDlq,
        maxReceiveCount: 3,
      },
    });

    this.recordingsBucket.addEventNotification(
      cdk.aws_s3.EventType.OBJECT_CREATED_PUT,
      new s3n.SqsDestination(this.pipelineQueue),
    );

    // ────────────────────────────────────────────────────────────────────
    // 5. SES domain identity — debriefmd.ca.
    //    DKIM tokens + SPF/DMARC hints emitted as outputs for manual DNS.
    //    Identity creation is instant; verification blocks on DNS records.
    // ────────────────────────────────────────────────────────────────────
    const emailIdentity = new ses.EmailIdentity(this, 'SesDomainIdentity', {
      identity: ses.Identity.domain(SES_DOMAIN),
    });

    new cdk.CfnOutput(this, 'SesDomain', {
      value: SES_DOMAIN,
      description: 'SES domain identity — add the DKIM CNAMEs + SPF/DMARC TXT records below to Squarespace DNS.',
    });
    new cdk.CfnOutput(this, 'SesDkim1Name', { value: emailIdentity.dkimDnsTokenName1 });
    new cdk.CfnOutput(this, 'SesDkim1Value', { value: emailIdentity.dkimDnsTokenValue1 });
    new cdk.CfnOutput(this, 'SesDkim2Name', { value: emailIdentity.dkimDnsTokenName2 });
    new cdk.CfnOutput(this, 'SesDkim2Value', { value: emailIdentity.dkimDnsTokenValue2 });
    new cdk.CfnOutput(this, 'SesDkim3Name', { value: emailIdentity.dkimDnsTokenName3 });
    new cdk.CfnOutput(this, 'SesDkim3Value', { value: emailIdentity.dkimDnsTokenValue3 });
    new cdk.CfnOutput(this, 'SesSpfRecord', {
      value: `${SES_DOMAIN} TXT "v=spf1 include:amazonses.com ~all"`,
      description: 'Add as TXT record on the apex domain.',
    });
    new cdk.CfnOutput(this, 'SesDmarcRecord', {
      value: `_dmarc.${SES_DOMAIN} TXT "v=DMARC1; p=quarantine; rua=mailto:dmarc@${SES_DOMAIN}"`,
      description: 'Add as TXT record on _dmarc subdomain.',
    });

    // ────────────────────────────────────────────────────────────────────
    // 6. Outputs consumed by humans / the compute stack.
    // ────────────────────────────────────────────────────────────────────
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
    new cdk.CfnOutput(this, 'SqsQueueUrl', {
      value: this.pipelineQueue.queueUrl,
      exportName: 'Debrief-SqsQueueUrl',
    });
    new cdk.CfnOutput(this, 'SqsDlqUrl', {
      value: this.pipelineDlq.queueUrl,
      exportName: 'Debrief-SqsDlqUrl',
    });
  }
}
