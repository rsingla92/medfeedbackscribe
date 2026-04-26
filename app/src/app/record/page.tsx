"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ErrorAlert } from "@/app/_components/error-alert";
import {
  micError as micErrorCopy,
  uploadError as uploadErrorCopy,
  loadError,
  type ErrorCopy,
} from "@/lib/errors";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Preceptor {
  id: string;
  name: string;
  email: string;
  specialty: string | null;
}

interface Rotation {
  id: string;
  name: string;
  specialty: string | null;
}

interface FormTemplate {
  id: string;
  name: string;
  extraction_mode: "multi" | "single";
}

type Step = "pick-rotation" | "pick-preceptor" | "pick-form" | "consent" | "recording" | "uploading" | "submitted";

// ── Shared list helpers (search, count, scrollable container) ───────────────

function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative mb-3">
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 21l-4.35-4.35M17 10.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0Z"
        />
      </svg>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-border bg-background pl-9 pr-9 py-2.5 text-sm text-foreground placeholder:text-subtle focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-light"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-full text-muted hover:bg-border-light"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            className="h-3.5 w-3.5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      )}
    </div>
  );
}

function ListCount({
  total,
  shown,
  noun,
  searching,
}: {
  total: number;
  shown: number;
  noun: string;
  searching?: boolean;
}) {
  const label = (n: number) =>
    `${n} ${noun}${n === 1 ? "" : noun.endsWith("s") ? "" : "s"}`;
  return (
    <p className="mb-2 flex items-center gap-1.5 text-xs text-muted">
      <span className="h-1 w-1 rounded-full bg-muted/60" aria-hidden="true" />
      {searching
        ? `Showing ${shown} of ${label(total)}`
        : `${label(total)} — scroll for more`}
    </p>
  );
}

function ScrollList({ children }: { children: React.ReactNode }) {
  // max-h + overflow + bottom fade gradient so users see there's more
  // content below the viewport. pointer-events:none on the fade so it
  // doesn't swallow taps on the last item.
  return (
    <div className="relative">
      <div className="space-y-2 max-h-[56vh] overflow-y-auto pr-1 pb-6 [scrollbar-gutter:stable]">
        {children}
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-background to-transparent"
      />
    </div>
  );
}

function EmptySearch({ query }: { query: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-surface px-4 py-6 text-center">
      <p className="text-sm text-foreground font-medium">
        No matches for &ldquo;{query}&rdquo;
      </p>
      <p className="mt-1 text-xs text-muted">
        Check the spelling or clear the search to see everything.
      </p>
    </div>
  );
}

// ── Real Audio Waveform ───────────────────────────────────────────────────────

function WaveformVisualizer({ analyser, isPaused }: { analyser: AnalyserNode | null; isPaused: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !analyser) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const barCount = 40;
    const barWidth = 3;
    const gap = 2;

    function draw() {
      rafRef.current = requestAnimationFrame(draw);
      analyser!.getByteFrequencyData(dataArray);

      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);
      const centerY = canvas!.height / 2;

      for (let i = 0; i < barCount; i++) {
        // Sample from the frequency data spread across the range
        const dataIndex = Math.floor((i / barCount) * bufferLength * 0.6);
        const value = isPaused ? 0 : dataArray[dataIndex];
        const barHeight = Math.max(4, (value / 255) * centerY * 1.6);

        const x = (canvas!.width - barCount * (barWidth + gap)) / 2 + i * (barWidth + gap);

        ctx!.fillStyle = `rgba(217, 119, 6, ${0.4 + (value / 255) * 0.6})`;
        ctx!.beginPath();
        ctx!.roundRect(x, centerY - barHeight / 2, barWidth, barHeight, 1.5);
        ctx!.fill();
      }
    }

    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, [analyser, isPaused]);

  return (
    <canvas
      ref={canvasRef}
      width={240}
      height={128}
      className="h-32 w-60"
      aria-hidden="true"
    />
  );
}

// ── Timer Display ──────────────────────────────────────────────────────────────

function RecordingTimer({ startTime, isPaused }: { startTime: number; isPaused: boolean }) {
  const [elapsed, setElapsed] = useState(0);
  const pausedAtRef = useRef(0);

  useEffect(() => {
    if (isPaused) {
      pausedAtRef.current = elapsed;
      return;
    }
    const resumeBase = Date.now() - pausedAtRef.current * 1000;
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - resumeBase) / 1000));
    }, 200);
    return () => clearInterval(interval);
  }, [startTime, isPaused]); // eslint-disable-line react-hooks/exhaustive-deps

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6 overflow-y-auto">
      <div className="w-full max-w-md rounded-[var(--radius-lg)] border border-border bg-surface p-6 space-y-5 shadow-lg">
        <div className="space-y-3">
          <h2 className="text-xl font-semibold font-[family-name:var(--font-display)] text-foreground">
            Recording Consent
          </h2>
          <div className="space-y-2 text-sm text-muted leading-relaxed">
            <p>
              Debrief records the audio of your feedback conversation with{" "}
              <span className="font-medium text-foreground">{preceptorName}</span>.
              The recording is encrypted and stored on Canadian infrastructure
              (ca-central-1).
            </p>
            <p>
              Patient identifiers are automatically scrubbed before the
              transcript is saved. Audio is kept for 30 days, then deleted. The
              de-identified transcript stays until you export or delete it.
            </p>
            <p>
              Only you can see this — not {preceptorName}, not your program.
              You confirm {preceptorName} has agreed to be recorded.
            </p>
          </div>
        </div>

        <label className="flex items-start gap-3 cursor-pointer select-none rounded-[var(--radius-md)] border border-border bg-background p-3">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0 rounded-[var(--radius-sm)] border-border text-accent accent-[var(--accent)]"
          />
          <span className="text-sm text-foreground leading-snug">
            I confirm {preceptorName} has agreed to this recording and I
            understand how it will be used.
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

  // Setup state
  const [preceptors, setPreceptors] = useState<Preceptor[]>([]);
  const [rotations, setRotations] = useState<Rotation[]>([]);
  const [formTemplates, setFormTemplates] = useState<FormTemplate[]>([]);
  const [selectedPreceptor, setSelectedPreceptor] = useState("");
  const [selectedRotation, setSelectedRotation] = useState("");
  const [selectedFormTemplate, setSelectedFormTemplate] = useState("");
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<ErrorCopy | null>(null);

  // Search state for the pick-rotation and pick-preceptor lists
  const [rotationQuery, setRotationQuery] = useState("");
  const [preceptorQuery, setPreceptorQuery] = useState("");

  // Flow state
  const [step, setStep] = useState<Step>("pick-rotation");
  const [showStopConfirm, setShowStopConfirm] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [micError, setMicError] = useState<ErrorCopy | null>(null);
  const [uploadError, setUploadError] = useState<ErrorCopy | null>(null);
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
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // ── Fetch setup data ─────────────────────────────────────────────────────────

  useEffect(() => {
    async function fetchSetupData() {
      setLoading(true);
      setFetchError(null);

      try {
        const [preceptorRes, rotationRes, formTemplateRes] = await Promise.all(
          [
            fetch("/api/preceptors"),
            fetch("/api/rotations"),
            fetch("/api/form-templates"),
          ],
        );
        if (!preceptorRes.ok) throw new Error("preceptors");
        if (!rotationRes.ok) throw new Error("rotations");
        if (!formTemplateRes.ok) throw new Error("form_templates");

        const preceptorBody = (await preceptorRes.json()) as {
          preceptors: Preceptor[];
        };
        const rotationBody = (await rotationRes.json()) as {
          rotations: Rotation[];
        };
        const formBody = (await formTemplateRes.json()) as {
          templates: FormTemplate[];
        };

        setPreceptors(preceptorBody.preceptors);
        setRotations(rotationBody.rotations);
        setFormTemplates(formBody.templates);
      } catch {
        setFetchError(loadError("preceptors, rotations, and forms"));
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

    try {
      const res = await fetch("/api/preceptors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newPreceptorName.trim(),
          email: newPreceptorEmail.trim() || null,
        }),
      });
      if (res.ok) {
        const { preceptor } = (await res.json()) as { preceptor: Preceptor };
        setPreceptors((prev) =>
          [...prev, preceptor].sort((a, b) => a.name.localeCompare(b.name)),
        );
        setShowAddPreceptor(false);
        setNewPreceptorName("");
        setNewPreceptorEmail("");
      }
    } finally {
      setAddingPreceptor(false);
    }
  }, [newPreceptorName, newPreceptorEmail]);

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

      // Set up Web Audio analyser for real waveform
      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const node = audioCtx.createAnalyser();
      node.fftSize = 256;
      node.smoothingTimeConstant = 0.7;
      source.connect(node);
      audioCtxRef.current = audioCtx;
      analyserRef.current = node;
      setAnalyser(node);

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
      setIsPaused(false);
      setStep("recording");
    } catch (err) {
      setMicError(micErrorCopy(err));
    }
  }, []);

  // ── Pause / Resume recording ─────────────────────────────────────────────────

  const togglePause = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;

    if (recorder.state === "recording") {
      recorder.pause();
      setIsPaused(true);
    } else if (recorder.state === "paused") {
      recorder.resume();
      setIsPaused(false);
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

    // Stop all tracks and audio context
    streamRef.current?.getTracks().forEach((t) => t.stop());
    audioCtxRef.current?.close();
    setAnalyser(null);

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
      const sessionRes = await fetch("/api/recording-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preceptor_id: selectedPreceptor,
          rotation_id: selectedRotation || null,
          form_template_id: selectedFormTemplate,
          consent_confirmed: true,
        }),
      });
      if (!sessionRes.ok) {
        const body = (await sessionRes.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? `Failed to create session`);
      }
      const { session: sessionData } = (await sessionRes.json()) as {
        session: { id: string };
      };
      const sessionId = sessionData.id;

      // Step 1: Request a presigned S3 PUT URL from the server. The server
      // verifies ownership of the session and that contentType is allowed.
      const uploadContentType = "audio/webm";
      const urlRes = await fetch("/api/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, contentType: uploadContentType }),
      });
      if (!urlRes.ok) {
        const errBody = await urlRes.json().catch(() => ({}));
        throw new Error(errBody.error || `Failed to get upload URL (${urlRes.status})`);
      }
      const { url: presignedUrl, key: storagePath } = (await urlRes.json()) as {
        url: string;
        key: string;
      };

      // Step 2: PUT the blob directly to S3. The Content-Type header must
      // match what the URL was signed with.
      const putRes = await fetch(presignedUrl, {
        method: "PUT",
        headers: { "Content-Type": uploadContentType },
        body: blob,
      });
      if (!putRes.ok) {
        throw new Error(`S3 upload failed (${putRes.status})`);
      }

      // Step 3: Create the recording row with the S3 key. Downstream
      // Lambda reads this key to process the audio.
      const recordingRes = await fetch("/api/recording-sessions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          audio_path: storagePath,
        }),
      });
      if (!recordingRes.ok) {
        throw new Error(`Failed to record audio path (${recordingRes.status})`);
      }

      // Processing is driven by an S3 PutObject event → SQS → Lambda. We no
      // longer fire /api/process here. The review page polls session.status
      // and transitions to 'ready' once the Lambda finishes.
      setSubmittedSessionId(sessionId);
      setStep("submitted");
    } catch (err) {
      setUploadError(uploadErrorCopy(err));
      setStep("pick-rotation");
    }
  }, [selectedPreceptor, selectedRotation, selectedFormTemplate, router]);

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
                <ErrorAlert
                  copy={{
                    ...fetchError,
                    action: {
                      label: "Reload",
                      onClick: () => window.location.reload(),
                    },
                  }}
                />
              ) : step === "pick-rotation" ? (
                <div>
                  <h2 className="mb-3 text-lg font-semibold text-foreground">
                    Select Rotation
                  </h2>
                  <SearchInput
                    value={rotationQuery}
                    onChange={setRotationQuery}
                    placeholder="Search rotations..."
                  />
                  {(() => {
                    const q = rotationQuery.trim().toLowerCase();
                    const filtered = q
                      ? rotations.filter(
                          (r) =>
                            r.name.toLowerCase().includes(q) ||
                            (r.specialty ?? "").toLowerCase().includes(q),
                        )
                      : rotations;
                    return (
                      <>
                        <ListCount
                          total={rotations.length}
                          shown={filtered.length}
                          noun="rotation"
                          searching={q.length > 0}
                        />
                        {filtered.length === 0 ? (
                          <EmptySearch query={rotationQuery} />
                        ) : (
                          <ScrollList>
                            {filtered.map((r) => (
                              <button
                                key={r.id}
                                type="button"
                                onClick={() => {
                                  setSelectedRotation(r.id);
                                  setStep("pick-preceptor");
                                }}
                                className="w-full text-left px-4 py-3 rounded-lg border border-border bg-surface active:bg-accent-light"
                              >
                                <span className="block text-base text-foreground">
                                  {r.name}
                                </span>
                                {r.specialty && (
                                  <span className="block text-xs text-muted mt-0.5">
                                    {r.specialty}
                                  </span>
                                )}
                              </button>
                            ))}
                          </ScrollList>
                        )}
                      </>
                    );
                  })()}
                </div>
              ) : step === "pick-preceptor" ? (
                <div>
                  <p className="mb-1 text-xs text-subtle">
                    {rotations.find((r) => r.id === selectedRotation)?.name}
                  </p>
                  <h2 className="mb-3 text-lg font-semibold text-foreground">
                    Select Preceptor
                  </h2>
                  <SearchInput
                    value={preceptorQuery}
                    onChange={setPreceptorQuery}
                    placeholder="Search preceptors..."
                  />
                  {(() => {
                    const q = preceptorQuery.trim().toLowerCase();
                    const rotationSpecialty = rotations.find(
                      (r) => r.id === selectedRotation,
                    )?.specialty;

                    const matchQuery = (p: Preceptor) =>
                      !q ||
                      p.name.toLowerCase().includes(q) ||
                      (p.specialty ?? "").toLowerCase().includes(q) ||
                      (p.email ?? "").toLowerCase().includes(q);

                    // When searching, show a flat filtered list — the
                    // specialty split isn't useful once the user has
                    // narrowed by text. Otherwise split into matching +
                    // others grouped by rotation specialty.
                    const filteredAll = preceptors.filter(matchQuery);
                    const matching = q
                      ? []
                      : rotationSpecialty
                        ? preceptors.filter(
                            (p) => p.specialty === rotationSpecialty,
                          )
                        : preceptors;
                    const others = q
                      ? []
                      : rotationSpecialty
                        ? preceptors.filter(
                            (p) => p.specialty !== rotationSpecialty,
                          )
                        : [];

                    const onPick = (id: string) => {
                      setSelectedPreceptor(id);
                      if (formTemplates.length === 1) {
                        setSelectedFormTemplate(formTemplates[0].id);
                        setStep("consent");
                      } else {
                        setStep("pick-form");
                      }
                    };

                    if (q) {
                      return (
                        <>
                          <ListCount
                            total={preceptors.length}
                            shown={filteredAll.length}
                            noun="preceptor"
                            searching
                          />
                          {filteredAll.length === 0 ? (
                            <EmptySearch query={preceptorQuery} />
                          ) : (
                            <ScrollList>
                              {filteredAll.map((p) => (
                                <button
                                  key={p.id}
                                  type="button"
                                  onClick={() => onPick(p.id)}
                                  className="w-full text-left px-4 py-3 rounded-lg border border-border bg-surface active:bg-accent-light"
                                >
                                  <span className="block text-base text-foreground">
                                    {p.name}
                                  </span>
                                  {p.specialty && (
                                    <span className="block text-xs text-muted mt-0.5">
                                      {p.specialty}
                                    </span>
                                  )}
                                </button>
                              ))}
                            </ScrollList>
                          )}
                        </>
                      );
                    }

                    return (
                      <>
                        <ListCount
                          total={preceptors.length}
                          shown={matching.length + others.length}
                          noun="preceptor"
                        />
                        <ScrollList>
                          {rotationSpecialty && matching.length === 0 && (
                            <p className="rounded-lg border border-dashed border-border bg-surface px-4 py-3 text-xs text-muted">
                              No preceptors listed for{" "}
                              <span className="font-medium text-foreground">
                                {rotationSpecialty}
                              </span>
                              . All preceptors shown below — or add a new one.
                            </p>
                          )}
                          {matching.map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => onPick(p.id)}
                              className="w-full text-left px-4 py-3 rounded-lg border border-border bg-surface active:bg-accent-light"
                            >
                              <span className="block text-base text-foreground">
                                {p.name}
                              </span>
                              {p.specialty && (
                                <span className="block text-xs text-muted mt-0.5">
                                  {p.specialty}
                                </span>
                              )}
                            </button>
                          ))}

                          {others.length > 0 && (
                            <>
                              <p className="mt-4 mb-1 text-xs font-medium uppercase tracking-widest text-subtle">
                                Other specialties
                              </p>
                              {others.map((p) => (
                                <button
                                  key={p.id}
                                  type="button"
                                  onClick={() => onPick(p.id)}
                                  className="w-full text-left px-4 py-3 rounded-lg border border-border bg-surface/60 active:bg-accent-light"
                                >
                                  <span className="block text-base text-foreground">
                                    {p.name}
                                  </span>
                                  <span className="block text-xs text-muted mt-0.5">
                                    {p.specialty ?? "—"}
                                  </span>
                                </button>
                              ))}
                            </>
                          )}
                        </ScrollList>
                      </>
                    );
                  })()}
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
                        placeholder="Email (required for notifications)"
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
                          disabled={addingPreceptor || !newPreceptorName.trim() || !newPreceptorEmail.trim()}
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
                          {f.extraction_mode === "multi" ? "1-5 coaching notes per conversation" : "One evaluation per shift"}
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
                  {!isPaused && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-error opacity-75" />}
                  <span className={`relative inline-flex h-3 w-3 rounded-full ${isPaused ? "bg-warning" : "bg-error"}`} />
                </span>
                <span className={`text-sm font-medium uppercase tracking-wider ${isPaused ? "text-warning" : "text-error"}`}>
                  {isPaused ? "Paused" : "Recording"}
                </span>
              </div>

              {/* Real audio waveform */}
              <WaveformVisualizer analyser={analyser} isPaused={isPaused} />

              {/* Timer */}
              <RecordingTimer startTime={startTimeRef.current} isPaused={isPaused} />

              {/* Preceptor label */}
              <p className="text-sm text-muted text-center">
                {selectedPreceptorObj?.name}
              </p>

              {/* Controls: Pause + Stop */}
              <div className="flex items-center gap-6">
                {/* Pause / Resume */}
                <button
                  type="button"
                  onClick={togglePause}
                  className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-border bg-surface text-foreground shadow-md transition-transform hover:scale-105 active:scale-95"
                  aria-label={isPaused ? "Resume recording" : "Pause recording"}
                >
                  {isPaused ? (
                    <svg className="h-6 w-6 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5.14v14l11-7-11-7z" />
                    </svg>
                  ) : (
                    <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                      <rect x="6" y="4" width="4" height="16" rx="1" />
                      <rect x="14" y="4" width="4" height="16" rx="1" />
                    </svg>
                  )}
                </button>

                {/* Stop */}
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
              </div>
              <span className="text-xs text-subtle">
                {isPaused ? "Tap play to resume" : "Tap stop to finish"}
              </span>
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
            <div className="mt-4">
              <ErrorAlert
                copy={(micError ?? uploadError) as ErrorCopy}
                onDismiss={() => {
                  setMicError(null);
                  setUploadError(null);
                }}
              />
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
