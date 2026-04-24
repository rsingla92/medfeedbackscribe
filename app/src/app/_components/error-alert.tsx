"use client";

import Link from "next/link";
import type { ErrorCopy } from "@/lib/errors";

/**
 * Consistent user-facing error banner.
 *
 * Usage: <ErrorAlert copy={errorCopy} onDismiss={...} />
 *
 * Shows: title (bold), description (muted), optional CTA, optional dismiss.
 * Always rendered as a card so it reads as "something to deal with", not
 * inline flavor text.
 */
export function ErrorAlert({
  copy,
  onDismiss,
  tone = "error",
  className,
}: {
  copy: ErrorCopy;
  onDismiss?: () => void;
  tone?: "error" | "warning";
  className?: string;
}) {
  const bg = tone === "warning" ? "bg-warning-bg" : "bg-error-bg";
  const fg = tone === "warning" ? "text-warning" : "text-error";
  const Icon = tone === "warning" ? WarningIcon : AlertIcon;

  const action = copy.action;
  const handleAction = () => action?.onClick?.();

  return (
    <div
      role="alert"
      className={`rounded-[var(--radius-lg)] border border-border ${bg} p-4 ${className ?? ""}`}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${fg}`}
        >
          <Icon />
        </span>
        <div className="flex-1 space-y-1.5">
          <p className={`text-sm font-semibold ${fg}`}>{copy.title}</p>
          <p className="text-sm leading-relaxed text-foreground">
            {copy.description}
          </p>
          {(action || onDismiss) && (
            <div className="flex flex-wrap items-center gap-3 pt-1">
              {action &&
                (action.href ? (
                  <Link
                    href={action.href}
                    className={`inline-flex h-9 items-center rounded-[var(--radius-md)] border border-current bg-transparent px-4 text-sm font-semibold ${fg}`}
                  >
                    {action.label}
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={handleAction}
                    className={`inline-flex h-9 items-center rounded-[var(--radius-md)] border border-current bg-transparent px-4 text-sm font-semibold ${fg}`}
                  >
                    {action.label}
                  </button>
                ))}
              {onDismiss && (
                <button
                  type="button"
                  onClick={onDismiss}
                  className="text-sm font-medium text-muted underline underline-offset-2"
                >
                  Dismiss
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AlertIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
      <path
        fillRule="evenodd"
        d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
      <path
        fillRule="evenodd"
        d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25ZM12 6a.75.75 0 0 1 .75.75v5a.75.75 0 0 1-1.5 0v-5A.75.75 0 0 1 12 6Zm0 10.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z"
        clipRule="evenodd"
      />
    </svg>
  );
}
