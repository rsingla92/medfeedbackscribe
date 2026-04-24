"use client";

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type ChangeEvent,
} from "react";
import { useRouter } from "next/navigation";
import type { SessionData, Assessment } from "./page";
import { ErrorAlert } from "@/app/_components/error-alert";
import {
  saveError as saveErrorCopy,
  exportError as exportErrorCopy,
  reprocessError as reprocessErrorCopy,
  type ErrorCopy,
} from "@/lib/errors";

// ── Transcript formatter ──────────────────────────────────────────────────────
// Detects "Speaker:" prefixes (Preceptor, Resident, Trainee, Attending, etc.)
// and highlights them. Falls back to plain paragraphs for unlabeled text.

const SPEAKER_PATTERN = /^([A-Z][a-zA-Z][a-zA-Z \-/]{1,30}?):\s*(.*)$/;
const PRECEPTOR_SPEAKERS = new Set([
  "preceptor",
  "attending",
  "staff",
  "supervisor",
]);

function FormattedTranscript({ text }: { text: string }) {
  // Split into turns: a new turn starts on a blank line OR a line that
  // begins with "Speaker:". Accept either convention.
  const lines = text.split(/\r?\n/);
  const turns: { speaker: string | null; body: string }[] = [];
  let current: { speaker: string | null; body: string } | null = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      if (current) {
        turns.push(current);
        current = null;
      }
      continue;
    }
    const match = line.match(SPEAKER_PATTERN);
    if (match) {
      if (current) turns.push(current);
      current = { speaker: match[1], body: match[2] };
    } else if (current) {
      current.body += " " + line;
    } else {
      current = { speaker: null, body: line };
    }
  }
  if (current) turns.push(current);

  if (turns.every((t) => t.speaker === null)) {
    // No speaker labels detected — render as one block.
    return (
      <p className="text-sm italic text-muted leading-relaxed whitespace-pre-wrap">
        {text}
      </p>
    );
  }

  return (
    <div className="space-y-3 text-sm leading-relaxed">
      {turns.map((turn, i) => (
        <p key={i} className="text-foreground">
          {turn.speaker && (
            <span
              className={`font-semibold ${
                PRECEPTOR_SPEAKERS.has(turn.speaker.toLowerCase())
                  ? "text-accent"
                  : "text-foreground"
              }`}
            >
              {turn.speaker}:
            </span>
          )}{" "}
          <span className="text-muted">{turn.body}</span>
        </p>
      ))}
    </div>
  );
}

// ── Processing State ───────────────────────────────────────────────────────────

function ProcessingView({
  pipelineStep,
  onRetry,
  failed,
  stuck,
  transcriptPreview,
  reprocessing,
  reprocessError,
}: {
  pipelineStep: string | null;
  onRetry: () => void;
  failed: boolean;
  stuck: boolean;
  transcriptPreview: string | null;
  reprocessing: boolean;
  reprocessError: ErrorCopy | null;
}) {
  const steps = [
    { key: "stt", label: "Transcribing audio" },
    { key: "phi_scrub", label: "De-identifying transcript" },
    { key: "extract", label: "Analyzing feedback" },
  ];

  if (failed || stuck) {
    const isStuck = stuck && !failed;
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-6">
        <div
          className={`flex h-16 w-16 items-center justify-center rounded-full ${
            isStuck ? "bg-warning-bg" : "bg-error-bg"
          }`}
        >
          {isStuck ? (
            <svg
              className="h-8 w-8 text-warning"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
              />
            </svg>
          ) : (
            <svg
              className="h-8 w-8 text-error"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
              />
            </svg>
          )}
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-lg font-semibold text-foreground">
            {isStuck ? "Taking longer than expected" : "Processing failed"}
          </h2>
          <p className="text-sm text-muted max-w-xs">
            {isStuck
              ? "This is taking longer than usual. If it's been more than 5 minutes, you can retry."
              : "Something went wrong while analyzing your recording. You can retry the processing."}
          </p>
        </div>
        {reprocessError && (
          <div className="w-full max-w-md">
            <ErrorAlert copy={reprocessError} />
          </div>
        )}
        <button
          type="button"
          onClick={onRetry}
          disabled={reprocessing}
          className="rounded-[var(--radius-md)] bg-accent px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {reprocessing
            ? "Starting..."
            : isStuck
              ? "Looks stuck — retry?"
              : "Retry processing"}
        </button>
      </div>
    );
  }

  const currentIdx = steps.findIndex((s) => s.key === pipelineStep);

  return (
    <div className="flex flex-col items-center justify-center py-16 space-y-8">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent-light">
        <svg
          className="h-8 w-8 animate-spin text-accent"
          viewBox="0 0 24 24"
          fill="none"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      </div>

      <div className="space-y-4 w-full max-w-xs">
        {steps.map((step, i) => {
          const isActive = i === currentIdx || (currentIdx === -1 && i === 0);
          const isDone = i < currentIdx;
          const isPending = i > currentIdx && currentIdx !== -1;

          return (
            <div key={step.key} className="flex items-center gap-3">
              <div
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  isDone
                    ? "bg-success text-white"
                    : isActive
                      ? "bg-accent text-white"
                      : "bg-border-light text-subtle"
                }`}
              >
                {isDone ? (
                  <svg
                    className="h-3.5 w-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={3}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="m4.5 12.75 6 6 9-13.5"
                    />
                  </svg>
                ) : (
                  i + 1
                )}
              </div>
              <span
                className={`text-sm ${
                  isActive
                    ? "text-foreground font-medium"
                    : isDone
                      ? "text-success"
                      : "text-subtle"
                }`}
              >
                {step.label}
                {isActive && <AnimatedDots />}
              </span>
            </div>
          );
        })}
      </div>

      {/* Transcript preview */}
      {transcriptPreview && (
        <div className="w-full max-w-md space-y-2">
          <p className="text-xs font-medium text-muted uppercase tracking-wider">Transcript Preview</p>
          <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-4 max-h-40 overflow-y-auto">
            <p className="text-xs text-muted leading-relaxed whitespace-pre-wrap font-[family-name:var(--font-mono)]">
              {transcriptPreview}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function AnimatedDots() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setCount((c) => (c + 1) % 4), 500);
    return () => clearInterval(interval);
  }, []);
  return <span className="inline-block w-6">{".".repeat(count)}</span>;
}

// ── Inline Editable Field ──────────────────────────────────────────────────────

function InlineEditField({
  label,
  value,
  lowConfidence,
  onSave,
}: {
  label: string;
  value: string;
  lowConfidence: boolean;
  onSave: (newValue: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const handleSave = () => {
    onSave(draft);
    setEditing(false);
  };

  const handleCancel = () => {
    setDraft(value);
    setEditing(false);
  };

  if (editing) {
    return (
      <div
        className={`flex flex-col gap-2 py-2 px-3 rounded-[var(--radius-md)] ${lowConfidence ? "bg-warning-bg" : "bg-border-light"}`}
      >
        <label className="text-xs font-medium text-muted">{label}</label>
        <input
          type="text"
          value={draft}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            setDraft(e.target.value)
          }
          autoFocus
          className="w-full rounded-[var(--radius-sm)] border border-border bg-surface px-3 py-2 text-sm text-foreground"
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") handleCancel();
          }}
        />
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={handleCancel}
            className="text-xs text-muted hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="text-xs font-medium text-accent hover:text-accent-hover transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className={`flex w-full items-start gap-4 py-2.5 px-3 rounded-[var(--radius-md)] text-left transition-colors hover:bg-border-light group ${
        lowConfidence ? "bg-warning-bg" : ""
      }`}
    >
      <span className="text-sm text-muted shrink-0 w-32 pt-0.5">{label}</span>
      <span className="text-sm font-semibold text-foreground flex-1">
        {typeof value === "string" && value ? value : "—"}
        {lowConfidence && (
          <span className="ml-2 text-xs font-normal text-warning">
            Low confidence
          </span>
        )}
      </span>
      <svg
        className="h-4 w-4 text-subtle opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125"
        />
      </svg>
    </button>
  );
}

// ── Editable Text Block ────────────────────────────────────────────────────────

function EditableTextBlock({
  label,
  value,
  onSave,
}: {
  label: string;
  value: string | null;
  onSave: (newValue: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");

  const handleSave = () => {
    onSave(draft);
    setEditing(false);
  };

  const handleCancel = () => {
    setDraft(value ?? "");
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted">
          {label}
        </label>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          autoFocus
          rows={4}
          className="w-full rounded-[var(--radius-md)] border border-border bg-surface px-3 py-2 text-sm text-foreground leading-relaxed resize-y"
          onKeyDown={(e) => {
            if (e.key === "Escape") handleCancel();
          }}
        />
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={handleCancel}
            className="text-xs text-muted hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="text-xs font-medium text-accent hover:text-accent-hover transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="w-full text-left space-y-1.5 group"
    >
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted">
          {label}
        </span>
        <svg
          className="h-3.5 w-3.5 text-subtle opacity-0 group-hover:opacity-100 transition-opacity"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125"
          />
        </svg>
      </div>
      <p className="text-sm text-foreground leading-relaxed">
        {value || <span className="text-subtle italic">No content</span>}
      </p>
    </button>
  );
}

// ── Assessment Card ────────────────────────────────────────────────────────────

function AssessmentCard({
  assessment,
  index,
  total,
  isMulti,
  onUpdate,
}: {
  assessment: Assessment;
  index: number;
  total: number;
  isMulti: boolean;
  onUpdate: (id: string, changes: Partial<Assessment>) => void;
}) {
  const confidence = assessment.llm_confidence ?? {};

  const handleFieldSave = (fieldKey: string, newValue: string) => {
    onUpdate(assessment.id, {
      structured_fields: {
        ...assessment.structured_fields,
        [fieldKey]: newValue,
      },
    });
  };

  const handleCoachingSave = (
    field: "coaching_did_well" | "coaching_consider",
    newValue: string
  ) => {
    onUpdate(assessment.id, { [field]: newValue });
  };

  const handleNarrativeSave = (newValue: string) => {
    onUpdate(assessment.id, { narrative_summary: newValue });
  };

  return (
    <div className="rounded-[var(--radius-lg)] border border-border bg-surface overflow-hidden">
      {/* Multi-mode header */}
      {isMulti && total > 1 && (
        <div className="border-b border-border-light bg-border-light/50 px-5 py-2.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted">
            Coaching Note {index + 1} of {total}
          </span>
        </div>
      )}

      <div className="p-5 space-y-5">
        {/* Coaching: Did Well */}
        {assessment.coaching_did_well !== null && (
          <div className="rounded-[var(--radius-md)] bg-success-bg/50 p-4">
            <EditableTextBlock
              label="Something you did well"
              value={assessment.coaching_did_well}
              onSave={(v) => handleCoachingSave("coaching_did_well", v)}
            />
          </div>
        )}

        {/* Coaching: Consider */}
        {assessment.coaching_consider !== null && (
          <div className="rounded-[var(--radius-md)] bg-accent-light/50 p-4">
            <EditableTextBlock
              label="Consider next time"
              value={assessment.coaching_consider}
              onSave={(v) => handleCoachingSave("coaching_consider", v)}
            />
          </div>
        )}

        {/* Structured Fields */}
        {Object.entries(assessment.structured_fields).length > 0 && (
          <div className="space-y-1">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted mb-2">
              Assessment Fields
            </h3>
            <div className="divide-y divide-border-light">
              {Object.entries(assessment.structured_fields).map(
                ([key, val]) => {
                  const displayValue = Array.isArray(val)
                    ? val.join(", ")
                    : String(val ?? "");
                  const fieldConfidence = confidence[key] ?? 1;
                  return (
                    <InlineEditField
                      key={key}
                      label={key
                        .replace(/_/g, " ")
                        .replace(/\b\w/g, (c) => c.toUpperCase())}
                      value={displayValue}
                      lowConfidence={fieldConfidence < 0.5}
                      onSave={(v) => handleFieldSave(key, v)}
                    />
                  );
                }
              )}
            </div>
          </div>
        )}

        {/* Competency Tags */}
        {assessment.competency_tags.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">
              Competencies
            </h3>
            <div className="flex flex-wrap gap-2">
              {assessment.competency_tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center rounded-full bg-accent-light px-3 py-1 text-xs font-medium text-accent-hover"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Narrative Summary */}
        <div className="pt-2 border-t border-border-light">
          <EditableTextBlock
            label="Narrative Summary"
            value={assessment.narrative_summary}
            onSave={handleNarrativeSave}
          />
        </div>
      </div>
    </div>
  );
}

// ── Audio Player Bar ───────────────────────────────────────────────────────────

function AudioPlayerBar({ audioUrl }: { audioUrl: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const progressRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTime = () => setCurrentTime(audio.currentTime);
    const onDuration = () => setDuration(audio.duration || 0);
    const onEnded = () => setPlaying(false);

    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onDuration);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onDuration);
      audio.removeEventListener("ended", onEnded);
    };
  }, []);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
    } else {
      audio.play();
    }
    setPlaying(!playing);
  }, [playing]);

  const handleScrub = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const bar = progressRef.current;
      const audio = audioRef.current;
      if (!bar || !audio || !duration) return;
      const rect = bar.getBoundingClientRect();
      const fraction = Math.max(
        0,
        Math.min(1, (e.clientX - rect.left) / rect.width)
      );
      audio.currentTime = fraction * duration;
    },
    [duration]
  );

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-surface px-4 py-3 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
      <audio ref={audioRef} src={audioUrl} preload="metadata" />
      <div className="mx-auto max-w-2xl flex items-center gap-3">
        {/* Play/pause button */}
        <button
          type="button"
          onClick={togglePlay}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-white transition-colors hover:bg-accent-hover"
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? (
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        {/* Scrub bar */}
        <div
          ref={progressRef}
          onClick={handleScrub}
          className="flex-1 h-6 flex items-center cursor-pointer group"
          role="slider"
          aria-label="Audio progress"
          aria-valuenow={Math.round(currentTime)}
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          tabIndex={0}
        >
          <div className="w-full h-1.5 rounded-full bg-border-light relative">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-accent transition-[width] duration-100"
              style={{ width: `${progress}%` }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 h-3 w-3 rounded-full bg-accent shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ left: `calc(${progress}% - 6px)` }}
            />
          </div>
        </div>

        {/* Timestamp */}
        <span className="text-xs font-[family-name:var(--font-mono)] text-muted tabular-nums shrink-0">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
      </div>
    </div>
  );
}

// ── Reprocess Toast ────────────────────────────────────────────────────────────

function ReprocessToast({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 5000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 flex items-center gap-3 rounded-[var(--radius-md)] bg-foreground px-4 py-3 shadow-lg">
      <svg
        className="h-4 w-4 shrink-0 text-accent"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"
        />
      </svg>
      <p className="text-sm font-medium text-white">{message}</p>
      <button
        type="button"
        onClick={onDismiss}
        className="ml-2 text-xs text-white/60 hover:text-white transition-colors"
        aria-label="Dismiss"
      >
        Dismiss
      </button>
    </div>
  );
}

// ── Discard-changes confirmation dialog ────────────────────────────────────────
// Replaces the native window.confirm() used for back-nav on a dirty form.
// Keyboard-focus is pushed onto the "Keep editing" button (the safer default).
// Escape closes the dialog (treated as "Keep editing"). Focus is trapped
// between the two buttons via a tabindex sentinel loop.

function DiscardChangesDialog({
  onDiscard,
  onKeepEditing,
}: {
  onDiscard: () => void;
  onKeepEditing: () => void;
}) {
  const keepRef = useRef<HTMLButtonElement>(null);
  const discardRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // Focus the safer option when the dialog opens.
    keepRef.current?.focus();

    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onKeepEditing();
        return;
      }
      // Trap Tab between the two buttons so keyboard users can't escape the
      // dialog.
      if (e.key === "Tab") {
        const active = document.activeElement;
        if (e.shiftKey && active === keepRef.current) {
          e.preventDefault();
          discardRef.current?.focus();
        } else if (!e.shiftKey && active === discardRef.current) {
          e.preventDefault();
          keepRef.current?.focus();
        }
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onKeepEditing]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="discard-title"
      aria-describedby="discard-desc"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
    >
      <div className="w-full max-w-sm rounded-[var(--radius-lg)] border border-border bg-surface p-6 space-y-4 shadow-lg">
        <h2 id="discard-title" className="text-lg font-semibold text-foreground">
          Discard unsaved changes?
        </h2>
        <p id="discard-desc" className="text-sm text-muted">
          You have edits that haven&apos;t been saved. Leaving will lose them.
        </p>
        <div className="flex gap-3 pt-1">
          <button
            ref={keepRef}
            type="button"
            onClick={onKeepEditing}
            className="flex-1 rounded-[var(--radius-md)] border border-border bg-surface px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-border-light"
          >
            Keep editing
          </button>
          <button
            ref={discardRef}
            type="button"
            onClick={onDiscard}
            className="flex-1 rounded-[var(--radius-md)] bg-error px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-red-700"
          >
            Discard changes
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Review Client Component ───────────────────────────────────────────────

export default function ReviewClient({ session }: { session: SessionData }) {
  const router = useRouter();

  const [assessments, setAssessments] = useState(session.assessments);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<ErrorCopy | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [sessionStatus, setSessionStatus] = useState(session.status);
  const [pollingStep, setPollingStep] = useState(session.pipeline_step ?? null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [exportSuccess, setExportSuccess] = useState<"pdf" | "csv" | null>(null);
  const [exportError, setExportError] = useState<ErrorCopy | null>(null);
  const [transcriptPreview, setTranscriptPreview] = useState<string | null>(null);
  const [reprocessing, setReprocessing] = useState(false);
  const [reprocessError, setReprocessError] = useState<ErrorCopy | null>(null);
  const [reprocessToast, setReprocessToast] = useState<string | null>(null);
  // Discard-changes dialog (replaces the old window.confirm on back-nav)
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  // Track when polling started to detect stuck-processing state
  const processingStartRef = useRef<number>(
    session.status === "processing" ? Date.now() : 0
  );

  // Security: only show PHI-scrubbed transcript. Never expose transcript_raw to client.
  const transcript = session.recording?.transcript_clean ?? null;

  // Fetch signed URL for audio playback
  useEffect(() => {
    if (!session.recording?.audio_path) return;
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/recordings/${session.id}/signed-url`);
      if (!res.ok || cancelled) return;
      const body = (await res.json()) as { url?: string };
      if (body.url && !cancelled) setAudioUrl(body.url);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.recording?.audio_path, session.id]);

  // ── Unsaved changes warning ──────────────────────────────────────────────────

  useEffect(() => {
    if (!hasUnsavedChanges) return;

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };

    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasUnsavedChanges]);

  // ── Poll for processing status ───────────────────────────────────────────────

  useEffect(() => {
    if (sessionStatus !== "processing") return;

    const interval = setInterval(async () => {
      const res = await fetch(
        `/api/recording-sessions/${session.id}/status`,
        { cache: "no-store" },
      );
      if (!res.ok) return;
      const data = (await res.json()) as {
        status: SessionData["status"];
        pipeline_step: string | null;
        transcript_clean: string | null;
      };

      if (data.status !== "processing") {
        setSessionStatus(data.status);
        router.refresh();
        clearInterval(interval);
        return;
      }

      if (data.pipeline_step) setPollingStep(data.pipeline_step);
      if (!transcriptPreview && data.transcript_clean) {
        setTranscriptPreview(data.transcript_clean);
      }
    }, 3000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionStatus, session.id]);

  // ── Update assessment locally ────────────────────────────────────────────────

  const handleAssessmentUpdate = useCallback(
    (id: string, changes: Partial<Assessment>) => {
      setAssessments((prev) =>
        prev.map((a) => (a.id === id ? { ...a, ...changes } : a))
      );
      setHasUnsavedChanges(true);
    },
    []
  );

  // ── Save all changes ─────────────────────────────────────────────────────────

  const handleSave = useCallback(async (): Promise<boolean> => {
    setSaving(true);
    setSaveError(null);
    try {
      for (const a of assessments) {
        const res = await fetch(`/api/assessments/${a.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            structured_fields: a.structured_fields,
            competency_tags: a.competency_tags,
            narrative_summary: a.narrative_summary,
            coaching_did_well: a.coaching_did_well,
            coaching_consider: a.coaching_consider,
            resident_edited: true,
          }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      }
      setHasUnsavedChanges(false);
      return true;
    } catch (err) {
      console.error("Failed to save assessments:", err);
      setSaveError(saveErrorCopy("your edits"));
      return false;
    } finally {
      setSaving(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assessments]);

  // ── Export PDF ───────────────────────────────────────────────────────────────

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      // Save any unsaved changes first; abort export if save failed
      if (hasUnsavedChanges) {
        const saved = await handleSave();
        if (!saved) return;
      }

      const res = await fetch(`/api/export/${session.id}`, { method: "POST" });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(errBody.error ?? "Export failed");
      }

      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition");
      const filenameMatch = disposition?.match(/filename="?([^"]+)"?/);
      const filename = filenameMatch?.[1] ?? `assessment-${session.id}.pdf`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);

      setSessionStatus("exported");
      setExportSuccess("pdf");
    } catch (err) {
      console.error("Export failed:", err);
      setExportError(exportErrorCopy("PDF"));
    } finally {
      setExporting(false);
    }
  }, [session.id, hasUnsavedChanges, handleSave]);

  // ── Export CSV (One45) ────────────────────────────────────────────────────────

  const handleExportCsv = useCallback(async () => {
    setExportingCsv(true);
    try {
      // Save any unsaved changes first; abort export if save failed
      if (hasUnsavedChanges) {
        const saved = await handleSave();
        if (!saved) return;
      }

      const res = await fetch(`/api/export/csv/${session.id}`, { method: "POST" });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(errBody.error ?? "CSV export failed");
      }

      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition");
      const filenameMatch = disposition?.match(/filename="?([^"]+)"?/);
      const filename = filenameMatch?.[1] ?? `assessment-${session.id}.csv`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);

      setSessionStatus("exported");
      setExportSuccess("csv");
    } catch (err) {
      console.error("CSV export failed:", err);
      setExportError(exportErrorCopy("CSV"));
    } finally {
      setExportingCsv(false);
    }
  }, [session.id, hasUnsavedChanges, handleSave]);

  // ── Reprocess / Retry ────────────────────────────────────────────────────────

  const handleRetry = useCallback(async () => {
    if (reprocessing) return;
    setReprocessing(true);
    setReprocessError(null);
    setReprocessToast(null);

    try {
      const res = await fetch("/api/reprocess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session.id }),
      });

      if (res.status === 202) {
        setReprocessToast("Reprocessing started. This may take a minute.");
        setSessionStatus("processing");
        setPollingStep(null);
        processingStartRef.current = Date.now();
      } else {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        setReprocessError(reprocessErrorCopy(body.error));
      }
    } catch {
      setReprocessError({
        title: "Network error",
        description:
          "We couldn't reach the server. Check your connection and try again.",
        action: { label: "Try again" },
      });
    } finally {
      setReprocessing(false);
    }
  }, [session.id, reprocessing]);

  // ── Format date ──────────────────────────────────────────────────────────────

  const formattedDate = new Date(session.created_at).toLocaleDateString(
    "en-CA",
    {
      year: "numeric",
      month: "short",
      day: "numeric",
    }
  );

  const isMulti = session.form_template?.extraction_mode === "multi";

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <main className="flex flex-1 flex-col min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-surface/80 backdrop-blur-sm px-4 py-3">
        <div className="mx-auto max-w-2xl flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              if (hasUnsavedChanges) {
                setShowDiscardDialog(true);
              } else {
                router.push("/");
              }
            }}
            className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] text-muted hover:text-foreground hover:bg-border-light transition-colors"
            aria-label="Go back"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 19.5 8.25 12l7.5-7.5"
              />
            </svg>
          </button>
          <div className="flex-1 text-center min-w-0">
            <h1 className="text-lg font-[family-name:var(--font-display)] text-foreground truncate">
              Review Assessment
            </h1>
            <p className="text-xs text-muted truncate">
              {session.preceptor?.name} &rarr; You &middot;{" "}
              {session.rotation?.name} &middot; {formattedDate}
            </p>
          </div>
          {/* Status badge */}
          <div className="w-10 flex justify-end">
            {sessionStatus === "exported" && (
              <span className="inline-flex items-center rounded-full bg-success-bg px-2 py-0.5 text-[10px] font-semibold text-success uppercase">
                Exported
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Unsaved changes banner */}
      {hasUnsavedChanges && (
        <div className="sticky top-[61px] z-20 border-b border-warning bg-warning-bg px-4 py-2">
          <div className="mx-auto max-w-2xl flex items-center justify-between">
            <span className="text-xs font-medium text-warning">
              You have unsaved changes
            </span>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="text-xs font-semibold text-accent hover:text-accent-hover transition-colors disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save now"}
            </button>
          </div>
        </div>
      )}

      {/* Save error — richer card below the unsaved-changes banner */}
      {saveError && (
        <div className="mx-auto max-w-2xl px-4 pt-3">
          <ErrorAlert copy={saveError} onDismiss={() => setSaveError(null)} />
        </div>
      )}

      {/* Reprocess toast (bottom-center, auto-dismiss) */}
      {reprocessToast && (
        <ReprocessToast
          message={reprocessToast}
          onDismiss={() => setReprocessToast(null)}
        />
      )}

      <div className="mx-auto w-full max-w-2xl px-4 py-6 space-y-6">
        {/* ── Processing / Failed States ──────────────────────────────── */}
        {(sessionStatus === "processing" ||
          sessionStatus === "processing_failed") && (
          <ProcessingView
            pipelineStep={pollingStep}
            onRetry={handleRetry}
            failed={sessionStatus === "processing_failed"}
            stuck={
              sessionStatus === "processing" &&
              processingStartRef.current > 0 &&
              Date.now() - processingStartRef.current > 5 * 60 * 1000
            }
            transcriptPreview={transcriptPreview}
            reprocessing={reprocessing}
            reprocessError={reprocessError}
          />
        )}

        {/* ── Ready / Exported States ─────────────────────────────────── */}
        {(sessionStatus === "ready" || sessionStatus === "exported") && (
          <>
            {/* Transcript */}
            {transcript && (
              <div className="rounded-[var(--radius-lg)] border border-border bg-surface">
                <div className="flex items-center justify-between px-5 pt-4">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">
                    Transcript
                  </h2>
                  <span className="text-[11px] text-subtle">scroll</span>
                </div>
                <div className="relative">
                  <div className="max-h-[50vh] overflow-y-auto px-5 pb-5 pt-2">
                    <FormattedTranscript text={transcript} />
                  </div>
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-0 bottom-0 h-8 rounded-b-[var(--radius-lg)] bg-gradient-to-t from-surface to-transparent"
                  />
                </div>
              </div>
            )}

            {/* Assessments */}
            {assessments.length > 0 ? (
              <div className="space-y-4">
                {assessments.map((a, i) => (
                  <AssessmentCard
                    key={a.id}
                    assessment={a}
                    index={i}
                    total={assessments.length}
                    isMulti={isMulti}
                    onUpdate={handleAssessmentUpdate}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-8 text-center">
                <p className="text-sm text-muted">
                  No assessments were generated for this session.
                </p>
              </div>
            )}

            {/* Export success banner */}
            {exportSuccess && (
              <div className="rounded-[var(--radius-lg)] border border-success/20 bg-success-bg p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <svg className="h-5 w-5 text-success" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                  <p className="text-sm font-semibold text-foreground">
                    {exportSuccess === "pdf" ? "PDF" : "CSV"} exported successfully
                  </p>
                </div>
                <p className="text-xs text-muted">
                  The file has been downloaded. You can submit it to your program, re-export, or record another session.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setExportSuccess(null); router.push("/"); }}
                    className="rounded-[var(--radius-md)] bg-accent px-4 py-2 text-xs font-semibold text-white hover:bg-accent-hover"
                  >
                    Back to Home
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push("/record")}
                    className="rounded-[var(--radius-md)] border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-border-light"
                  >
                    Record Another
                  </button>
                  <button
                    type="button"
                    onClick={() => setExportSuccess(null)}
                    className="rounded-[var(--radius-md)] border border-border px-4 py-2 text-xs font-semibold text-muted hover:bg-border-light"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}

            {/* Export error */}
            {exportError && (
              <ErrorAlert
                copy={exportError}
                onDismiss={() => setExportError(null)}
              />
            )}

            {/* Action buttons */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !hasUnsavedChanges}
                className="flex-1 rounded-[var(--radius-md)] border border-border bg-surface px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-border-light disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
              <button
                type="button"
                onClick={handleExport}
                disabled={exporting}
                className="flex-1 rounded-[var(--radius-md)] bg-accent px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
              >
                {exporting
                  ? "Exporting..."
                  : sessionStatus === "exported"
                    ? "Re-export as PDF"
                    : "Export as PDF"}
              </button>
            </div>

            {/* One45 CSV export */}
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={exportingCsv}
              className="w-full rounded-[var(--radius-md)] border border-border bg-surface px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-border-light disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <svg
                className="h-4 w-4 text-muted"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"
                />
              </svg>
              {exportingCsv
                ? "Exporting..."
                : "Export CSV for One45"}
            </button>
          </>
        )}
      </div>

      {/* Audio Player Bar */}
      {audioUrl && (
        <AudioPlayerBar audioUrl={audioUrl} />
      )}

      {/* Discard-changes dialog — replaces native window.confirm on back-nav */}
      {showDiscardDialog && (
        <DiscardChangesDialog
          onKeepEditing={() => setShowDiscardDialog(false)}
          onDiscard={() => {
            setShowDiscardDialog(false);
            router.push("/");
          }}
        />
      )}
    </main>
  );
}
