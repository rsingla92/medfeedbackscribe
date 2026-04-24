// Liveness probe for AWS App Runner.
//
// App Runner polls this endpoint and replaces the instance if it does not
// return HTTP 200. We intentionally do NOT check Supabase / RDS / S3 here:
// a brief upstream blip should not cause App Runner to tear down the
// container and spin up a new one — replacing instances during a DB hiccup
// makes the situation strictly worse.
//
// For a DB-dependent probe (readiness), see `/api/ready`.
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(
    { status: "ok", time: new Date().toISOString() },
    { status: 200 }
  );
}
