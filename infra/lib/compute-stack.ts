import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import * as sources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as apprunner from 'aws-cdk-lib/aws-apprunner';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';
import * as path from 'path';
import { DebriefDataStack } from './data-stack';

interface DebriefComputeStackProps extends cdk.StackProps {
  dataStack: DebriefDataStack;
  /**
   * GitHub repo in `org/repo` form. Used as the `sub` claim filter on the
   * GitHub Actions OIDC deploy role. MUST be explicit — wildcards or the
   * literal `REPO_PLACEHOLDER` will cause synth to fail. Pass via
   * `infra/bin/debrief.ts` (typically from the GITHUB_REPO env var).
   */
  githubRepo?: string;
}

const SES_DOMAIN = 'med-student-feedback-scribe.dev';
const SES_FROM_EMAIL = `noreply@${SES_DOMAIN}`;

/**
 * Debrief compute-layer stack.
 *
 * Stateless resources — safe to destroy and re-create. Depends on
 * DebriefDataStack for VPC, KMS, RDS secret, and buckets.
 *
 * IMPORTANT: Replace REPO_PLACEHOLDER in the GitHub OIDC role below with
 * the actual owner/repo string before deploying. See PREREQUISITES.md.
 */
export class DebriefComputeStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: DebriefComputeStackProps) {
    super(scope, id, props);

    // ====================================================================
    // 0. Synth-time guard: GitHub repo identity must be explicit.
    //    Wildcards in the OIDC `sub` claim would let any GitHub repo in the
    //    world assume the deploy role. Refuse to synth without a real value.
    // ====================================================================
    const githubRepo = props?.githubRepo ?? 'REPO_PLACEHOLDER';
    if (githubRepo === 'REPO_PLACEHOLDER' || githubRepo.includes('*')) {
      throw new Error(
        'DebriefComputeStack: githubRepo must be explicit like "org/repo". ' +
        'Pass it in via stack props (infra/bin/debrief.ts) — wildcards and the ' +
        'placeholder are refused to prevent unauthorized GitHub repos from ' +
        'assuming the deploy role.'
      );
    }

    const { dataStack } = props;
    const { kmsKey, vpc, database, recordingsBucket, dbSecurityGroup } = dataStack;

    // SES identity ARN — scope IAM grants down from `Resource: '*'` to the
    // single domain identity we own. `ses:FromAddress` condition further
    // restricts the From address (defense in depth).
    const sesIdentityArn = `arn:aws:ses:${this.region}:${this.account}:identity/${SES_DOMAIN}`;

    // ====================================================================
    // 1. SQS queues (main + DLQ), KMS-encrypted.
    // ====================================================================
    const dlq = new sqs.Queue(this, 'PipelineDlq', {
      queueName: 'debrief-pipeline-dlq',
      encryption: sqs.QueueEncryption.KMS,
      encryptionMasterKey: kmsKey,
      retentionPeriod: cdk.Duration.days(14),
      enforceSSL: true,
    });

    const queue = new sqs.Queue(this, 'PipelineQueue', {
      queueName: 'debrief-pipeline-queue',
      encryption: sqs.QueueEncryption.KMS,
      encryptionMasterKey: kmsKey,
      retentionPeriod: cdk.Duration.days(14),
      // Pipeline can run up to 300s; 360s gives buffer over that.
      visibilityTimeout: cdk.Duration.seconds(360),
      enforceSSL: true,
      deadLetterQueue: {
        queue: dlq,
        maxReceiveCount: 3,
      },
    });

    // ====================================================================
    // 2. S3 → SQS notification on ObjectCreated:Put.
    //    addEventNotification grants the bucket SendMessage + kms:GenerateDataKey.
    // ====================================================================
    recordingsBucket.addEventNotification(
      cdk.aws_s3.EventType.OBJECT_CREATED_PUT,
      new s3n.SqsDestination(queue),
    );

    // ====================================================================
    // 3. Lambda pipeline worker.
    // ====================================================================
    // Security group for the worker — egress-only. RDS ingress added below.
    const lambdaSg = new ec2.SecurityGroup(this, 'LambdaSg', {
      vpc,
      description: 'Debrief pipeline Lambda — egress only',
      allowAllOutbound: true,
    });

    // Allow the Lambda SG to reach the RDS SG on 5432.
    dbSecurityGroup.addIngressRule(
      lambdaSg,
      ec2.Port.tcp(5432),
      'Debrief pipeline Lambda → RDS',
    );

    // Phase 2: swapped `lambda.Function` + `Code.fromAsset` for `NodejsFunction`
    // so esbuild bundles the TypeScript source automatically. The asset-from-dir
    // approach uploaded raw source without dependencies; NodejsFunction resolves
    // imports, tree-shakes AWS SDK (provided by the Node 20 runtime), and emits
    // a single minified handler. Entry points at handler.ts in the Phase 2
    // package.
    const pipelineFn = new lambdaNodejs.NodejsFunction(this, 'PipelineWorker', {
      functionName: 'debrief-pipeline-worker',
      runtime: lambda.Runtime.NODEJS_20_X,
      memorySize: 2048,
      timeout: cdk.Duration.seconds(300),
      entry: path.join(__dirname, '..', 'lambda', 'pipeline', 'handler.ts'),
      handler: 'handler',
      projectRoot: path.join(__dirname, '..', 'lambda', 'pipeline'),
      depsLockFilePath: path.join(
        __dirname, '..', 'lambda', 'pipeline', 'package.json',
      ),
      bundling: {
        target: 'node20',
        format: lambdaNodejs.OutputFormat.CJS,
        sourceMap: true,
        // AWS SDK v3 is present in the Node 20 Lambda runtime; exclude to keep
        // the bundle small. `postgres` and `@google-cloud/vertexai` are bundled.
        externalModules: ['@aws-sdk/*'],
      },
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [lambdaSg],
      logRetention: logs.RetentionDays.ONE_MONTH,
      environment: {
        NODE_OPTIONS: '--enable-source-maps',
        AWS_REGION_DEBRIEF: 'ca-central-1',
        RDS_SECRET_ARN: database.secret!.secretArn,
        DB_SECRET_ARN: database.secret!.secretArn,
        RDS_ENDPOINT: database.dbInstanceEndpointAddress,
        RECORDINGS_BUCKET: recordingsBucket.bucketName,
        KMS_KEY_ARN: kmsKey.keyArn,
        SQS_QUEUE_URL: queue.queueUrl,
        // Vertex AI config — set these via `cdk deploy --context` or console:
        //   GCP_PROJECT_ID:     Vertex AI project id
        //   GCP_SA_SECRET_ARN:  Secrets Manager ARN holding the SA JSON
        //   SES_FROM_EMAIL:     optional override
        //   PROGRAM_ADMIN_EMAIL: optional BCC
      },
    });

    // IAM grants.
    database.secret!.grantRead(pipelineFn);
    recordingsBucket.grantRead(pipelineFn);
    kmsKey.grantDecrypt(pipelineFn);
    queue.grantConsumeMessages(pipelineFn);
    // SES send permissions (for post-processing email notifications).
    // Scoped to our domain identity ARN; FromAddress condition pins the
    // sender. Was Resource: '*' previously.
    pipelineFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['ses:SendEmail', 'ses:SendRawEmail', 'ses:SendBulkEmail'],
        resources: [sesIdentityArn],
        conditions: {
          StringEquals: {
            'aws:SourceAccount': this.account,
            'ses:FromAddress': SES_FROM_EMAIL,
          },
        },
      }),
    );

    // Event source — SQS → Lambda, batch size 1 for prototype.
    pipelineFn.addEventSource(
      new sources.SqsEventSource(queue, {
        batchSize: 1,
        reportBatchItemFailures: true,
      }),
    );

    // ====================================================================
    // 4. ECR repository for the Next.js container image.
    // ====================================================================
    const ecrRepo = new ecr.Repository(this, 'WebEcrRepo', {
      repositoryName: 'debrief-web',
      imageScanOnPush: true,
      imageTagMutability: ecr.TagMutability.MUTABLE, // prototype — using :latest
      encryption: ecr.RepositoryEncryption.KMS,
      encryptionKey: kmsKey,
      lifecycleRules: [
        {
          description: 'Keep last 10 images',
          maxImageCount: 10,
          rulePriority: 1,
        },
      ],
      removalPolicy: cdk.RemovalPolicy.DESTROY, // stateless — safe to recreate
    });

    // ====================================================================
    // 5. App Runner — Next.js web service from ECR.
    //    Uses L1 CfnService because the L2 `aws-apprunner-alpha` module is
    //    experimental and App Runner's VPC connector shape is stable in L1.
    // ====================================================================

    // SG for App Runner VPC connector (reaches RDS).
    const appRunnerSg = new ec2.SecurityGroup(this, 'AppRunnerSg', {
      vpc,
      description: 'Debrief App Runner VPC connector — egress only',
      allowAllOutbound: true,
    });
    dbSecurityGroup.addIngressRule(
      appRunnerSg,
      ec2.Port.tcp(5432),
      'Debrief App Runner → RDS',
    );

    const vpcConnector = new apprunner.CfnVpcConnector(this, 'AppRunnerVpcConnector', {
      vpcConnectorName: 'debrief-web-connector',
      subnets: vpc.selectSubnets({
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      }).subnetIds,
      securityGroups: [appRunnerSg.securityGroupId],
    });

    // Instance role — what the running container can do.
    const instanceRole = new iam.Role(this, 'AppRunnerInstanceRole', {
      assumedBy: new iam.ServicePrincipal('tasks.apprunner.amazonaws.com'),
      description: 'Debrief App Runner instance role',
    });
    database.secret!.grantRead(instanceRole);
    recordingsBucket.grantReadWrite(instanceRole); // for presigned PUT generation
    kmsKey.grantEncryptDecrypt(instanceRole);
    queue.grantSendMessages(instanceRole);
    instanceRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['ses:SendEmail', 'ses:SendRawEmail', 'ses:SendBulkEmail'],
        resources: [sesIdentityArn],
        conditions: {
          StringEquals: {
            'aws:SourceAccount': this.account,
            'ses:FromAddress': SES_FROM_EMAIL,
          },
        },
      }),
    );
    // Bedrock grant intentionally removed: the pipeline runs on Vertex AI
    // (Google) in northamerica-northeast1, not Bedrock. If we ever flip to
    // Bedrock for any model, re-add a scoped grant naming the specific model
    // ARN — never `Resource: '*'`.

    // Access role — what App Runner uses to pull the ECR image.
    const accessRole = new iam.Role(this, 'AppRunnerAccessRole', {
      assumedBy: new iam.ServicePrincipal('build.apprunner.amazonaws.com'),
      description: 'Debrief App Runner ECR pull role',
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSAppRunnerServicePolicyForECRAccess'),
      ],
    });

    const appRunnerService = new apprunner.CfnService(this, 'AppRunnerService', {
      serviceName: 'debrief-web',
      sourceConfiguration: {
        authenticationConfiguration: {
          accessRoleArn: accessRole.roleArn,
        },
        autoDeploymentsEnabled: true, // redeploy on ECR push to :latest
        imageRepository: {
          imageRepositoryType: 'ECR',
          imageIdentifier: `${ecrRepo.repositoryUri}:latest`,
          imageConfiguration: {
            port: '3000',
            runtimeEnvironmentVariables: [
              { name: 'AWS_REGION_DEBRIEF', value: 'ca-central-1' },
              { name: 'RDS_SECRET_ARN', value: database.secret!.secretArn },
              { name: 'RDS_ENDPOINT', value: database.dbInstanceEndpointAddress },
              { name: 'RECORDINGS_BUCKET', value: recordingsBucket.bucketName },
              { name: 'KMS_KEY_ARN', value: kmsKey.keyArn },
              { name: 'SQS_QUEUE_URL', value: queue.queueUrl },
              // Auth secrets (NextAuth, Resend, Vertex creds) are added in
              // Phase 2 via Secrets Manager references.
            ],
          },
        },
      },
      instanceConfiguration: {
        cpu: '1 vCPU',
        memory: '2 GB',
        instanceRoleArn: instanceRole.roleArn,
      },
      healthCheckConfiguration: {
        protocol: 'HTTP',
        path: '/api/health',
        interval: 10,
        timeout: 5,
        healthyThreshold: 1,
        unhealthyThreshold: 5,
      },
      networkConfiguration: {
        egressConfiguration: {
          egressType: 'VPC',
          vpcConnectorArn: vpcConnector.attrVpcConnectorArn,
        },
        ingressConfiguration: {
          isPubliclyAccessible: true,
        },
      },
      // NOTE: App Runner auto-scaling configuration is created separately
      // via CfnAutoScalingConfiguration. For prototype we rely on the default
      // auto-scaling config (min 1, max 25); tune to 1–2 max post-cutover by
      // referencing a custom AutoScalingConfigurationArn here.
    });

    appRunnerService.node.addDependency(vpcConnector);
    appRunnerService.node.addDependency(ecrRepo);

    // ====================================================================
    // 5b. WAFv2 — REGIONAL Web ACL associated with the App Runner service.
    //     Two rate-based rules: a global per-IP ceiling, and a stricter
    //     scope-down rule for the magic-link auth endpoint to slow down
    //     credential-stuffing / enumeration. AWS WAF rate limits are evaluated
    //     over a rolling 5-minute window.
    // ====================================================================
    const wafAcl = new wafv2.CfnWebACL(this, 'DebriefWebAcl', {
      scope: 'REGIONAL',
      defaultAction: { allow: {} },
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: 'DebriefWebAcl',
        sampledRequestsEnabled: true,
      },
      rules: [
        {
          name: 'RateLimitPerIp',
          priority: 1,
          statement: {
            rateBasedStatement: { limit: 1000, aggregateKeyType: 'IP' },
          },
          action: { block: {} },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: 'RateLimit',
            sampledRequestsEnabled: true,
          },
        },
        {
          name: 'MagicLinkRateLimit',
          priority: 2,
          statement: {
            rateBasedStatement: {
              limit: 100,
              aggregateKeyType: 'IP',
              scopeDownStatement: {
                byteMatchStatement: {
                  fieldToMatch: { uriPath: {} },
                  positionalConstraint: 'STARTS_WITH',
                  searchString: '/api/auth/signin/email',
                  textTransformations: [{ priority: 0, type: 'NONE' }],
                },
              },
            },
          },
          action: { block: {} },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: 'MagicLinkRateLimit',
            sampledRequestsEnabled: true,
          },
        },
      ],
    });

    const wafAssociation = new wafv2.CfnWebACLAssociation(this, 'DebriefWebAclAssoc', {
      // App Runner exposes attrServiceArn for WAF association — confirmed
      // supported by AWS::WAFv2::WebACLAssociation since Apr 2023.
      resourceArn: appRunnerService.attrServiceArn,
      webAclArn: wafAcl.attrArn,
    });
    wafAssociation.node.addDependency(appRunnerService);

    // ====================================================================
    // 6. GitHub Actions OIDC deploy role.
    // ====================================================================
    // The OIDC provider is account-wide. Check if it already exists in this
    // AWS account before creating. If the provider was created by another
    // stack, comment out this construct and import it via fromOpenIdConnectProviderArn.
    const githubOidcProvider = new iam.OpenIdConnectProvider(this, 'GitHubOidcProvider', {
      url: 'https://token.actions.githubusercontent.com',
      clientIds: ['sts.amazonaws.com'],
      // Thumbprints managed by AWS — empty array is accepted for GitHub.
    });

    // `githubRepo` is provided via stack props and validated at the top of
    // this constructor — REPO_PLACEHOLDER and wildcards throw at synth.
    const githubDeployRole = new iam.Role(this, 'GitHubDeployRole', {
      roleName: 'debrief-github-deploy',
      description: 'Debrief CI/CD — assumed by GitHub Actions via OIDC',
      assumedBy: new iam.FederatedPrincipal(
        githubOidcProvider.openIdConnectProviderArn,
        {
          StringEquals: {
            'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
          },
          StringLike: {
            'token.actions.githubusercontent.com:sub': `repo:${githubRepo}:*`,
          },
        },
        'sts:AssumeRoleWithWebIdentity',
      ),
      maxSessionDuration: cdk.Duration.hours(1),
    });

    // ECR push.
    ecrRepo.grantPullPush(githubDeployRole);
    githubDeployRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['ecr:GetAuthorizationToken'],
        resources: ['*'],
      }),
    );
    // App Runner update (trigger deployment + describe).
    githubDeployRole.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          'apprunner:StartDeployment',
          'apprunner:DescribeService',
          'apprunner:UpdateService',
          'apprunner:ListServices',
        ],
        resources: [appRunnerService.attrServiceArn],
      }),
    );
    // Lambda function code update.
    githubDeployRole.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          'lambda:UpdateFunctionCode',
          'lambda:UpdateFunctionConfiguration',
          'lambda:GetFunction',
          'lambda:PublishVersion',
        ],
        resources: [pipelineFn.functionArn],
      }),
    );
    // Future `cdk deploy` from CI — read CDK bootstrap.
    githubDeployRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['ssm:GetParameter'],
        resources: [`arn:aws:ssm:${this.region}:${this.account}:parameter/cdk-bootstrap/*`],
      }),
    );
    githubDeployRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['sts:AssumeRole'],
        resources: [`arn:aws:iam::${this.account}:role/cdk-*`],
      }),
    );

    // ====================================================================
    // 7. Outputs.
    // ====================================================================
    new cdk.CfnOutput(this, 'SqsQueueUrl', {
      value: queue.queueUrl,
      exportName: 'Debrief-SqsQueueUrl',
    });
    new cdk.CfnOutput(this, 'SqsDlqUrl', {
      value: dlq.queueUrl,
      exportName: 'Debrief-SqsDlqUrl',
    });
    new cdk.CfnOutput(this, 'AppRunnerServiceUrl', {
      value: `https://${appRunnerService.attrServiceUrl}`,
      description: 'Debrief web service URL (App Runner)',
      exportName: 'Debrief-AppRunnerUrl',
    });
    new cdk.CfnOutput(this, 'AppRunnerServiceArn', {
      value: appRunnerService.attrServiceArn,
      exportName: 'Debrief-AppRunnerArn',
    });
    new cdk.CfnOutput(this, 'EcrRepositoryUri', {
      value: ecrRepo.repositoryUri,
      exportName: 'Debrief-EcrUri',
    });
    new cdk.CfnOutput(this, 'LambdaFunctionName', {
      value: pipelineFn.functionName,
      exportName: 'Debrief-LambdaName',
    });
    new cdk.CfnOutput(this, 'GitHubDeployRoleArn', {
      value: githubDeployRole.roleArn,
      description: 'Use in GitHub Actions: aws-actions/configure-aws-credentials role-to-assume',
      exportName: 'Debrief-GhDeployRoleArn',
    });
  }
}
