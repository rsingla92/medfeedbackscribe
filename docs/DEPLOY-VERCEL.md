# Debrief - Vercel Deployment Guide

## Prerequisites

- Vercel CLI installed (`bun add -g vercel`)
- A Vercel account (https://vercel.com)
- Access to the Supabase project dashboard

## Configuration

The `vercel.json` in the `app/` directory is already configured with:

- **Build command:** `bun run build`
- **Install command:** `bun install`
- **Framework:** Next.js
- **Region:** `yul1` (Montreal, Canada) for PIPEDA compliance
- **Function timeout:** 120 seconds (processing pipeline typically takes 60-90s)

## Step 1: Login to Vercel

```bash
cd ~/Desktop/medfeedbackscribe/app
vercel login
```

Follow the prompts to authenticate via browser or email.

## Step 2: Deploy

```bash
cd ~/Desktop/medfeedbackscribe/app
vercel deploy --prod
```

On first deploy, the CLI will ask you to link the project. Accept the defaults or customize:
- **Set up and deploy?** Yes
- **Which scope?** Select your Vercel account/team
- **Link to existing project?** No (creates a new one)
- **Project name:** medfeedbackscribe (or your preference)
- **Directory:** `./` (the app directory is the root)

## Step 3: Set Environment Variables

In the Vercel Dashboard (https://vercel.com) under your project's Settings > Environment Variables, add:

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Your Supabase anonymous/public key |
| `GCP_PROJECT_ID` | Yes | GCP project ID where Vertex AI is enabled |
| `GOOGLE_APPLICATION_CREDENTIALS` | Yes | Path to the GCP service-account JSON key file (see note below) |
| `RESEND_API_KEY` | No | Resend API key for email notifications |
| `PROGRAM_ADMIN_EMAIL` | No | BCC address for all assessment notifications |

### GCP Service Account Setup (Vertex AI — northamerica-northeast1)

All STT, PHI scrubbing, and assessment extraction runs via Gemini 2.5 Flash on Vertex AI in **northamerica-northeast1 (Montreal)**. No Deepgram or Anthropic keys are needed.

1. Create a GCP service account with `roles/aiplatform.user` in your GCP project.
2. Download the JSON key file.
3. In Vercel, add it as a file-based secret:
   - Upload the JSON content as a Vercel environment variable (e.g., `GCP_SERVICE_ACCOUNT_JSON`).
   - In your deployment environment, write the JSON to a temp file and set `GOOGLE_APPLICATION_CREDENTIALS` to that path. Alternatively, use Workload Identity Federation if deploying on GCP infrastructure.
4. Confirm Vertex AI API is enabled and `gemini-2.5-flash-preview-04-17` is available in `northamerica-northeast1`.

You can also set these via CLI:

```bash
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add GCP_PROJECT_ID
vercel env add GOOGLE_APPLICATION_CREDENTIALS
vercel env add RESEND_API_KEY
```

After adding environment variables, redeploy:

```bash
vercel deploy --prod
```

## Step 4: Update Supabase Auth Redirect URLs

After deployment, add your Vercel URL to the Supabase auth allowlist. Replace `medfeedbackscribe.vercel.app` with your actual Vercel domain if different.

### Option A: Via Supabase Dashboard

1. Go to your Supabase project > Authentication > URL Configuration
2. Set **Site URL** to `https://medfeedbackscribe.vercel.app`
3. Add `https://medfeedbackscribe.vercel.app/auth/callback` to **Redirect URLs**
4. Keep `http://localhost:3000/auth/callback` in the list for local dev

### Option B: Via API

```bash
SB_TOKEN="your-supabase-service-token"
curl -s -X PATCH "https://api.supabase.com/v1/projects/ppxaixuubymqndlgywlt/config/auth" \
  -H "Authorization: Bearer $SB_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "site_url": "https://medfeedbackscribe.vercel.app",
    "uri_allow_list": "https://medfeedbackscribe.vercel.app/auth/callback,http://localhost:3000/auth/callback"
  }'
```

## Post-Deployment Checklist

- [ ] `vercel login` completed
- [ ] `vercel deploy --prod` succeeded
- [ ] All required environment variables set in Vercel Dashboard
- [ ] Redeployed after setting env vars
- [ ] Supabase auth redirect URLs updated with Vercel domain
- [ ] Verified login flow works on production URL
- [ ] Verified audio recording and transcription works
- [ ] Verified feedback generation completes within timeout
- [ ] Custom domain configured (optional)

## Troubleshooting

### Function timeout errors
The `maxDuration: 120` in `vercel.json` should cover the processing pipeline. If you still hit timeouts, check:
- Vercel plan limits (Hobby plan max is 60s; Pro plan supports up to 300s)
- You may need to upgrade to Vercel Pro for the 120s timeout

### Build failures
- Ensure `bun.lock` is committed to git
- Check that all dependencies are listed in `package.json`

### Auth redirect issues
- Confirm the Vercel URL exactly matches what is in Supabase redirect allowlist
- Check for trailing slashes -- they must match exactly
