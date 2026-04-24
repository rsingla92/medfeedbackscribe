import { NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
import { auth } from "@/lib/auth";
import {
  upsertProfile,
  upsertProfilePendingEmail,
} from "@/lib/db/queries";
import { sendEmailChangeConfirmation } from "@/lib/email/send-verify";

/** 24 hours, in milliseconds — matches the magic-link TTL for consistency. */
const PENDING_EMAIL_TTL_MS = 24 * 60 * 60 * 1000;

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/**
 * Case-insensitive email comparison. Emails are compared by their normalized
 * (trimmed + lowercased) form so "jane@UBC.ca" and "jane@ubc.ca" count as
 * the same address. We do NOT normalize the local part beyond lowercasing
 * — subaddressing ("jane+debrief@ubc.ca") and the authenticated address are
 * treated as distinct intentionally; a resident who wants notifications at
 * a tagged address should go through the verification flow.
 */
function emailsMatch(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as {
      full_name?: string;
      email?: string;
      program?: string | null;
      specialty?: string | null;
      year_of_training?: number | null;
      site?: string | null;
    };

    const fullName = body.full_name?.trim();
    if (!fullName) {
      return Response.json({ error: "Full name required" }, { status: 400 });
    }

    const email = body.email?.trim();
    if (!email || !isValidEmail(email)) {
      return Response.json(
        { error: "A valid institutional email is required" },
        { status: 400 },
      );
    }

    const authEmail = session.user.email ?? "";
    const matchesAuthEmail =
      authEmail !== "" && emailsMatch(email, authEmail);

    // Common profile fields written in both branches. Email is handled
    // separately below depending on whether it matches the authenticated
    // address.
    const profilePatch = {
      full_name: fullName,
      program: body.program ?? null,
      specialty: body.specialty ?? null,
      year_of_training: body.year_of_training ?? null,
      site: body.site ?? null,
    };

    if (matchesAuthEmail) {
      // Fast path: the provided email is the same one the user just signed
      // in with (already proven via magic link / OAuth). Write it straight
      // through.
      await upsertProfile(session.user.id, { ...profilePatch, email });
      return Response.json({ ok: true, pending: false }, { status: 200 });
    }

    // Divergent path: the resident wants notifications at an address other
    // than the one they signed in with. Stash it as pending, email a
    // single-use confirmation link, and leave profiles.email alone so the
    // Lambda keeps sending to whatever was previously verified (or nothing
    // until the first confirmation lands).
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + PENDING_EMAIL_TTL_MS);

    // Persist the other onboarding fields first so UX doesn't lose them if
    // the SES call fails. We intentionally skip email here — pending_email
    // is staged separately.
    await upsertProfile(session.user.id, profilePatch);
    await upsertProfilePendingEmail(
      session.user.id,
      email,
      token,
      expiresAt,
    );

    try {
      await sendEmailChangeConfirmation({
        to: email,
        token,
        residentName: fullName,
      });
    } catch (mailErr) {
      // The token is already persisted — the resident can re-trigger via a
      // future "resend" control. Surface a soft error so the UI can tell
      // them.
      console.error(
        "Failed to dispatch email-change confirmation:",
        mailErr instanceof Error ? mailErr.message : mailErr,
      );
      return Response.json(
        {
          ok: true,
          pending: true,
          email_send_failed: true,
        },
        { status: 200 },
      );
    }

    return Response.json(
      { ok: true, pending: true, email_send_failed: false },
      { status: 200 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    console.error("Onboarding route error:", message);
    return Response.json({ error: "Failed to save profile" }, { status: 500 });
  }
}
