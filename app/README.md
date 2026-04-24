This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Docker build + local run

The app ships as a container for AWS App Runner (`ca-central-1`). The
Dockerfile uses Next.js `output: 'standalone'` and runs as a non-root user.

```bash
# Build the image (from the app/ directory)
docker build -t debrief-web .

# Run locally — env vars come from .env.local (see .env.local.example)
docker run --rm -p 3000:3000 --env-file .env.local debrief-web
```

The container serves `/api/health` with HTTP 200, which App Runner uses as
its health check.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deployment

The app deploys to AWS App Runner via the GitHub Actions workflow at
`.github/workflows/deploy.yml`. Every push to `master` builds a new image,
pushes it to ECR (`debrief-web`), and App Runner rolls it out automatically.
