/**
 * Human error copy. Every user-visible failure should go through one of
 * these helpers so messages have a consistent shape:
 *
 *   { title, description, action? }
 *
 * `title` is the one-line banner, `description` is what's actually wrong
 * and what to do about it, and `action` is an optional CTA.
 */

export interface ErrorCopy {
  /** One short sentence — what failed. */
  title: string;
  /** What to do about it. Prefer specific, actionable. */
  description: string;
  /** Optional CTA rendered as a button-style link. */
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
}

// ── Microphone / recording errors ─────────────────────────────────────────────

export function micError(err: unknown): ErrorCopy {
  if (err instanceof DOMException) {
    if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
      return {
        title: "Microphone access is blocked",
        description:
          "Debrief needs your microphone to record feedback. Click the lock icon in your browser's address bar, allow microphone access for this site, then try again.",
        action: { label: "Try again" },
      };
    }
    if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
      return {
        title: "No microphone detected",
        description:
          "We couldn't find a microphone on this device. Plug one in or check your system's audio settings, then try again.",
        action: { label: "Try again" },
      };
    }
    if (err.name === "NotReadableError" || err.name === "TrackStartError") {
      return {
        title: "Microphone is already in use",
        description:
          "Another app (a video call, voice memo, screen recorder) is using your microphone. Close that app and try again.",
        action: { label: "Try again" },
      };
    }
  }
  return {
    title: "Couldn't start recording",
    description:
      "Something went wrong accessing the microphone. Reload the page and try again; if it keeps happening, email hello@whitecoatprep.com.",
    action: { label: "Reload page", onClick: () => window.location.reload() },
  };
}

// ── Network / upload errors ───────────────────────────────────────────────────

export function uploadError(err: unknown): ErrorCopy {
  const message = err instanceof Error ? err.message : String(err);
  if (!navigator.onLine) {
    return {
      title: "You're offline",
      description:
        "Your recording is safe on this device, but we couldn't upload it. Reconnect to Wi-Fi or cellular and try again — nothing has been lost.",
      action: { label: "Try again" },
    };
  }
  if (/413|too large/i.test(message)) {
    return {
      title: "Recording is too long to upload",
      description:
        "This recording exceeds our upload size. Shorter recordings (a few minutes) are the sweet spot. Contact us if you need to keep this one: hello@whitecoatprep.com.",
    };
  }
  if (/401|403|unauth/i.test(message)) {
    return {
      title: "You've been signed out",
      description:
        "Your session timed out while the recording was in progress. Sign in again — your draft is preserved locally and will upload on the next try.",
      action: { label: "Sign in", href: "/auth" },
    };
  }
  return {
    title: "Upload didn't finish",
    description:
      "The recording was captured but couldn't reach our servers. Check your connection and try again — the audio is still on this device.",
    action: { label: "Try again" },
  };
}

// ── Fetch / load errors (for lists, settings, etc.) ───────────────────────────

export function loadError(what: string, retry?: () => void): ErrorCopy {
  return {
    title: `Couldn't load ${what}`,
    description:
      "This is usually a network hiccup. Try again in a few seconds, or reload the page if it keeps happening.",
    action: retry ? { label: "Try again", onClick: retry } : undefined,
  };
}

// ── Save errors ───────────────────────────────────────────────────────────────

export function saveError(what: string): ErrorCopy {
  return {
    title: `Couldn't save ${what}`,
    description:
      "Your changes are still here on this page, but they didn't reach the server. Try saving again. If it keeps failing, leave the page open and email hello@whitecoatprep.com.",
    action: { label: "Try again" },
  };
}

// ── Export errors ─────────────────────────────────────────────────────────────

export function exportError(format: "PDF" | "CSV", hint?: string): ErrorCopy {
  return {
    title: `${format} export failed`,
    description:
      hint ??
      "The server couldn't build the export. Try once more; if it keeps failing, email hello@whitecoatprep.com with the session ID so we can help.",
    action: { label: "Try again" },
  };
}

// ── Reprocess errors ──────────────────────────────────────────────────────────

export function reprocessError(apiMessage?: string): ErrorCopy {
  // Honour specific conflict messages the API returns (e.g., 5-min recency guard)
  if (apiMessage && /5 minutes/i.test(apiMessage)) {
    return {
      title: "Wait a moment before retrying",
      description:
        "This session was updated less than 5 minutes ago — give the pipeline a chance to finish before starting it over.",
    };
  }
  if (apiMessage && /cannot be reprocessed/i.test(apiMessage)) {
    return {
      title: "This session isn't stuck",
      description:
        "Reprocess is only available for sessions that are still processing or failed. If you want to redo an already-ready session, record a new one.",
    };
  }
  return {
    title: "Couldn't start reprocessing",
    description:
      apiMessage ??
      "The server couldn't re-queue this session. Wait a minute and try again; if the issue persists, email hello@whitecoatprep.com.",
    action: { label: "Try again" },
  };
}

// ── Auth errors ───────────────────────────────────────────────────────────────

export function authError(code: string | undefined): ErrorCopy {
  switch (code) {
    case "Verification":
      return {
        title: "This sign-in link has expired",
        description:
          "Sign-in links are valid for 24 hours and can only be used once. Request a new one below — it'll arrive in your inbox in a few seconds.",
        action: { label: "Request new link" },
      };
    case "EmailSignin":
      return {
        title: "We couldn't send the sign-in email",
        description:
          "Our email service didn't accept the request. Double-check the address, or try signing in with Google instead.",
        action: { label: "Try again" },
      };
    case "AccessDenied":
      return {
        title: "Access denied",
        description:
          "This email isn't yet approved for Debrief. If you're a resident in a piloting program, email your program administrator to be added.",
      };
    case "OAuthAccountNotLinked":
      return {
        title: "This email is already linked to a different sign-in method",
        description:
          "You previously signed in with a different option (magic link or Google). Use the same method you used originally.",
      };
    case "Configuration":
      return {
        title: "Sign-in is misconfigured",
        description:
          "Something is wrong on our end, not yours. Please email hello@whitecoatprep.com so we can look into it.",
      };
    default:
      return {
        title: "Something went wrong signing in",
        description:
          "Give it another try. If it keeps failing, email hello@whitecoatprep.com and tell us what you tried.",
        action: { label: "Try again" },
      };
  }
}
