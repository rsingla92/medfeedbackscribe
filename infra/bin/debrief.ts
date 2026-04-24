#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { DebriefDataStack } from '../lib/data-stack';
import { DebriefComputeStack } from '../lib/compute-stack';

const app = new cdk.App();

// Debrief is PHIPA-regulated health data. Every resource must be in ca-central-1
// and inherit these tags. Do not override env on child stacks.
const env = {
  account: '687591846902',
  region: 'ca-central-1',
};

const dataStack = new DebriefDataStack(app, 'DebriefDataStack', {
  env,
  description: 'Debrief persistent resources: KMS, VPC, RDS, S3, CloudTrail, SES. PHIPA.',
});

const computeStack = new DebriefComputeStack(app, 'DebriefComputeStack', {
  env,
  description: 'Debrief stateless resources: SQS, Lambda worker, App Runner, ECR, GH OIDC.',
  dataStack,
});

// compute depends on data (KMS key, VPC, RDS secret, buckets).
computeStack.addDependency(dataStack);

// Global tags — every resource in both stacks inherits these.
cdk.Tags.of(app).add('Project', 'Debrief');
cdk.Tags.of(app).add('Environment', 'prod');
cdk.Tags.of(app).add('Compliance', 'PHIPA');
cdk.Tags.of(app).add('DataClass', 'PHI');
cdk.Tags.of(app).add('ManagedBy', 'CDK');
