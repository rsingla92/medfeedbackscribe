"use client";

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type ChangeEvent,
} from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { SessionData, Assessment } from "./page";

// ── Processing State ───────────────────────────────────────────────────────────

function ProcessingView({
  pipelineStep,
  onRetry,
  failed,
}: {
  pipelineStep: string | null;
  onRetry: () => void;
  failed: boolean;
}) {
  const steps = [
    { key: "stt", label: "Transcribing audio" },
    { key: "phi_scrub", label: "De-identifying transcript" },
    { key: "extract", label: "Analyzing feedback" },
  ];

  if (failed) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-error-bg">
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
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-lg font-semibold text-foreground">
            Processing failed
          </h2>
          <p className="text-sm text-muted max-w-xs">
            Something went wrong while analyzing your recording. You can retry
            the processing.
          </p>
        </div>
        <button
          type="button"
          onClick={onRetry}
          className="rounded-[var(--radius-md)] bg-accent px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
        >
          Retry processing
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
            Field Note {index + 1} of {total}
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

// ── Main Review Client Component ───────────────────────────────────────────────

export default function ReviewClient({ session }: { session: SessionData }) {
  const router = useRouter();
  const supabase = createClient();

  const [assessments, setAssessments] = useState(session.assessments);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [sessionStatus, setSessionStatus] = useState(session.status);
  const [pollingStep, setPollingStep] = useState(session.pipeline_step ?? null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  // Security: only show PHI-scrubbed transcript. Never expose transcript_raw to client.
  const transcript = session.recording?.transcript_clean ?? null;

  // Fetch signed URL for audio playback
  useEffect(() => {
    if (!session.recording?.audio_path) return;
    const path = session.recording.audio_path;
    supabase.storage
      .from("recordings")
      .createSignedUrl(path, 3600)
      .then(({ data }) => {
        if (data?.signedUrl) setAudioUrl(data.signedUrl);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.recording?.audio_path]);

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
      const { data } = await supabase
        .from("sessions")
        .select("status")
        .eq("id", session.id)
        .single();

      if (data && data.status !== "processing") {
        setSessionStatus(data.status as SessionData["status"]);
        // Reload the page to get fresh assessment data
        router.refresh();
        clearInterval(interval);
        return;
      }

      // Update pipeline step
      const { data: logs } = await supabase
        .from("pipeline_logs")
        .select("step")
        .eq("session_id", session.id)
        .order("created_at", { ascending: false })
        .limit(1);

      if (logs && logs.length > 0) {
        setPollingStep(logs[0].step);
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

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveError(null);
    try {
      for (const a of assessments) {
        await supabase
          .from("assessments")
          .update({
            structured_fields: a.structured_fields,
            competency_tags: a.competency_tags,
            narrative_summary: a.narrative_summary,
            coaching_did_well: a.coaching_did_well,
            coaching_consider: a.coaching_consider,
          })
          .eq("id", a.id);
      }
      setHasUnsavedChanges(false);
    } catch (err) {
      console.error("Failed to save assessments:", err);
      setSaveError("Failed to save changes. Please try again.");
    } finally {
      setSaving(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assessments]);

  // ── Export PDF ───────────────────────────────────────────────────────────────

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      // Save any unsaved changes first
      if (hasUnsavedChanges) await handleSave();

      const res = await fetch(`/api/export/${session.id}`, { method: "POST" });
      if (!res.ok) throw new Error("Export failed");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `assessment-${session.id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);

      setSessionStatus("exported");
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setExporting(false);
    }
  }, [session.id, hasUnsavedChanges, handleSave]);

  // ── Export CSV (One45) ────────────────────────────────────────────────────────

  const handleExportCsv = useCallback(async () => {
    setExportingCsv(true);
    try {
      // Save any unsaved changes first
      if (hasUnsavedChanges) await handleSave();

      const res = await fetch(`/api/export/csv/${session.id}`, { method: "POST" });
      if (!res.ok) throw new Error("CSV export failed");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `assessment-${session.id}-one45.csv`;
      a.click();
      URL.revokeObjectURL(url);

      setSessionStatus("exported");
    } catch (err) {
      console.error("CSV export failed:", err);
    } finally {
      setExportingCsv(false);
    }
  }, [session.id, hasUnsavedChanges, handleSave]);

  // ── Retry processing ─────────────────────────────────────────────────────────

  const handleRetry = useCallback(async () => {
    setSessionStatus("processing");
    setPollingStep(null);
    try {
      await fetch("/api/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session.id }),
      });
    } catch {
      setSessionStatus("processing_failed");
    }
  }, [session.id]);

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
                if (
                  window.confirm(
                    "You have unsaved changes. Are you sure you want to leave?"
                  )
                ) {
                  router.push("/");
                }
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
              Dr. {session.preceptor?.name} &rarr; You &middot;{" "}
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

      {/* Save error banner */}
      {saveError && (
        <div className="sticky top-[61px] z-20 border-b border-error bg-error-bg px-4 py-2">
          <div className="mx-auto max-w-2xl flex items-center justify-between">
            <span className="text-xs font-medium text-error">{saveError}</span>
            <button
              type="button"
              onClick={() => setSaveError(null)}
              className="text-xs font-semibold text-error hover:opacity-70 transition-opacity"
              aria-label="Dismiss error"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <div className="mx-auto w-full max-w-2xl px-4 py-6 space-y-6">
        {/* ── Processing / Failed States ──────────────────────────────── */}
        {(sessionStatus === "processing" ||
          sessionStatus === "processing_failed") && (
          <ProcessingView
            pipelineStep={pollingStep}
            onRetry={handleRetry}
            failed={sessionStatus === "processing_failed"}
          />
        )}

        {/* ── Ready / Exported States ─────────────────────────────────── */}
        {(sessionStatus === "ready" || sessionStatus === "exported") && (
          <>
            {/* Transcript */}
            {transcript && (
              <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-5 space-y-2">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">
                  Transcript
                </h2>
                <p className="text-sm italic text-muted leading-relaxed whitespace-pre-wrap">
                  {transcript}
                </p>
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
    </main>
  );
}
