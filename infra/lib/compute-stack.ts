import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as sources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as path from 'path';
import { DebriefDataStack } from './data-stack';

interface DebriefComputeStackProps extends cdk.StackProps {
  dataStack: DebriefDataStack;
}

/**
 * Debrief compute-layer stack — Plan B (Fargate + ALB).
 *
 * Stateless resources, safe to destroy and re-create. Depends on
 * DebriefDataStack for VPC, KMS, RDS secret, recordings bucket, SES.
 *
 * Pieces:
 *   - SQS pipeline queue + DLQ (KMS-encrypted)
 *   - Lambda pipeline worker (VPC-attached, private-with-egress)
 *   - ECR repository for the Next.js container image
 *   - ECS Fargate cluster + task definition + service
 *   - ALB (internet-facing) with HTTPS listener + ACM cert for
 *     app.debriefmd.ca, validated via DNS CNAME in Squarespace
 *
 * The GitHub OIDC provider + deploy role live in DebriefBootstrapStack so
 * the CI/CD identity exists before the compute stack is ever deployed.
 *
 * WAF intentionally omitted — add as a separate construct + association
 * once we have real traffic worth filtering.
 */
export class DebriefComputeStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: DebriefComputeStackProps) {
    super(scope, id, props);

    const { dataStack } = props;
    const {
      vpc,
      database,
      dbSecurityGroup,
      sesDomain,
      sesFromEmail,
      appHostname,
    } = dataStack;

    // Cross-stack resources are imported by attributes / ARN so that
    // grantX() calls only mutate the consumer's IAM policy, not the
    // source resource's resource policy. The latter would introduce
    // cycles because grants would make the data stack depend on
    // compute-stack role ARNs while compute already depends on data.
    //
    // The data stack's KMS key has an account-root admin policy, so IAM
    // grants on these imported handles are sufficient — consumers gate
    // access via their own IAM policy, not via the key/queue/bucket
    // resource policies.
    const kmsKey = kms.Key.fromKeyArn(this, 'PhiKeyImport', dataStack.kmsKey.keyArn);
    const queue = sqs.Queue.fromQueueAttributes(this, 'PipelineQueueImport', {
      queueArn: dataStack.pipelineQueue.queueArn,
      queueUrl: dataStack.pipelineQueue.queueUrl,
      queueName: dataStack.pipelineQueue.queueName,
      keyArn: dataStack.kmsKey.keyArn,
    });
    const recordingsBucket = s3.Bucket.fromBucketAttributes(this, 'RecordingsBucketImport', {
      bucketArn: dataStack.recordingsBucket.bucketArn,
      bucketName: dataStack.recordingsBucket.bucketName,
      encryptionKey: kmsKey,
    });
    const dbSecret = secretsmanager.Secret.fromSecretAttributes(this, 'DbSecretImport', {
      secretCompleteArn: dataStack.database.secret!.secretArn,
      encryptionKey: kmsKey,
    });

    // Scope SES IAM grants to the single domain identity we own. The
    // ses:FromAddress condition pins the From address (defense in depth).
    const sesIdentityArn = `arn:aws:ses:${this.region}:${this.account}:identity/${sesDomain}`;

    // ────────────────────────────────────────────────────────────────────
    // 2. Runtime secrets imported by name. You create these manually in
    //    the AWS console (or via CLI) before the first deploy. The names
    //    are stable contracts; values rotate independently.
    // ────────────────────────────────────────────────────────────────────
    const authSecret = secretsmanager.Secret.fromSecretNameV2(this, 'AuthSecret', 'debrief/auth-secret');
    const googleOauthSecret = secretsmanager.Secret.fromSecretNameV2(this, 'GoogleOauthSecret', 'debrief/google-oauth');
    const gcpSaSecret = secretsmanager.Secret.fromSecretNameV2(this, 'GcpSaSecret', 'debrief/gcp-sa');

    // ────────────────────────────────────────────────────────────────────
    // 3. Lambda pipeline worker.
    // ────────────────────────────────────────────────────────────────────
    const lambdaSg = new ec2.SecurityGroup(this, 'LambdaSg', {
      vpc,
      description: 'Debrief pipeline Lambda — egress only',
      allowAllOutbound: true,
    });
    // RDS ingress rules are created here (compute stack) rather than via
    // dbSecurityGroup.addIngressRule(...) so the CFN resource lives in
    // the compute stack. Adding it on dbSecurityGroup's side would make
    // the data stack reference compute-stack SG IDs — cycle.
    new ec2.CfnSecurityGroupIngress(this, 'LambdaToRdsIngress', {
      groupId: dbSecurityGroup.securityGroupId,
      sourceSecurityGroupId: lambdaSg.securityGroupId,
      ipProtocol: 'tcp',
      fromPort: 5432,
      toPort: 5432,
      description: 'Debrief pipeline Lambda → RDS',
    });

    const pipelineFn = new lambdaNodejs.NodejsFunction(this, 'PipelineWorker', {
      functionName: 'debrief-pipeline-worker',
      runtime: lambda.Runtime.NODEJS_20_X,
      memorySize: 2048,
      timeout: cdk.Duration.seconds(300),
      entry: path.join(__dirname, '..', 'lambda', 'pipeline', 'handler.ts'),
      handler: 'handler',
      projectRoot: path.join(__dirname, '..', 'lambda', 'pipeline'),
      depsLockFilePath: path.join(__dirname, '..', 'lambda', 'pipeline', 'package.json'),
      bundling: {
        target: 'node20',
        format: lambdaNodejs.OutputFormat.CJS,
        sourceMap: true,
        externalModules: ['@aws-sdk/*'],
      },
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [lambdaSg],
      logRetention: logs.RetentionDays.ONE_MONTH,
      environment: {
        NODE_OPTIONS: '--enable-source-maps',
        AWS_REGION_DEBRIEF: 'ca-central-1',
        RDS_SECRET_ARN: dbSecret.secretArn,
        DB_SECRET_ARN: dbSecret.secretArn,
        RDS_ENDPOINT: database.dbInstanceEndpointAddress,
        RECORDINGS_BUCKET: recordingsBucket.bucketName,
        KMS_KEY_ARN: kmsKey.keyArn,
        SQS_QUEUE_URL: queue.queueUrl,
        SES_FROM_EMAIL: sesFromEmail,
        SES_APP_URL: `https://${appHostname}`,
        GCP_SA_SECRET_ARN: gcpSaSecret.secretArn,
      },
    });

    dbSecret.grantRead(pipelineFn);
    recordingsBucket.grantRead(pipelineFn);
    kmsKey.grantDecrypt(pipelineFn);
    queue.grantConsumeMessages(pipelineFn);
    gcpSaSecret.grantRead(pipelineFn);
    pipelineFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['ses:SendEmail', 'ses:SendRawEmail', 'ses:SendBulkEmail'],
        resources: [sesIdentityArn],
        conditions: {
          StringEquals: {
            'aws:SourceAccount': this.account,
            'ses:FromAddress': sesFromEmail,
          },
        },
      }),
    );

    pipelineFn.addEventSource(
      new sources.SqsEventSource(queue, {
        batchSize: 1,
        reportBatchItemFailures: true,
      }),
    );

    // ────────────────────────────────────────────────────────────────────
    // 4. ECR — Next.js container image registry.
    // ────────────────────────────────────────────────────────────────────
    const ecrRepo = new ecr.Repository(this, 'WebEcrRepo', {
      repositoryName: 'debrief-web',
      imageScanOnPush: true,
      imageTagMutability: ecr.TagMutability.MUTABLE,
      encryption: ecr.RepositoryEncryption.KMS,
      encryptionKey: kmsKey,
      lifecycleRules: [
        {
          description: 'Keep last 10 images',
          maxImageCount: 10,
          rulePriority: 1,
        },
      ],
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // ────────────────────────────────────────────────────────────────────
    // 5. ECS Fargate cluster + service.
    // ────────────────────────────────────────────────────────────────────
    const cluster = new ecs.Cluster(this, 'WebCluster', {
      clusterName: 'debrief-web',
      vpc,
      containerInsights: true,
    });

    // Task role — what the running container can do. Equivalent to the
    // previous App Runner "instance role".
    const taskRole = new iam.Role(this, 'FargateTaskRole', {
      roleName: 'debrief-fargate-task',
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      description: 'Debrief Fargate task role — perms granted to the running container.',
    });
    dbSecret.grantRead(taskRole);
    recordingsBucket.grantReadWrite(taskRole);
    kmsKey.grantEncryptDecrypt(taskRole);
    queue.grantSendMessages(taskRole);
    authSecret.grantRead(taskRole);
    googleOauthSecret.grantRead(taskRole);
    taskRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['ses:SendEmail', 'ses:SendRawEmail', 'ses:SendBulkEmail'],
        resources: [sesIdentityArn],
        conditions: {
          StringEquals: {
            'aws:SourceAccount': this.account,
            'ses:FromAddress': sesFromEmail,
          },
        },
      }),
    );

    // Execution role — what ECS itself uses to pull the image and write logs.
    const executionRole = new iam.Role(this, 'FargateExecutionRole', {
      roleName: 'debrief-fargate-execution',
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      description: 'Debrief Fargate execution role — pulls ECR images, writes CW logs, resolves secrets.',
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy'),
      ],
    });
    // Execution role pulls secret values at task-start time before the
    // container even runs, so it needs read access too (separate from the
    // task role which is used by the running container's SDK calls).
    authSecret.grantRead(executionRole);
    googleOauthSecret.grantRead(executionRole);
    kmsKey.grantDecrypt(executionRole);

    const taskLogGroup = new logs.LogGroup(this, 'WebTaskLogs', {
      logGroupName: '/aws/ecs/debrief-web',
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const taskDef = new ecs.FargateTaskDefinition(this, 'WebTaskDef', {
      family: 'debrief-web',
      cpu: 512,        // 0.5 vCPU
      memoryLimitMiB: 1024, // 1 GB
      taskRole,
      executionRole,
      runtimePlatform: {
        cpuArchitecture: ecs.CpuArchitecture.X86_64,
        operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
      },
    });

    taskDef.addContainer('web', {
      containerName: 'web',
      image: ecs.ContainerImage.fromEcrRepository(ecrRepo, 'latest'),
      portMappings: [{ containerPort: 3000, protocol: ecs.Protocol.TCP }],
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'web',
        logGroup: taskLogGroup,
      }),
      environment: {
        NODE_ENV: 'production',
        AWS_REGION_DEBRIEF: 'ca-central-1',
        RDS_SECRET_ARN: dbSecret.secretArn,
        RDS_ENDPOINT: database.dbInstanceEndpointAddress,
        RECORDINGS_BUCKET: recordingsBucket.bucketName,
        KMS_KEY_ARN: kmsKey.keyArn,
        SQS_QUEUE_URL: queue.queueUrl,
        SES_FROM_EMAIL: sesFromEmail,
        AUTH_URL: `https://${appHostname}`,
      },
      // Secrets pulled at container-start time and injected as env vars.
      // Auth.js reads AUTH_SECRET; the email provider reads GOOGLE_CLIENT_ID/SECRET.
      secrets: {
        AUTH_SECRET: ecs.Secret.fromSecretsManager(authSecret),
        GOOGLE_CLIENT_ID: ecs.Secret.fromSecretsManager(googleOauthSecret, 'clientId'),
        GOOGLE_CLIENT_SECRET: ecs.Secret.fromSecretsManager(googleOauthSecret, 'clientSecret'),
      },
      // Container-level health check (in addition to ALB target-group
      // health check). Helps Fargate replace a wedged task even if it's
      // still serving 200s on /api/health.
      healthCheck: {
        command: ['CMD-SHELL', 'wget -qO- http://localhost:3000/api/health || exit 1'],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        retries: 3,
        startPeriod: cdk.Duration.seconds(60),
      },
    });

    // ────────────────────────────────────────────────────────────────────
    // 6. ALB + HTTPS listener + ACM cert.
    // ────────────────────────────────────────────────────────────────────
    const albSg = new ec2.SecurityGroup(this, 'AlbSg', {
      vpc,
      description: 'Debrief ALB — 443 from internet',
      allowAllOutbound: true,
    });
    albSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), 'HTTPS from internet');
    albSg.addIngressRule(ec2.Peer.anyIpv6(), ec2.Port.tcp(443), 'HTTPS from internet (IPv6)');

    const fargateSg = new ec2.SecurityGroup(this, 'FargateSg', {
      vpc,
      description: 'Debrief Fargate task — 3000 from ALB only',
      allowAllOutbound: true,
    });
    fargateSg.addIngressRule(albSg, ec2.Port.tcp(3000), 'ALB → Fargate task');
    new ec2.CfnSecurityGroupIngress(this, 'FargateToRdsIngress', {
      groupId: dbSecurityGroup.securityGroupId,
      sourceSecurityGroupId: fargateSg.securityGroupId,
      ipProtocol: 'tcp',
      fromPort: 5432,
      toPort: 5432,
      description: 'Debrief Fargate task → RDS',
    });

    const alb = new elbv2.ApplicationLoadBalancer(this, 'WebAlb', {
      loadBalancerName: 'debrief-web-alb',
      vpc,
      internetFacing: true,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      securityGroup: albSg,
      // Drop invalid HTTP headers at the LB rather than passing them to
      // Node, which has a history of header-handling CVEs.
      dropInvalidHeaderFields: true,
    });

    // ACM cert for app.debriefmd.ca — DNS-validated via Squarespace CNAME.
    // The DNS validation records are emitted as part of CloudFormation's
    // certificate resource events; you read them from the AWS console
    // (Certificate Manager) during the first deploy. Without the CNAME in
    // DNS, this resource will sit in PENDING_VALIDATION for ~30 min and
    // CloudFormation will eventually time out.
    const cert = new acm.Certificate(this, 'AppCert', {
      domainName: appHostname,
      validation: acm.CertificateValidation.fromDns(),
    });

    const httpsListener = alb.addListener('HttpsListener', {
      port: 443,
      protocol: elbv2.ApplicationProtocol.HTTPS,
      certificates: [cert],
      sslPolicy: elbv2.SslPolicy.TLS13_RES,
    });

    // Redirect HTTP → HTTPS at the LB so health-check tooling and DNS
    // pre-validation pokes never go through unencrypted.
    alb.addListener('HttpRedirect', {
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      defaultAction: elbv2.ListenerAction.redirect({
        protocol: 'HTTPS',
        port: '443',
        permanent: true,
      }),
    });

    const fargateService = new ecs.FargateService(this, 'WebService', {
      serviceName: 'debrief-web',
      cluster,
      taskDefinition: taskDef,
      desiredCount: 1,
      minHealthyPercent: 100,
      maxHealthyPercent: 200,
      // Tasks live in private subnets and reach AWS APIs through the NAT.
      // ALB does the only ingress, on Fargate SG port 3000.
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      assignPublicIp: false,
      securityGroups: [fargateSg],
      healthCheckGracePeriod: cdk.Duration.seconds(90),
      // Roll one task at a time. With desiredCount=1 + minHealthy=100% +
      // maxHealthy=200%, ECS spins up the new task, waits for it to pass
      // health checks, then drains the old one. Zero-downtime deploys.
      enableExecuteCommand: true,
    });

    httpsListener.addTargets('WebTarget', {
      targetGroupName: 'debrief-web-tg',
      port: 3000,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targets: [fargateService],
      deregistrationDelay: cdk.Duration.seconds(15),
      healthCheck: {
        path: '/api/health',
        port: '3000',
        protocol: elbv2.Protocol.HTTP,
        healthyHttpCodes: '200',
        interval: cdk.Duration.seconds(15),
        timeout: cdk.Duration.seconds(5),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3,
      },
    });

    // ────────────────────────────────────────────────────────────────────
    // 7. Outputs.
    // ────────────────────────────────────────────────────────────────────
    new cdk.CfnOutput(this, 'EcrRepositoryUri', {
      value: ecrRepo.repositoryUri,
      description: 'Push :latest here to trigger a Fargate redeploy.',
      exportName: 'Debrief-EcrUri',
    });
    new cdk.CfnOutput(this, 'EcsClusterName', {
      value: cluster.clusterName,
      exportName: 'Debrief-EcsClusterName',
    });
    new cdk.CfnOutput(this, 'EcsServiceName', {
      value: fargateService.serviceName,
      exportName: 'Debrief-EcsServiceName',
    });
    new cdk.CfnOutput(this, 'AlbDnsName', {
      value: alb.loadBalancerDnsName,
      description: `Point ${appHostname} CNAME here in Squarespace DNS.`,
      exportName: 'Debrief-AlbDnsName',
    });
    new cdk.CfnOutput(this, 'AppUrl', {
      value: `https://${appHostname}`,
      exportName: 'Debrief-AppUrl',
    });
    new cdk.CfnOutput(this, 'CertificateArn', {
      value: cert.certificateArn,
      description: 'ACM cert — DNS validation records visible in AWS Certificate Manager console.',
      exportName: 'Debrief-CertificateArn',
    });
    new cdk.CfnOutput(this, 'LambdaFunctionName', {
      value: pipelineFn.functionName,
      exportName: 'Debrief-LambdaName',
    });
  }
}
