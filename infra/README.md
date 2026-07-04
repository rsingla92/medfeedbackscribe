# Debrief Infrastructure (AWS CDK)

AWS CDK (TypeScript) infrastructure for Debrief — PHIPA-compliant voice-to-assessment platform.
Everything lives in `ca-central-1`, account `687591846902`.

## Stacks

- **DebriefDataStack** — KMS, VPC, RDS PostgreSQL 16, S3 (recordings + logs), CloudTrail, SES domain.
- **DebriefComputeStack** — SQS, Lambda pipeline worker, ECR, App Runner, GitHub Actions OIDC role.

The data stack is stateful and `RETAIN`ed on delete. The compute stack is safe to destroy and re-create.

## Prereqs

See [PREREQUISITES.md](./PREREQUISITES.md) — BAA, AWS CLI, Node, DNS access, and the `REPO_PLACEHOLDER` fix.

## Deploy order

```sh
# 1. Install deps (first time only)
cd infra
npm install

# 2. Bootstrap CDK in ca-central-1 (first time only)
npx cdk bootstrap aws://687591846902/ca-central-1

# 3. Deploy the data stack (RDS, S3, KMS, SES).
#    SES identity creation is instant, but verification blocks until
#    you add the DKIM CNAMEs (outputs from this stack) to DNS.
npx cdk deploy DebriefDataStack

# 4. Add the SesDkim1/2/3 + SPF + DMARC records printed as CFN outputs
#    to the med-student-feedback-scribe.dev zone. Wait ~15 min for SES verification.

# 5. Deploy the compute stack (SQS, Lambda, ECR, App Runner, GH OIDC).
#    First deploy will likely fail on App Runner — see "First deploy" below.
npx cdk deploy DebriefComputeStack
```

## First deploy — App Runner chicken-and-egg

App Runner pulls the ECR image at service-creation time. On the very first
`cdk deploy DebriefComputeStack`, the `debrief-web:latest` tag doesn't exist
yet, so App Runner service creation will fail.

Two ways through:

### Option A (recommended): push a placeholder before the first deploy

```sh
# After the ECR repo is created by the compute stack (it'll fail on App Runner),
# push a tiny placeholder so App Runner has something to pull.

# Get the repo URI from the compute stack output once ECR is up, or build it:
AWS_ACCOUNT=687591846902
AWS_REGION=ca-central-1
REPO_URI="${AWS_ACCOUNT}.dkr.ecr.${AWS_REGION}.amazonaws.com/debrief-web"

aws ecr get-login-password --region $AWS_REGION \
  | docker login --username AWS --password-stdin $REPO_URI

# Use a tiny public "hello" image as placeholder.
docker pull --platform=linux/amd64 public.ecr.aws/amazonlinux/amazonlinux:2023
docker tag public.ecr.aws/amazonlinux/amazonlinux:2023 "$REPO_URI:latest"
docker push "$REPO_URI:latest"

# Now re-run the deploy — App Runner will come up (unhealthy, because the
# placeholder doesn't serve on port 3000, but the service resource will exist).
npx cdk deploy DebriefComputeStack
```

### Option B: deploy with `--no-rollback` and fix up

```sh
npx cdk deploy DebriefComputeStack --no-rollback
# Push the real image, then trigger a deployment via App Runner console or:
aws apprunner start-deployment --service-arn <AppRunnerServiceArn>
```

Once your real Next.js image is built and pushed to `debrief-web:latest`, App
Runner will auto-deploy (we enable `autoDeploymentsEnabled`).

## Teardown (prototype cleanup)

Order matters: compute first, data last. RDS + S3 buckets are `RETAIN`ed by
default — they survive `cdk destroy` and must be deleted manually.

```sh
npx cdk destroy DebriefComputeStack
npx cdk destroy DebriefDataStack

# Then manually:
# - Delete RDS snapshot + disable deletion protection first
aws rds modify-db-instance --db-instance-identifier debrief-db \
  --no-deletion-protection --apply-immediately
aws rds delete-db-instance --db-instance-identifier debrief-db \
  --skip-final-snapshot

# - Empty + delete S3 buckets
aws s3 rm s3://debrief-recordings-687591846902-ca-central-1 --recursive
aws s3 rb s3://debrief-recordings-687591846902-ca-central-1
aws s3 rm s3://debrief-logs-687591846902-ca-central-1 --recursive
aws s3 rb s3://debrief-logs-687591846902-ca-central-1

# - Schedule KMS key deletion (7-30 day waiting period)
aws kms schedule-key-deletion --key-id alias/debrief-phi --pending-window-in-days 7
```

> **Never do this in prod.** PHI retention policies apply.

## Cost estimate (idle, ca-central-1)

| Resource                            | Est. monthly |
| ----------------------------------- | ------------ |
| RDS `db.t4g.micro` + 20 GB gp3      | ~$13         |
| NAT Gateway (1 AZ) + data           | ~$32         |
| App Runner (1 vCPU / 2 GB, 1 inst.) | ~$5–15       |
| S3 (negligible at pre-user scale)   | <$1          |
| CloudTrail, CW Logs                 | ~$2          |
| KMS, Secrets Manager                | ~$2          |
| SQS, Lambda (pennies at idle)       | <$1          |
| **Total**                           | **~$55–65**  |

NAT Gateway is the biggest cost driver. Alternatives for later: VPC endpoints
for S3/Secrets/SQS/ECR, or drop NAT entirely if we don't need Vertex AI
egress from Lambda (App Runner can talk out via its own networking).

## Layout

```
infra/
├── bin/debrief.ts           # CDK app entry — tags, env, stack wiring
├── lib/data-stack.ts        # Persistent (retained) resources
├── lib/compute-stack.ts     # Stateless resources
├── lambda/pipeline/         # Lambda worker code (stub in Phase 1)
├── cdk.json
├── package.json
├── tsconfig.json
├── README.md
└── PREREQUISITES.md
```
