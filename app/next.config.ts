import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit `.next/standalone/server.js` so the Docker runtime stage can run
  // the app without the full node_modules tree. Required for AWS App Runner.
  output: "standalone",
  // Pin the file-tracing root to this directory. Without this, Next.js walks
  // up the filesystem looking for a lockfile and mis-infers the workspace
  // root (producing `.next/standalone/Users/.../server.js`), which breaks
  // our Dockerfile's COPY paths.
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
