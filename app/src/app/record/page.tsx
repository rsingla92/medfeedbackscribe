"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Preceptor {
  id: string;
  name: string;
  email: string;
}

interface Rotation {
  id: string;
  name: string;
}

interface FormTemplate {
  id: string;
  name: string;
  extraction_mode: "multi" | "single";
}

type Step = "pick-rotation" | "pick-preceptor" | "pick-form" | "consent" | "recording" | "uploading" | "submitted";

// ── Waveform Visualization ─────────────────────────────────────────────────────

function WaveformVisualizer({ isRecording }: { isRecording: boolean }) {
  const barCount = 32;
  return (
    <div
      className="flex items-center justify-center gap-[3px] h-32 px-4"
      aria-hidden="true"
    >
      {Array.from({ length: barCount }).map((_, i) => (
        <div
          key={i}
          className="w-[3px] rounded-full bg-accent"
          style={{
            height: isRecording ? undefined : "4px",
            animation: isRecording
              ? `waveform ${0.4 + Math.random() * 0.6}s ease-in-out ${Math.random() * 0.5}s infinite alternate`
              : "none",
            opacity: isRecording ? 0.7 + Math.random() * 0.3 : 0.3,
          }}
        />
      ))}
      <style>{`
        @keyframes waveform {
          0% { height: 8px; }
          100% { height: ${60 + Math.random() * 60}px; }
        }
      `}</style>
    </div>
  );
}

// ── Timer Display ──────────────────────────────────────────────────────────────

function RecordingTimer({ startTime }: { startTime: number }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 200);
    return () => clearInterval(interval);
  }, [startTime]);

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;

  return (
    <span className="font-[family-name:var(--font-mono)] text-3xl tabular-nums text-foreground">
      {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
    </span>
  );
}

// ── Consent Modal ──────────────────────────────────────────────────────────────

function ConsentModal({
  preceptorName,
  onConfirm,
  onCancel,
}: {
  preceptorName: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [agreed, setAgreed] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-[var(--radius-lg)] border border-border bg-surface p-6 space-y-5 shadow-lg">
        <div className="space-y-2">
          <h2 className="text-xl font-semibold font-[family-name:var(--font-display)] text-foreground">
            Recording Consent
          </h2>
          <p className="text-sm text-muted leading-relaxed">
            {preceptorName} has agreed to have this feedback session
            recorded. The audio will be transcribed, de-identified, and used to
            populate your assessment form.
          </p>
        </div>

        <label className="flex items-start gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 h-5 w-5 rounded-[var(--radius-sm)] border-border text-accent accent-[var(--accent)]"
          />
          <span className="text-sm text-foreground leading-snug">
            I confirm that {preceptorName} has consented to this recording
            and understands how it will be used.
          </span>
        </label>

        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-[var(--radius-md)] border border-border bg-surface px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-border-light"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!agreed}
            className="flex-1 rounded-[var(--radius-md)] bg-accent px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Stop Confirmation Dialog ───────────────────────────────────────────────────

function StopConfirmDialog({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-[var(--radius-lg)] border border-border bg-surface p-6 space-y-4 shadow-lg">
        <h2 className="text-lg font-semibold text-foreground">
          End recording?
        </h2>
        <p className="text-sm text-muted">
          The audio will be uploaded and processed. You can review the
          assessment once it&apos;s ready.
        </p>
        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-[var(--radius-md)] border border-border bg-surface px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-border-light"
          >
            Keep recording
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 rounded-[var(--radius-md)] bg-error px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-red-700"
          >
            Stop &amp; upload
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Recording Page ────────────────────────────────────────────────────────

export default function RecordPage() {
  const router = useRouter();
  const supabase = createClient();

  // Setup state
  const [preceptors, setPreceptors] = useState<Preceptor[]>([]);
  const [rotations, setRotations] = useState<Rotation[]>([]);
  const [formTemplates, setFormTemplates] = useState<FormTemplate[]>([]);
  const [selectedPreceptor, setSelectedPreceptor] = useState("");
  const [selectedRotation, setSelectedRotation] = useState("");
  const [selectedFormTemplate, setSelectedFormTemplate] = useState("");
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Flow state
  const [step, setStep] = useState<Step>("pick-rotation");
  const [showStopConfirm, setShowStopConfirm] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [offlineBlob, setOfflineBlob] = useState<Blob | null>(null);
  const [submittedSessionId, setSubmittedSessionId] = useState<string | null>(null);

  // Inline add preceptor
  const [showAddPreceptor, setShowAddPreceptor] = useState(false);
  const [newPreceptorName, setNewPreceptorName] = useState("");
  const [newPreceptorEmail, setNewPreceptorEmail] = useState("");
  const [addingPreceptor, setAddingPreceptor] = useState(false);

  // Recording refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);

  // ── Fetch setup data ─────────────────────────────────────────────────────────

  useEffect(() => {
    async function fetchSetupData() {
      setLoading(true);
      setFetchError(null);

      try {
        const [preceptorRes, rotationRes, formTemplateRes] = await Promise.all([
          supabase.from("preceptors").select("id, name, email").order("name"),
          supabase.from("rotations").select("id, name").order("name"),
          supabase.from("form_templates").select("id, name, extraction_mode").order("name"),
        ]);

        if (preceptorRes.error) throw preceptorRes.error;
        if (rotationRes.error) throw rotationRes.error;
        if (formTemplateRes.error) throw formTemplateRes.error;

        setPreceptors(preceptorRes.data ?? []);
        setRotations(rotationRes.data ?? []);
        setFormTemplates(formTemplateRes.data ?? []);
      } catch (err) {
        setFetchError(
          err instanceof Error ? err.message : "Failed to load setup data"
        );
      } finally {
        setLoading(false);
      }
    }

    fetchSetupData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Online/offline listener ──────────────────────────────────────────────────

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    setIsOffline(!navigator.onLine);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // ── Cleanup stream on unmount ────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // ── Derived values ───────────────────────────────────────────────────────────

  const selectedPreceptorObj = preceptors.find(
    (p) => p.id === selectedPreceptor
  );

  // ── Add preceptor inline ─────────────────────────────────────────────────────

  const handleAddPreceptor = useCallback(async () => {
    if (!newPreceptorName.trim()) return;
    setAddingPreceptor(true);

    const { data, error: err } = await supabase
      .from("preceptors")
      .insert({
        name: newPreceptorName.trim(),
        email: newPreceptorEmail.trim() || null,
      })
      .select("id, name, email")
      .single();

    if (!err && data) {
      setPreceptors((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      setShowAddPreceptor(false);
      setNewPreceptorName("");
      setNewPreceptorEmail("");
    }
    setAddingPreceptor(false);
  }, [supabase, newPreceptorName, newPreceptorEmail]);

  // ── Start recording ──────────────────────────────────────────────────────────

  const startRecording = useCallback(async () => {
    setMicError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 48000,
        },
      });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.start(1000); // collect chunks every second
      startTimeRef.current = Date.now();
      setStep("recording");
    } catch (err) {
      const message =
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "Microphone access denied. Please allow microphone access in your browser settings and try again."
          : err instanceof DOMException && err.name === "NotFoundError"
            ? "No microphone found. Please connect a microphone and try again."
            : "Could not start recording. Please check your microphone.";
      setMicError(message);
    }
  }, []);

  // ── Stop recording & upload ──────────────────────────────────────────────────

  const stopAndUpload = useCallback(async () => {
    setShowStopConfirm(false);

    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") return;

    // Stop the recorder and wait for final data
    const blob = await new Promise<Blob>((resolve) => {
      recorder.onstop = () => {
        const b = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        resolve(b);
      };
      recorder.stop();
    });

    // Stop all tracks
    streamRef.current?.getTracks().forEach((t) => t.stop());

    // Handle offline
    if (!navigator.onLine) {
      setOfflineBlob(blob);
      setIsOffline(true);
      setStep("pick-rotation");
      return;
    }

    setStep("uploading");
    setUploadError(null);

    try {
      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Create session record
      const { data: session, error: sessionError } = await supabase
        .from("sessions")
        .insert({
          user_id: user.id,
          preceptor_id: selectedPreceptor,
          rotation_id: selectedRotation || null,
          form_template_id: selectedFormTemplate,
          consent_confirmed: true,
          status: "uploading",
        })
        .select("id")
        .single();

      if (sessionError) throw sessionError;
      const sessionId = session.id;

      // Upload audio to storage
      const storagePath = `${user.id}/${sessionId}.webm`;
      const { error: uploadErr } = await supabase.storage
        .from("recordings")
        .upload(storagePath, blob, {
          contentType: "audio/webm",
          upsert: false,
        });

      if (uploadErr) throw uploadErr;

      // Create recording record
      const { error: recordingErr } = await supabase.from("recordings").insert({
        session_id: sessionId,
        audio_path: storagePath,
      });

      if (recordingErr) throw recordingErr;

      // Trigger processing pipeline (non-blocking). If this request fails (e.g.
      // network/offline), the session remains in "uploading" until the user
      // opens the review page and retries processing there.
      fetch("/api/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
        // keepalive improves reliability across route transitions / page unload
        keepalive: true,
      })
        .then(async (res) => {
          if (!res.ok) {
            let details = "";
            try {
              const text = await res.text();
              if (text) {
                details = ` Response body: ${text}`;
              }
            } catch {
              // ignore body read errors
            }
            console.warn(
              `Pipeline trigger responded with non-OK status (${res.status} ${res.statusText}).` +
                " User can retry from the review page." +
                details
            );
          }
        })
        .catch((err) => {
          console.warn(
            "Pipeline trigger request failed — user can retry from the review page:",
            err
          );
        });

      // Show submitted confirmation
      setSubmittedSessionId(sessionId);
      setStep("submitted");
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : "Upload failed. Please try again."
      );
      setStep("recording");
    }
  }, [supabase, selectedPreceptor, selectedRotation, selectedFormTemplate, router]);

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <main className="flex flex-1 flex-col min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-surface/80 backdrop-blur-sm px-4 py-3">
        <div className="mx-auto max-w-lg flex items-center gap-3">
          {step !== "recording" && step !== "uploading" ? (
            <button
              type="button"
              onClick={() => router.back()}
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
          ) : (
            <div className="w-10" />
          )}
          <h1 className="flex-1 text-center text-lg font-[family-name:var(--font-display)] text-foreground">
            {step === "recording"
              ? "Recording"
              : step === "uploading"
                ? "Uploading"
                : "New Recording"}
          </h1>
          <div className="w-10" />
        </div>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-6">
        <div className="w-full max-w-lg space-y-6">
          {/* ── Setup Steps (button lists, no selects) ────────────────── */}
          {(step === "pick-rotation" || step === "pick-preceptor" || step === "pick-form") && (
            <>
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="h-12 rounded-lg bg-border-light animate-pulse" />
                  ))}
                </div>
              ) : fetchError ? (
                <div className="rounded-xl border border-border bg-error-bg p-4 text-center space-y-2">
                  <p className="text-sm text-error font-medium">{fetchError}</p>
                  <button type="button" onClick={() => window.location.reload()} className="text-sm font-medium text-accent">
                    Retry
                  </button>
                </div>
              ) : step === "pick-rotation" ? (
                <div>
                  <h2 className="mb-3 text-lg font-semibold text-foreground">Select Rotation</h2>
                  <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                    {rotations.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => { setSelectedRotation(r.id); setStep("pick-preceptor"); }}
                        className="w-full text-left px-4 py-3 rounded-lg border border-border bg-surface text-base text-foreground active:bg-accent-light"
                      >
                        {r.name}
                      </button>
                    ))}
                  </div>
                </div>
              ) : step === "pick-preceptor" ? (
                <div>
                  <p className="mb-1 text-xs text-subtle">
                    {rotations.find((r) => r.id === selectedRotation)?.name}
                  </p>
                  <h2 className="mb-3 text-lg font-semibold text-foreground">Select Preceptor</h2>
                  <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                    {preceptors.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setSelectedPreceptor(p.id);
                          // If only one form type, auto-select and go to consent
                          if (formTemplates.length === 1) {
                            setSelectedFormTemplate(formTemplates[0].id);
                            setStep("consent");
                          } else {
                            setStep("pick-form");
                          }
                        }}
                        className="w-full text-left px-4 py-3 rounded-lg border border-border bg-surface text-base text-foreground active:bg-accent-light"
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                  {/* Quick-add preceptor */}
                  {!showAddPreceptor ? (
                    <button
                      type="button"
                      onClick={() => setShowAddPreceptor(true)}
                      className="mt-3 w-full text-left px-4 py-3 rounded-lg border border-dashed border-accent/40 text-sm text-accent font-medium active:bg-accent-light flex items-center gap-2"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                      Add new preceptor
                    </button>
                  ) : (
                    <div className="mt-3 rounded-lg border border-border bg-surface p-4 space-y-3">
                      <input
                        type="text"
                        value={newPreceptorName}
                        onChange={(e) => setNewPreceptorName(e.target.value)}
                        placeholder="Dr. Jane Smith"
                        autoFocus
                        className="w-full rounded-[var(--radius-md)] border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-subtle focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-light"
                      />
                      <input
                        type="email"
                        value={newPreceptorEmail}
                        onChange={(e) => setNewPreceptorEmail(e.target.value)}
                        placeholder="Email (optional)"
                        className="w-full rounded-[var(--radius-md)] border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-subtle focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-light"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => { setShowAddPreceptor(false); setNewPreceptorName(""); setNewPreceptorEmail(""); }}
                          className="flex-1 rounded-[var(--radius-md)] border border-border px-3 py-2 text-xs font-semibold text-foreground"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleAddPreceptor}
                          disabled={addingPreceptor || !newPreceptorName.trim()}
                          className="flex-1 rounded-[var(--radius-md)] bg-accent px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
                        >
                          {addingPreceptor ? "Adding..." : "Add"}
                        </button>
                      </div>
                    </div>
                  )}

                  <button type="button" onClick={() => { setSelectedRotation(""); setStep("pick-rotation"); }} className="mt-3 text-sm text-accent">
                    &larr; Back to rotations
                  </button>
                </div>
              ) : step === "pick-form" ? (
                <div>
                  <p className="mb-1 text-xs text-subtle">
                    {rotations.find((r) => r.id === selectedRotation)?.name} &middot; {preceptors.find((p) => p.id === selectedPreceptor)?.name}
                  </p>
                  <h2 className="mb-3 text-lg font-semibold text-foreground">Select Form Type</h2>
                  <div className="space-y-2">
                    {formTemplates.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => { setSelectedFormTemplate(f.id); setStep("consent"); }}
                        className="w-full text-left px-4 py-3 rounded-lg border border-border bg-surface text-base text-foreground active:bg-accent-light"
                      >
                        <span className="font-medium">{f.name}</span>
                        <span className="block text-sm text-muted mt-0.5">
                          {f.extraction_mode === "multi" ? "1-5 field notes per conversation" : "One evaluation per shift"}
                        </span>
                      </button>
                    ))}
                  </div>
                  <button type="button" onClick={() => { setSelectedPreceptor(""); setStep("pick-preceptor"); }} className="mt-3 text-sm text-accent">
                    &larr; Back to preceptors
                  </button>
                </div>
              ) : null}
            </>
          )}

          {/* ── Consent Modal ─────────────────────────────────────────── */}
          {step === "consent" && selectedPreceptorObj && (
            <ConsentModal
              preceptorName={selectedPreceptorObj.name}
              onConfirm={startRecording}
              onCancel={() => setStep("pick-rotation")}
            />
          )}

          {/* ── Recording Step ────────────────────────────────────────── */}
          {step === "recording" && (
            <div className="flex flex-col items-center space-y-8 pt-8">
              {/* Live indicator */}
              <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-error opacity-75" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-error" />
                </span>
                <span className="text-sm font-medium text-error uppercase tracking-wider">
                  Recording
                </span>
              </div>

              {/* Waveform */}
              <WaveformVisualizer isRecording={true} />

              {/* Timer */}
              <RecordingTimer startTime={startTimeRef.current} />

              {/* Preceptor label */}
              <p className="text-sm text-muted text-center">
                {selectedPreceptorObj?.name}
              </p>

              {/* Stop button */}
              <button
                type="button"
                onClick={() => setShowStopConfirm(true)}
                className="flex h-16 w-16 items-center justify-center rounded-full bg-error text-white shadow-lg transition-transform hover:scale-105 active:scale-95"
                aria-label="Stop recording"
              >
                <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
              </button>
              <span className="text-xs text-subtle">Tap to stop</span>
            </div>
          )}

          {/* ── Stop Confirm Dialog ───────────────────────────────────── */}
          {showStopConfirm && (
            <StopConfirmDialog
              onConfirm={stopAndUpload}
              onCancel={() => setShowStopConfirm(false)}
            />
          )}

          {/* ── Uploading Step ────────────────────────────────────────── */}
          {step === "uploading" && (
            <div className="flex flex-col items-center space-y-6 pt-12">
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
              <div className="text-center space-y-1">
                <p className="text-lg font-semibold text-foreground">
                  Uploading...
                </p>
                <p className="text-sm text-muted">
                  Your recording is being uploaded and will be processed shortly.
                </p>
              </div>
            </div>
          )}

          {/* ── Submitted Confirmation ────────────────────────────────── */}
          {step === "submitted" && submittedSessionId && (
            <div className="flex flex-col items-center space-y-6 pt-8">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success-bg">
                <svg className="h-8 w-8 text-success" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
              </div>
              <div className="text-center space-y-2">
                <p className="text-xl font-semibold font-[family-name:var(--font-display)] text-foreground">
                  Recording Submitted
                </p>
                <p className="text-sm text-muted max-w-xs">
                  Your feedback is being transcribed and processed. This usually takes about a minute.
                </p>
              </div>

              {/* Summary */}
              <div className="w-full rounded-[var(--radius-lg)] border border-border bg-surface p-4 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted">Preceptor</span>
                  <span className="font-medium text-foreground">{selectedPreceptorObj?.name}</span>
                </div>
                {selectedRotation && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted">Rotation</span>
                    <span className="font-medium text-foreground">
                      {rotations.find((r) => r.id === selectedRotation)?.name}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted">Form</span>
                  <span className="font-medium text-foreground">
                    {formTemplates.find((f) => f.id === selectedFormTemplate)?.name}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted">Status</span>
                  <span className="inline-flex items-center gap-1.5 text-warning font-medium text-sm">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-warning opacity-75" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-warning" />
                    </span>
                    Processing
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-3 w-full">
                <button
                  type="button"
                  onClick={() => router.push(`/review/${submittedSessionId}`)}
                  className="w-full rounded-[var(--radius-md)] bg-accent px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
                >
                  View Assessment
                </button>
                <button
                  type="button"
                  onClick={() => router.push("/")}
                  className="w-full rounded-[var(--radius-md)] border border-border bg-surface px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-border-light"
                >
                  Back to Home
                </button>
              </div>
            </div>
          )}

          {/* ── Error Display ─────────────────────────────────────────── */}
          {(micError || uploadError) && step !== "submitted" && (
            <div className="mt-4 rounded-[var(--radius-md)] border border-border bg-error-bg p-4 text-center space-y-2">
              <p className="text-sm text-error font-medium">{micError || uploadError}</p>
              <button
                type="button"
                onClick={() => { setMicError(null); setUploadError(null); }}
                className="text-sm font-medium text-accent"
              >
                Dismiss
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
