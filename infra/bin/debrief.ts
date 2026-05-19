#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { DebriefBootstrapStack } from '../lib/bootstrap-stack';
import { DebriefDataStack } from '../lib/data-stack';
import { DebriefComputeStack } from '../lib/compute-stack';

const app = new cdk.App();

// Debrief is PHIPA-regulated health data. Every resource must be in ca-central-1
// and inherit the tags applied at the bottom of this file.
const env = {
  account: '636603298049',
  region: 'ca-central-1',
};

// GitHub repo identity for the OIDC deploy role. Set GITHUB_REPO=org/repo in
// the deploy environment. The bootstrap stack throws at synth time rather
// than silently deploying with a placeholder.
const githubRepo = process.env.GITHUB_REPO;

// ────────────────────────────────────────────────────────────────────────────
// Stack 1: Bootstrap — deployed ONCE manually from CloudShell. Contains the
// GitHub OIDC provider + deploy role that the workflow uses to deploy the
// other two stacks.
// ────────────────────────────────────────────────────────────────────────────
new DebriefBootstrapStack(app, 'DebriefBootstrapStack', {
  env,
  description: 'Debrief bootstrap: GitHub OIDC provider + CI/CD deploy role. Deploy once manually.',
  githubRepo,
});

// ────────────────────────────────────────────────────────────────────────────
// Stack 2: Data — persistent resources (KMS, VPC, RDS, S3, SES). RETAIN on
// delete. Deployed via GitHub Actions on master push.
// ────────────────────────────────────────────────────────────────────────────
const dataStack = new DebriefDataStack(app, 'DebriefDataStack', {
  env,
  description: 'Debrief persistent resources: KMS, VPC, RDS, S3, SES. PHIPA.',
});

// ────────────────────────────────────────────────────────────────────────────
// Stack 3: Compute — stateless resources (ECR, ECS Fargate, ALB, Lambda
// pipeline, SQS). Deployed via GitHub Actions on master push.
// ────────────────────────────────────────────────────────────────────────────
const computeStack = new DebriefComputeStack(app, 'DebriefComputeStack', {
  env,
  description: 'Debrief stateless resources: ECR, ECS Fargate, ALB, Lambda pipeline, SQS.',
  dataStack,
});
computeStack.addDependency(dataStack);

// Global tags — every resource in all stacks inherits these.
cdk.Tags.of(app).add('Project', 'Debrief');
cdk.Tags.of(app).add('Environment', 'prod');
cdk.Tags.of(app).add('Compliance', 'PHIPA');
cdk.Tags.of(app).add('DataClass', 'PHI');
cdk.Tags.of(app).add('ManagedBy', 'CDK');
