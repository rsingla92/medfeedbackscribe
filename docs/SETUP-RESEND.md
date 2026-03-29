# Setting Up Resend as Custom SMTP for Supabase Auth

## Why This Is Needed

Supabase's built-in email service has a hard rate limit of **2 emails per hour** in production.
This means magic links, OTP codes, and invitation emails will silently fail once you exceed
that limit. Configuring a custom SMTP provider removes this restriction entirely.

**Resend** is a developer-friendly email service that works well with Supabase. Their free
tier allows **100 emails/day** and **3,000 emails/month**, which is more than enough for
development and early production.

---

## Step 1: Create a Resend Account

1. Go to [https://resend.com](https://resend.com) and sign up.
2. Verify your email address.

### Free Tier Limits

| Feature              | Free Tier        |
|----------------------|------------------|
| Emails per day       | 100              |
| Emails per month     | 3,000            |
| Custom domains       | Unlimited        |
| Price                | $0               |

Paid plans start at $20/month for 50,000 emails/month.

---

## Step 2: Get Your API Key

1. In the Resend dashboard, go to **API Keys** (left sidebar).
2. Click **Create API Key**.
3. Give it a name (e.g., `supabase-smtp`).
4. Copy the key immediately -- it is only shown once.
5. Store it securely (e.g., in a password manager or `.env.local`).

---

## Step 3: Domain Verification (Optional for Development)

### For Development / Testing

You do **not** need to verify a custom domain to get started. Resend provides a default
sender address:

```
onboarding@resend.dev
```

You can use this address as the "From" email while developing. Emails will be sent from
Resend's shared domain.

### For Production

You **must** verify your own domain to send from a branded address (e.g., `no-reply@yourdomain.com`).

1. In the Resend dashboard, go to **Domains** > **Add Domain**.
2. Enter your domain (e.g., `yourdomain.com`).
3. Resend will provide DNS records to add:
   - **SPF** record (TXT) -- authorizes Resend to send on your behalf
   - **DKIM** record (TXT) -- cryptographic signature for email authenticity
   - **DMARC** record (TXT, optional but recommended)
4. Add these DNS records at your domain registrar / DNS provider.
5. Click **Verify DNS Records** in the Resend dashboard.
6. Wait for verification (usually a few minutes, can take up to 72 hours).

---

## Step 4: Resend SMTP Credentials

These are the SMTP credentials you will enter into Supabase:

| Setting        | Value                      |
|----------------|----------------------------|
| **Host**       | `smtp.resend.com`          |
| **Port**       | `465` (SSL, recommended)   |
| **Username**   | `resend`                   |
| **Password**   | Your Resend API key        |

### Alternative Ports

| Port  | Connection Type        |
|-------|------------------------|
| 465   | SSL (recommended)      |
| 2465  | SSL (alternate)        |
| 587   | TLS (STARTTLS)         |
| 2587  | TLS (alternate)        |
| 25    | Unencrypted (avoid)    |

If you are unsure which port to use, **use 465**.

---

## Step 5: Configure in Supabase Dashboard

1. Go to your Supabase project at [https://supabase.com/dashboard](https://supabase.com/dashboard).
2. Navigate to **Project Settings** (gear icon in sidebar).
3. Click **Authentication** in the left submenu.
4. Scroll down to the **SMTP Settings** section.
5. Toggle **Enable Custom SMTP** to **ON**.
6. Fill in the fields:

   | Field              | Value                                                 |
   |--------------------|-------------------------------------------------------|
   | Sender email       | `onboarding@resend.dev` (dev) or `no-reply@yourdomain.com` (prod) |
   | Sender name        | Your app name (e.g., `MedFeedbackScribe`)             |
   | Host               | `smtp.resend.com`                                     |
   | Port number        | `465`                                                 |
   | Minimum interval   | `0` (or leave default)                                |
   | Username           | `resend`                                              |
   | Password           | Your Resend API key (e.g., `re_xxxxxxxx...`)          |

7. Click **Save**.

---

## Step 6: Test the Configuration

1. In the Supabase dashboard, go to **Authentication** > **Users**.
2. Click **Add user** > **Send invitation**.
3. Enter a test email address.
4. Click **Invite user**.
5. Check the inbox -- you should receive the invitation email within seconds.

Alternatively, trigger a magic link sign-in from your app and confirm the email arrives.

---

## Troubleshooting

### Emails not sending after configuration

- Double-check the API key is correct (no extra spaces).
- Ensure port 465 is selected (some environments block port 25/587).
- Check the Resend dashboard **Logs** section for delivery status.

### "Sender address not allowed" error

- If using a custom domain, ensure it is fully verified in Resend.
- For development, use `onboarding@resend.dev` as the sender.

### Still hitting rate limits

- Confirm that "Enable Custom SMTP" is toggled ON and saved.
- The Supabase default rate limit only applies to the built-in mailer, not custom SMTP.

---

## Summary

| Item                          | Value / Notes                              |
|-------------------------------|--------------------------------------------|
| Resend free tier              | 100/day, 3,000/month                       |
| SMTP host                     | `smtp.resend.com`                          |
| SMTP port                     | `465`                                      |
| SMTP username                 | `resend`                                   |
| SMTP password                 | Your Resend API key                        |
| Domain verification required? | No (use `onboarding@resend.dev` for dev)   |
| Domain verification for prod? | Yes (SPF + DKIM DNS records)               |
| Supabase config location      | Project Settings > Authentication > SMTP   |

---

## References

- [Resend SMTP with Supabase (Resend docs)](https://resend.com/docs/send-with-supabase-smtp)
- [Supabase Custom SMTP Guide](https://supabase.com/docs/guides/auth/auth-smtp)
- [Resend SMTP Credentials](https://resend.com/docs/send-with-smtp)
- [Resend Domain Management](https://resend.com/docs/dashboard/domains/introduction)
- [Resend Pricing](https://resend.com/pricing)
- [Resend + Supabase Integration](https://supabase.com/partners/integrations/resend)
