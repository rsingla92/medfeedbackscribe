# Debrief Infrastructure Prerequisites

Manual steps you must complete before (or during) `cdk deploy`. PHIPA data — don't skip.

## Before `cdk deploy`

### 1. AWS BAA

- Sign the AWS Business Associate Addendum via **AWS Artifact**
  (https://console.aws.amazon.com/artifact/home).
- Required before PHI touches the account. Likely already signed on account
  `687591846902` — verify in Artifact
  → Agreements. If signed, nothing to do.

### 2. AWS CLI credentials

```sh
aws sts get-caller-identity
# Should print Account: 687591846902
aws configure get region
# Should print ca-central-1 (or set AWS_REGION=ca-central-1 in env)
```

You need admin (or at minimum CDK-deploy-capable) credentials for
`687591846902`. SSO via AWS IAM Identity Center is fine; long-lived access
keys are not recommended.

### 3. Region access

Confirm no SCP or region restriction blocks `ca-central-1`:

```sh
aws ec2 describe-regions --region ca-central-1 \
  --query "Regions[?RegionName=='ca-central-1']"
```

Should return one row. If empty, contact AWS Org admin.

### 4. Node + CDK CLI

```sh
node --version   # >= 20
npm install -g aws-cdk
cdk --version    # >= 2.170.0
```

### 5. DNS access to `med-student-feedback-scribe.dev`

You'll need to add records to the zone:

- **Immediately after `cdk deploy DebriefDataStack`**: 3 DKIM CNAMEs + 1 SPF
  TXT + 1 DMARC TXT (exact values printed as CloudFormation outputs).
- **Later** (App Runner custom domain, optional): validation + target
  CNAMEs for `med-student-feedback-scribe.dev`.

Document who controls the DNS (Route 53? Cloudflare? Registrar DNS?) and make
sure you have access.

### 6. Replace `REPO_PLACEHOLDER`

In `lib/compute-stack.ts`, the GitHub OIDC trust policy uses the placeholder
string `REPO_PLACEHOLDER`. Replace it with the real repo, e.g.:

```ts
const githubRepo = 'rsingla92/debrief-backend';
```

The `sub` condition restricts which repo can assume the role, so a wrong
value will either block legitimate deploys or (worse) allow a different repo
to assume it. Fix this before running `cdk deploy DebriefComputeStack`.

### 7. Google Cloud BAA (reminder)

- Vertex AI Gemini 2.5 Flash calls from the pipeline Lambda require a signed
  BAA with Google Cloud (already in place for Debrief per current setup).
  Document the BAA status in your compliance folder.
- Confirm the Vertex endpoint is `northamerica-northeast1` (Montreal) — STT
  and LLM traffic must never leave Canada.

### 8. Shared OIDC provider check

The compute stack creates an IAM OIDC provider for
`token.actions.githubusercontent.com`. IAM OIDC providers are **account-wide**
(one per URL). If the AWS account already has this provider in
`687591846902`, the `cdk deploy` will fail with "EntityAlreadyExists".

Check first:

```sh
aws iam list-open-id-connect-providers
```

If a GitHub OIDC provider already exists, comment out the
`new iam.OpenIdConnectProvider(...)` block in `lib/compute-stack.ts` and
replace with:

```ts
const githubOidcProvider = iam.OpenIdConnectProvider.fromOpenIdConnectProviderArn(
  this, 'GitHubOidcProvider',
  'arn:aws:iam::687591846902:oidc-provider/token.actions.githubusercontent.com'
);
```

## During / after deploy

### 9. SES DKIM verification

After `cdk deploy DebriefDataStack`:

1. Copy the `SesDkim1Name`/`Value`, `SesDkim2Name`/`Value`, `SesDkim3Name`/`Value`
   outputs.
2. Add them as **CNAME** records to the `med-student-feedback-scribe.dev` zone.
3. Add the SPF hint as a **TXT** record on `med-student-feedback-scribe.dev`.
4. Add the DMARC hint as a **TXT** record on `_dmarc.med-student-feedback-scribe.dev`.
5. Wait 5–30 min. Verify:
   ```sh
   aws ses get-identity-verification-attributes \
     --identities med-student-feedback-scribe.dev --region ca-central-1
   ```
   `VerificationStatus: Success` means you can now send.
6. By default SES starts in **sandbox** mode — you can only send to verified
   recipients. Request production access via the SES console when ready for
   real traffic.

### 10. App Runner first-deploy placeholder image

See the **First deploy** section of [README.md](./README.md). App Runner needs
an image in ECR before the service can create.

### 11. Tag compliance check

After deploy, verify every resource inherited the required tags:

```sh
aws resourcegroupstaggingapi get-resources \
  --region ca-central-1 \
  --tag-filters Key=Project,Values=Debrief \
  --query 'ResourceTagMappingList[].[ResourceARN]' --output text | wc -l
```

Cross-reference against the CloudFormation resource count. Any resource
missing `Compliance=PHIPA`, `DataClass=PHI`, `Project=Debrief`, or
`Environment=prod` is a compliance miss — fix the source and redeploy.
