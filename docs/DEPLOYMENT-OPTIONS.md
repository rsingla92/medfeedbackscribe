# MedScribe Deployment Options

**Last updated:** 2026-03-28

## Context

MedScribe is a Next.js 16 application with a Supabase backend (already deployed to `ca-central-1`). The app handles medical feedback data, including audio file uploads that go through a 30-60 second processing pipeline. Canadian data residency is strongly preferred. Budget target: free tier or under $20/month for pilot.

Next.js 16 shipped October 2025, with 16.2 released March 2026. All major hosting platforms support it.

---

## 1. Vercel (Recommended for Pilot)

**Canadian Region:** Yes -- Montreal (`yul1`) available for both Edge Network and Serverless Functions. Functions can be pinned to `yul1` via project settings or `vercel.json`.

**Next.js 16 Support:** First-class. Vercel is the creator of Next.js. App Router, Server Components, Fluid Compute all fully supported.

### Plans

| Feature | Hobby (Free) | Pro ($20/user/mo) |
|---|---|---|
| Bandwidth | 100 GB/mo | 1 TB/mo |
| Function Invocations | 1M/mo | 1M/mo (then $0.60/1M) |
| Function Duration (max) | 300s (5 min) | 800s (13 min) with Fluid Compute |
| Function Memory | 2 GB | Up to 4 GB |
| CPU Hours | 4 hrs/mo | 16 hrs/mo |
| Regions | Single region | Single region (Enterprise for multi) |
| Commercial Use | **NO -- personal/non-commercial only** | Yes |

### Long-Running Routes (30-60s pipeline)

No problem. Hobby allows up to 300 seconds (5 minutes). The 30-60 second pipeline fits comfortably within both tiers.

### Audio File Uploads

Vercel Functions have a **4.5 MB request body limit**. For audio uploads:
- Upload directly from client to **Supabase Storage** (already in `ca-central-1`), bypassing Vercel Functions entirely.
- Or use Vercel Blob with client-side uploads.
- This is the recommended pattern regardless of hosting -- keep large files out of serverless functions.

### PIPEDA / Privacy Concerns

- **Hobby plan cannot be used** -- it prohibits commercial use. A medical SaaS product requires Pro ($20/mo).
- Montreal region keeps function execution in Canada.
- Static assets are served from the global Edge Network (CDN), but these contain no PHI -- only compiled JS/CSS/HTML.
- Actual patient data stays in Supabase (`ca-central-1`) and Vercel Functions (`yul1`).
- PIPEDA does not prohibit cross-border transfers outright, but requires "comparable level of protection." Keeping compute + data in Canada is the safest posture.

### Verdict

**Best option if budget allows $20/mo.** Native Next.js support, Canadian region, generous limits, zero DevOps. The Hobby tier cannot be used for a commercial medical product.

---

## 2. Fly.io

**Canadian Region:** Toronto (`yyz`) is available as a gateway region. Apps can be deployed to `yyz`.

**Next.js 16 Support:** Yes, via Docker. Fly.io runs containerized apps. Next.js `output: "standalone"` in `next.config.js` produces an optimized Docker image. Official Next.js + Fly.io templates exist.

### Pricing

| Resource | Cost |
|---|---|
| Shared 1-CPU, 256 MB VM | ~$1.94/mo (continuous) |
| Shared 1-CPU, 512 MB VM | ~$3.88/mo (continuous) |
| Shared 1-CPU, 1 GB VM | ~$7.76/mo (continuous) |
| Persistent Volume | $0.15/GB/mo |
| Outbound Transfer | $0.02/GB (NA) |
| **Free Tier** | **None.** 2 VM-hour trial only (or 7 days, whichever first). |

A small Next.js app with 1 GB RAM would cost roughly **$8-10/mo** in Toronto.

### Long-Running Routes

No function timeout limits -- it is a full VM. The 30-60 second pipeline runs natively with no special configuration.

### Audio File Uploads

No body size limits imposed by the platform. However, the recommended pattern remains: upload directly to Supabase Storage from the client.

### PIPEDA / Privacy Concerns

- Fly.io is a US company. Toronto region keeps compute in Canada.
- Data in transit passes through Fly.io's network, which is US-operated.
- Supabase data stays in `ca-central-1` regardless.
- Review Fly.io's DPA (Data Processing Agreement) for PIPEDA compliance.

### Verdict

**Good budget option (~$8-10/mo)** with Canadian region. Requires Docker knowledge and more DevOps than Vercel. No free tier for new users.

---

## 3. Railway

**Canadian Region:** **No.** Railway operates data centers in US, EU, and Asia only. No Canadian regions available.

**Next.js 16 Support:** Yes, via auto-detection or Docker. Railway detects Next.js projects and builds them automatically.

### Pricing

| Plan | Cost | Included |
|---|---|---|
| Free Trial | $5 credit, 30 days | Limited |
| Hobby | $5/mo | $5 in usage credits |
| Pro | $20/mo | $20 in usage credits |

Usage is billed per-second for CPU, RAM, storage, and network.

### Long-Running Routes

Full container runtime -- no function timeout limits. Pipeline runs natively.

### PIPEDA / Privacy Concerns

- **No Canadian region.** Data processing happens in US data centers.
- PIPEDA permits cross-border transfer with adequate safeguards, but for medical data this is a weaker compliance posture.
- The actual patient data in Supabase remains in `ca-central-1`.

### Verdict

**Not recommended** due to lack of Canadian regions. Affordable and easy to use, but the US-only compute is a compliance concern for medical data.

---

## 4. Render

**Canadian Region:** **No.** Render operates in Oregon, Ohio, Virginia (US), Frankfurt (EU), and Singapore. No Canadian region.

**Next.js 16 Support:** Yes, via Docker or auto-detection. Handles SSL, CDN, and auto-deploys from Git.

### Pricing

| Plan | Cost |
|---|---|
| Free Tier | Static sites only. Web services spin down after inactivity. |
| Starter | $7/mo per web service |
| Standard | $25/mo per web service |

### Long-Running Routes

Web services on paid plans have no strict function timeout. Free tier services spin down after 15 minutes of inactivity (cold starts of ~30s).

### PIPEDA / Privacy Concerns

- **No Canadian region.** Same concerns as Railway.
- Oregon (US West) is the closest available region to western Canada.

### Verdict

**Not recommended** for the same reason as Railway -- no Canadian data residency for compute.

---

## 5. Self-Hosted on Canadian VPS

### Option A: DigitalOcean Toronto (`tor1`)

| Plan | Specs | Cost |
|---|---|---|
| Basic Droplet | 1 vCPU, 512 MB, 10 GB SSD | $4/mo |
| Basic Droplet | 1 vCPU, 1 GB, 25 GB SSD | $6/mo |
| Basic Droplet | 1 vCPU, 2 GB, 50 GB SSD | $12/mo |

- Toronto data center ensures Canadian data residency.
- Official Next.js + DigitalOcean Docker template available.
- Per-second billing as of January 2026.
- App Platform also available starting at $5/mo (but check if Toronto region is supported for App Platform).

### Option B: OVH Montreal

| Plan | Cost |
|---|---|
| VPS Starter | ~$6.50 CAD/mo |
| VPS Value | ~$10/mo CAD |

- Montreal data center -- fully Canadian.
- OVH is a French/Canadian company with strong data sovereignty positioning.
- Less polished developer experience than DigitalOcean.

### Self-Hosting Requirements

You must manage:
- Docker / Node.js installation
- Nginx or Caddy reverse proxy
- SSL certificates (Let's Encrypt / Caddy auto-TLS)
- Process management (PM2, systemd, or Docker Compose)
- Security updates and firewall
- Backups
- CI/CD pipeline (GitHub Actions -> SSH deploy)

### Long-Running Routes

No platform-imposed limits. Full control over timeouts.

### Audio File Uploads

No body size limits imposed by the platform. Still recommend direct-to-Supabase uploads from the client.

### PIPEDA / Privacy Concerns

- **Strongest compliance posture.** All compute and data remain in Canada.
- You are responsible for security, encryption, and access controls.
- DigitalOcean is a US company with Canadian data centers. OVH is EU/Canadian.

### Verdict

**Cheapest option ($4-12/mo)** with the strongest Canadian data residency story. Significant operational overhead -- not ideal for a solo developer in pilot phase unless you are comfortable with DevOps.

---

## Comparison Matrix

| Criteria | Vercel Pro | Fly.io (Toronto) | Railway | Render | DO Toronto VPS | OVH Montreal VPS |
|---|---|---|---|---|---|---|
| **Canadian Region** | Yes (Montreal) | Yes (Toronto) | No | No | Yes (Toronto) | Yes (Montreal) |
| **Next.js 16** | Native | Docker | Auto/Docker | Auto/Docker | Docker | Docker |
| **Monthly Cost** | $20 | ~$8-10 | $5-20 | $7-25 | $6-12 | $6.50-10 CAD |
| **Free Tier** | No (commercial) | No | 30-day trial | Static only | No | No |
| **60s Pipeline** | Yes (300s max) | Yes (no limit) | Yes (no limit) | Yes (paid) | Yes (no limit) | Yes (no limit) |
| **Audio Uploads** | 4.5MB body limit* | No limit | No limit | No limit | No limit | No limit |
| **DevOps Required** | None | Low-Medium | Low | Low | High | High |
| **PIPEDA Posture** | Strong | Good | Weak | Weak | Strongest | Strongest |

*Audio uploads should go direct to Supabase Storage regardless of platform.

---

## Recommendation

### For Pilot Phase (Now)

**Vercel Pro at $20/mo** is the best balance of:
- Zero DevOps overhead
- Native Next.js 16 support with latest features
- Montreal (`yul1`) region for Canadian data residency
- 300-second function timeout (more than enough for the 60s pipeline)
- Fluid Compute for better cold start performance

Configuration:
```json
// vercel.json
{
  "regions": ["yul1"]
}
```

Audio uploads should go directly from the browser to Supabase Storage in `ca-central-1`, not through Vercel Functions.

### Budget Alternative

**Fly.io in Toronto** at ~$8-10/mo if the $20/mo Vercel Pro cost is a concern. Requires Docker knowledge and slightly more setup.

### Future Scale

If the app grows beyond pilot, consider:
- Staying on Vercel Pro (scales automatically)
- Moving to a DigitalOcean Toronto Droplet ($12/mo) or Kubernetes for full control
- Evaluating Vercel Enterprise for multi-region and advanced compliance features

---

## Sources

- [Vercel Montreal Region (yul1) Announcement](https://vercel.com/changelog/introducing-the-montreal-canada-vercel-region-yul1)
- [Vercel Functions Limits](https://vercel.com/docs/functions/limitations)
- [Vercel Pricing](https://vercel.com/pricing)
- [Vercel Hobby Plan](https://vercel.com/docs/plans/hobby)
- [Vercel Regions Configuration](https://vercel.com/guides/choosing-deployment-regions)
- [Vercel Body Size Limit Bypass](https://vercel.com/kb/guide/how-to-bypass-vercel-body-size-limit-serverless-functions)
- [Fly.io Pricing](https://fly.io/docs/about/pricing/)
- [Fly.io Regions](https://fly.io/docs/reference/regions/)
- [Fly.io Next.js Deployment](https://fly.io/docs/js/frameworks/nextjs/)
- [Railway Deployment Regions](https://docs.railway.com/reference/deployment-regions)
- [Railway Pricing](https://docs.railway.com/pricing)
- [Render Regions](https://render.com/docs/regions)
- [DigitalOcean Droplet Pricing](https://www.digitalocean.com/pricing)
- [DigitalOcean Next.js Deployment Guide](https://www.digitalocean.com/community/developer-center/deploying-a-next-js-application-on-a-digitalocean-droplet)
- [OVH VPS Pricing](https://us.ovhcloud.com/vps/)
- [PIPEDA Cross-Border Transfer Guidelines](https://www.priv.gc.ca/en/privacy-topics/airports-and-borders/gl_dab_090127/)
- [PIPEDA Compliance Guide 2026](https://geotargetly.com/blog/pipeda-compliance-guide-to-canada-privacy-law)
- [Next.js 16 Release](https://nextjs.org/blog/next-16)
