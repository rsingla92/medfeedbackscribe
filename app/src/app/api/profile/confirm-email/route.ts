/**
 * GET /api/profile/confirm-email?token=<base64url>
 *
 * Redeems a single-use email-change token issued during onboarding. On
 * success, profiles.pending_email is promoted to profiles.email and the
 * token is cleared. The endpoint intentionally returns HTML (not JSON)
 * because the request comes from a link in a transactional email —
 * whoever clicks is a human looking at a browser tab, not an API client.
 *
 * This is a GET and therefore NOT CSRF-protected; that's fine because the
 * action is scoped to "promote a value that I the user chose" and requires
 * knowledge of a 256-bit random token. An attacker who can deliver a
 * confirmation link to the target victim already has the token and has
 * therefore already compromised the victim's inbox.
 */

import { NextRequest } from "next/server";
import { confirmProfileEmailByToken } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

// Minimal HTML shell that matches the app's visual language (Instrument
// Serif headline, DM Sans body, amber accent). Defined once and parametrized
// so the three result branches stay visually consistent.
function page(opts: {
  status: number;
  title: string;
  body: string;
}): Response {
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${escapeHtml(opts.title)} · Debrief</title>
  <style>
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body {
      background: #faf8f5;
      color: #1c1917;
      font-family: 'DM Sans', -apple-system, system-ui, sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .card {
      background: #ffffff;
      border: 1px solid #e7e5e4;
      border-radius: 12px;
      max-width: 440px;
      width: 100%;
      padding: 40px 32px;
      text-align: center;
    }
    h1 {
      font-family: 'Instrument Serif', Georgia, serif;
      font-weight: 400;
      font-size: 32px;
      line-height: 1.15;
      letter-spacing: -0.01em;
      margin: 0 0 16px;
    }
    p { font-size: 16px; line-height: 1.6; color: #44403c; margin: 0 0 20px; }
    .muted { color: #78716c; font-size: 14px; }
    .accent { color: #D97706; font-weight: 600; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${escapeHtml(opts.title)}</h1>
    ${opts.body}
  </div>
</body>
</html>`;

  return new Response(html, {
    status: opts.status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // This page must never be cached — the token is single-use.
      "Cache-Control": "no-store",
    },
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");

  if (!token || typeof token !== "string" || token.length < 16) {
    return page({
      status: 400,
      title: "Link invalid",
      body: `<p>This confirmation link is missing or malformed. Request a new one from your onboarding or profile page.</p>`,
    });
  }

  let userId: string | null;
  try {
    userId = await confirmProfileEmailByToken(token);
  } catch (err) {
    console.error("confirm-email redeem error:", err);
    return page({
      status: 500,
      title: "Something went wrong",
      body: `<p>We couldn't confirm your email right now. Try the link again in a minute — if it keeps failing, email <span class="accent">hello@whitecoatprep.com</span>.</p>`,
    });
  }

  if (!userId) {
    // Could be expired, already-used, or never-issued. We can't distinguish
    // from the DB result alone without leaking state, so treat these the
    // same — prompt the user to start over. Returning 404 here is a
    // deliberate signal for log triage.
    return page({
      status: 404,
      title: "Link invalid or already used",
      body: `<p>This confirmation link has already been redeemed, or it expired (links are good for 24 hours).</p>
             <p class="muted">Sign back into Debrief and re-enter your email in profile settings to get a fresh link.</p>`,
    });
  }

  return page({
    status: 200,
    title: "Email confirmed",
    body: `<p>Your notification email is now confirmed. Coaching-note notifications will arrive at this address going forward.</p>
           <p class="muted">You can close this tab and go back to Debrief.</p>`,
  });
}
