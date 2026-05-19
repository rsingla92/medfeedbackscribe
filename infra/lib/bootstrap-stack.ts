import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam';

interface DebriefBootstrapStackProps extends cdk.StackProps {
  /**
   * GitHub repo in `org/repo` form. Used as the `sub` claim filter on the
   * GitHub Actions OIDC deploy role. MUST be explicit — wildcards or the
   * literal `REPO_PLACEHOLDER` will cause synth to fail.
   */
  githubRepo?: string;
}

/**
 * Bootstrap-tier resources. Deployed exactly once, manually from AWS
 * CloudShell (or any environment with admin credentials), before any other
 * stack. After this stack exists, all subsequent deploys flow through
 * GitHub Actions assuming the OIDC role created here.
 *
 * Contents:
 *   - GitHub OIDC provider (account-wide, one per account per URL)
 *   - `debrief-github-deploy` role trusted by this repo's GitHub Actions
 *     workflows, scoped to assume CDK bootstrap deploy roles
 *
 * Deliberately tiny so the manual step has the smallest possible footprint.
 */
export class DebriefBootstrapStack extends cdk.Stack {
  public readonly githubDeployRoleArn: string;

  constructor(scope: Construct, id: string, props: DebriefBootstrapStackProps) {
    super(scope, id, props);

    const githubRepo = props?.githubRepo ?? 'REPO_PLACEHOLDER';
    if (githubRepo === 'REPO_PLACEHOLDER' || githubRepo.includes('*')) {
      throw new Error(
        'DebriefBootstrapStack: githubRepo must be explicit like "org/repo". ' +
        'Set GITHUB_REPO=<org/repo> when running cdk deploy — wildcards and ' +
        'the placeholder are refused to prevent unauthorized GitHub repos ' +
        'from assuming the deploy role.',
      );
    }

    // GitHub OIDC provider — account-wide. Only one can exist per URL.
    // If another stack/process already created this provider on the account,
    // import via OpenIdConnectProvider.fromOpenIdConnectProviderArn(...) instead.
    const githubOidcProvider = new iam.OpenIdConnectProvider(this, 'GitHubOidcProvider', {
      url: 'https://token.actions.githubusercontent.com',
      clientIds: ['sts.amazonaws.com'],
    });

    // The role GitHub Actions assumes. Trust is restricted to this repo
    // (any branch/tag/workflow within it). Permissions: assume the CDK
    // bootstrap deploy/file/image roles, read the bootstrap SSM parameter.
    // Everything else flows through those assumed CDK roles, which already
    // carry the wide CloudFormation permissions needed to manage stacks.
    const githubDeployRole = new iam.Role(this, 'GitHubDeployRole', {
      roleName: 'debrief-github-deploy',
      description: 'Debrief CI/CD — assumed by GitHub Actions via OIDC, used to drive cdk deploy + ECR push.',
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

    // CDK deploy: read bootstrap SSM parameter, assume cdk-* roles.
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

    // ECR push (Docker image). ECR auth token is account-wide; the actual
    // push/pull permissions are scoped per repo by the ECR repo policy +
    // resource ARN once the compute stack creates the repo.
    githubDeployRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['ecr:GetAuthorizationToken'],
        resources: ['*'],
      }),
    );
    githubDeployRole.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          'ecr:BatchCheckLayerAvailability',
          'ecr:CompleteLayerUpload',
          'ecr:InitiateLayerUpload',
          'ecr:PutImage',
          'ecr:UploadLayerPart',
          'ecr:BatchGetImage',
          'ecr:GetDownloadUrlForLayer',
          'ecr:DescribeRepositories',
          'ecr:DescribeImages',
        ],
        resources: [`arn:aws:ecr:${this.region}:${this.account}:repository/debrief-web`],
      }),
    );

    // ECS service: force a new deployment after pushing :latest, then wait
    // for stable. Scoped to the debrief-web service/cluster name pattern.
    githubDeployRole.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          'ecs:UpdateService',
          'ecs:DescribeServices',
          'ecs:DescribeTasks',
          'ecs:ListTasks',
          'ecs:RunTask',
        ],
        resources: [
          `arn:aws:ecs:${this.region}:${this.account}:service/debrief-*`,
          `arn:aws:ecs:${this.region}:${this.account}:task/debrief-*/*`,
          `arn:aws:ecs:${this.region}:${this.account}:task-definition/debrief-*:*`,
        ],
      }),
    );

    // CloudFormation: describe stacks/outputs so the workflow can resolve
    // resource identifiers (ECR URI, ECS cluster/service names, ALB DNS)
    // dynamically instead of needing a sprawling set of GitHub secrets.
    githubDeployRole.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          'cloudformation:DescribeStacks',
          'cloudformation:DescribeStackResource',
          'cloudformation:DescribeStackResources',
        ],
        resources: [`arn:aws:cloudformation:${this.region}:${this.account}:stack/Debrief*/*`],
      }),
    );

    // PassRole: ECS RunTask (used by the migration workflow) needs to pass
    // the task execution + task role to the ECS service.
    githubDeployRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['iam:PassRole'],
        resources: [
          `arn:aws:iam::${this.account}:role/debrief-fargate-*`,
        ],
        conditions: {
          StringEquals: {
            'iam:PassedToService': 'ecs-tasks.amazonaws.com',
          },
        },
      }),
    );

    this.githubDeployRoleArn = githubDeployRole.roleArn;

    new cdk.CfnOutput(this, 'GitHubDeployRoleArn', {
      value: githubDeployRole.roleArn,
      description: 'Set this as the AWS_DEPLOY_ROLE_ARN GitHub Actions secret.',
      exportName: 'Debrief-GhDeployRoleArn',
    });
    new cdk.CfnOutput(this, 'GitHubOidcProviderArn', {
      value: githubOidcProvider.openIdConnectProviderArn,
      description: 'GitHub OIDC provider — account-wide, imported by other stacks if needed.',
      exportName: 'Debrief-GhOidcProviderArn',
    });
  }
}
