// Readiness probe — verifies the DB is reachable.
//
// Unlike /api/health (liveness), this endpoint pings Postgres. Returns 503
// on failure. Not wired to App Runner's health check — use for ad-hoc
// operational checks.
import { sql } from "@/lib/db/client";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await sql`select 1 as ok`;
    return Response.json(
      { status: "ready", time: new Date().toISOString() },
      { status: 200 },
    );
  } catch (err) {
    return Response.json(
      {
        status: "not-ready",
        time: new Date().toISOString(),
        error: err instanceof Error ? err.message : "unknown",
      },
      { status: 503 },
    );
  }
}
