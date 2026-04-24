import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";

const FROM_EMAIL =
  process.env.SES_FROM_EMAIL ?? "noreply@debrief.whitecoatprep.com";
const REGION = process.env.AWS_REGION ?? "ca-central-1";

let _client: SESv2Client | null = null;
function client(): SESv2Client {
  if (!_client) _client = new SESv2Client({ region: REGION });
  return _client;
}

interface SendVerificationRequestParams {
  identifier: string;
  url: string;
  expires: Date;
  provider: { from?: string };
}

export async function sendMagicLinkEmail({
  identifier,
  url,
}: SendVerificationRequestParams): Promise<void> {
  const { host } = new URL(url);
  const subject = `Your Debrief sign-in link`;

  const html = `<!doctype html>
<html>
<body style="margin:0;padding:0;background:#faf8f5;font-family:'DM Sans',-apple-system,system-ui,sans-serif;color:#1c1917;">
  <div style="max-width:480px;margin:0 auto;padding:48px 24px;">
    <h1 style="font-family:'Instrument Serif',Georgia,serif;font-size:36px;font-weight:400;line-height:1.1;letter-spacing:-0.01em;margin:0 0 24px;">
      Sign in to Debrief
    </h1>
    <p style="font-size:16px;line-height:1.6;margin:0 0 32px;color:#44403c;">
      Click the button below to sign in to ${escapeHtml(host)}. This link will
      expire in 24 hours and can only be used once.
    </p>
    <p style="margin:0 0 32px;">
      <a href="${url}"
         style="display:inline-block;background:#D97706;color:#ffffff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:500;font-size:16px;">
        Sign in to Debrief
      </a>
    </p>
    <p style="font-size:14px;line-height:1.6;color:#78716c;margin:0 0 8px;">
      Or copy and paste this URL into your browser:
    </p>
    <p style="font-size:13px;line-height:1.5;color:#78716c;word-break:break-all;margin:0 0 32px;">
      ${url}
    </p>
    <hr style="border:0;border-top:1px solid #e7e5e4;margin:32px 0;" />
    <p style="font-size:13px;line-height:1.5;color:#a8a29e;margin:0;">
      If you did not request this email, you can safely ignore it.
    </p>
  </div>
</body>
</html>`;

  const text = `Sign in to Debrief

Click this link to sign in to ${host}:

${url}

This link will expire in 24 hours. If you did not request this email, you can safely ignore it.`;

  await client().send(
    new SendEmailCommand({
      FromEmailAddress: FROM_EMAIL,
      Destination: { ToAddresses: [identifier] },
      Content: {
        Simple: {
          Subject: { Data: subject, Charset: "UTF-8" },
          Body: {
            Html: { Data: html, Charset: "UTF-8" },
            Text: { Data: text, Charset: "UTF-8" },
          },
        },
      },
    }),
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
