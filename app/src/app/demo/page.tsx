"use client";

import { useState, useRef, useEffect } from "react";

type DemoStep = "setup" | "consent" | "recording" | "processing" | "review";

const PRECEPTORS = [
  "Dr. Sarah Thompson", "Dr. James Wu", "Dr. Priya Sharma",
  "Dr. Michael O'Brien", "Dr. Fatima Al-Hassan", "Dr. David Kim",
  "Dr. Rachel Beaulieu", "Dr. Andrew Patel", "Dr. Christine Lam",
  "Dr. Robert Fournier", "Dr. Anika Johal", "Dr. Mark Stevens",
  "Dr. Leila Nazari", "Dr. Thomas Grant", "Dr. Yuki Tanaka",
  "Dr. Helen Carruthers", "Dr. Omar Diallo", "Dr. Natalie Chen",
  "Dr. Brian Mackenzie", "Dr. Simone Dupuis", "Dr. Kevin Park",
  "Dr. Laura Petersen", "Dr. Ravi Mehta", "Dr. Jennifer Blackwood",
  "Dr. Carlos Rivera", "Dr. Emily Watson", "Dr. Hassan Mahmoud",
  "Dr. Diana Volkov", "Dr. Gregory Fong", "Dr. Isabelle Tremblay",
];

const ROTATIONS = [
  "Family Medicine Clinic", "General Surgery", "Emergency Medicine",
  "Internal Medicine", "Obstetrics & Gynecology", "Pediatrics",
  "Psychiatry", "Geriatrics", "Palliative Care", "Orthopedic Surgery",
  "Cardiology", "Dermatology", "Neurology", "Nephrology", "Respirology",
  "Gastroenterology", "Endocrinology", "Rheumatology", "Infectious Disease",
  "Oncology", "Anesthesiology", "Radiology", "Ophthalmology",
  "ENT / Otolaryngology", "Urology", "Plastic Surgery", "Vascular Surgery",
  "ICU / Critical Care", "Sports Medicine", "Addiction Medicine", "Public Health",
];

const MOCK_ASSESSMENT = {
  outputs: [
    {
      output_index: 1,
      coaching_did_well:
        "Thorough history-taking with attention to family history. Strong patient communication — the patient seemed comfortable and well-informed.",
      coaching_consider:
        "Work on physical examination technique, particularly abdominal palpation depth. Consider incorporating imaging earlier in the diagnostic workup.",
      structured_fields: {
        observation_type: "Direct Observation",
        skill_dimension: ["Clinical Reasoning/Skills", "Communication"],
        domain_of_care: "Care of Adults",
        priority_topics: ["Abdominal Pain"],
      },
      competency_tags: ["Medical Expert", "Communicator"],
      narrative_summary:
        "Demonstrated thorough history-taking with attention to family history of colon cancer. Physical examination technique requires improvement — specifically abdominal palpation depth. Clinical reasoning was sound. Strong patient communication skills noted.",
    },
  ],
};

export default function DemoPage() {
  const [step, setStep] = useState<DemoStep>("setup");
  const [rotation, setRotation] = useState("");
  const [preceptor, setPreceptor] = useState("");
  const [formType, setFormType] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [processingStep, setProcessingStep] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // When rotation changes, auto-set form type
  useEffect(() => {
    if (rotation === "Emergency Medicine") {
      setFormType(""); // Force user to pick between two options
    } else if (rotation !== "") {
      setFormType("Field Note"); // Only one option, auto-select
    } else {
      setFormType("");
    }
  }, [rotation]);

  // Recording timer
  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording]);

  // Processing simulation
  useEffect(() => {
    if (step === "processing") {
      let i = 0;
      const interval = setInterval(() => {
        i++;
        if (i < 4) {
          setProcessingStep(i);
        } else {
          clearInterval(interval);
          setStep("review");
        }
      }, 1500);
      return () => clearInterval(interval);
    }
  }, [step]);

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/mp4";
      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
      };
      recorder.start();
      mediaRef.current = recorder;
      setIsRecording(true);
      setElapsed(0);
    } catch {
      alert("Microphone access denied. Please allow microphone access and try again.");
    }
  }

  function stopRecording() {
    if (mediaRef.current?.state === "recording") {
      mediaRef.current.stop();
      setIsRecording(false);
      setStep("processing");
      setProcessingStep(0);
    }
  }

  function resetAll() {
    setStep("setup");
    setRotation("");
    setPreceptor("");
    setFormType("");
    setElapsed(0);
    setAudioUrl(null);
  }

  const formatTime = (s: number) =>
    `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  const processingLabels = [
    "Uploading audio...",
    "Transcribing speech to text...",
    "De-identifying patient information...",
    "Extracting structured assessment...",
  ];

  const allFieldsFilled = rotation !== "" && preceptor !== "" && formType !== "";

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-md px-6 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-[family-name:var(--font-display)] text-foreground">MedScribe</h1>
            <p className="text-sm text-muted">Demo Mode</p>
          </div>
          <span className="rounded-full bg-warning-bg px-3 py-1 text-xs font-medium text-warning">DEMO</span>
        </div>

        {/* ─── SETUP ─── */}
        {step === "setup" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (allFieldsFilled) setStep("consent");
            }}
            className="space-y-5"
          >
            {/* 1. Rotation */}
            <div>
              <label htmlFor="rotation" className="mb-1.5 block text-sm font-medium text-foreground">
                Rotation <span className="text-error">*</span>
              </label>
              <select
                id="rotation"
                required
                value={rotation}
                onChange={(e) => setRotation(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface px-4 py-3 text-base text-foreground"
              >
                <option value="">Select rotation...</option>
                {ROTATIONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            {/* 2. Preceptor — plain select */}
            <div>
              <label htmlFor="preceptor" className="mb-1.5 block text-sm font-medium text-foreground">
                Preceptor <span className="text-error">*</span>
              </label>
              <select
                id="preceptor"
                required
                value={preceptor}
                onChange={(e) => setPreceptor(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface px-4 py-3 text-base text-foreground"
              >
                <option value="">Select preceptor...</option>
                {PRECEPTORS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            {/* 3. Form Type — conditional on rotation */}
            <div>
              <label htmlFor="formType" className="mb-1.5 block text-sm font-medium text-foreground">
                Form Type <span className="text-error">*</span>
              </label>
              {rotation === "" ? (
                <select disabled className="w-full rounded-lg border border-border bg-border-light px-4 py-3 text-base text-subtle">
                  <option>Select a rotation first</option>
                </select>
              ) : rotation === "Emergency Medicine" ? (
                <select
                  id="formType"
                  required
                  value={formType}
                  onChange={(e) => setFormType(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface px-4 py-3 text-base text-foreground"
                >
                  <option value="">Select form type...</option>
                  <option value="Field Note">Field Note</option>
                  <option value="Daily Shift Evaluation">Daily Shift Evaluation</option>
                </select>
              ) : (
                <div className="rounded-lg border border-border bg-surface px-4 py-3 text-base text-foreground">
                  Field Note
                </div>
              )}
            </div>

            {/* Continue */}
            <button
              type="submit"
              className={`w-full rounded-lg px-4 py-3 text-base font-semibold ${
                allFieldsFilled
                  ? "bg-accent text-white"
                  : "bg-border text-muted cursor-default"
              }`}
            >
              Continue
            </button>
          </form>
        )}

        {/* ─── CONSENT ─── */}
        {step === "consent" && (
          <div className="space-y-6">
            <div className="rounded-xl border border-border bg-surface p-6">
              <h2 className="mb-2 text-lg font-semibold text-foreground">Consent Confirmation</h2>
              <p className="text-sm text-muted">
                <span className="font-medium text-foreground">{preceptor}</span>{" "}
                has agreed to have this feedback session recorded and processed by MedScribe.
              </p>
              <div className="mt-3 rounded-lg bg-background px-3 py-2 text-xs text-subtle">
                {rotation} &middot; {formType}
              </div>
            </div>
            <button
              onClick={() => setStep("recording")}
              className="w-full rounded-lg bg-accent px-4 py-3 text-base font-semibold text-white"
            >
              Confirm &amp; Start Recording
            </button>
            <button
              onClick={() => setStep("setup")}
              className="w-full rounded-lg border border-border bg-surface px-4 py-3 text-base font-medium text-foreground"
            >
              Go Back
            </button>
          </div>
        )}

        {/* ─── RECORDING ─── */}
        {step === "recording" && (
          <div className="flex flex-col items-center space-y-6 py-8">
            {!isRecording ? (
              <>
                <button
                  onClick={startRecording}
                  className="flex h-24 w-24 items-center justify-center rounded-full bg-accent text-white shadow-lg shadow-accent/30"
                >
                  <svg className="h-10 w-10" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8.25 4.5a3.75 3.75 0 1 1 7.5 0v8.25a3.75 3.75 0 1 1-7.5 0V4.5Z" />
                    <path d="M6 10.5a.75.75 0 0 1 .75.75v1.5a5.25 5.25 0 1 0 10.5 0v-1.5a.75.75 0 0 1 1.5 0v1.5a6.751 6.751 0 0 1-6 6.709v2.291h3a.75.75 0 0 1 0 1.5h-7.5a.75.75 0 0 1 0-1.5h3v-2.291a6.751 6.751 0 0 1-6-6.709v-1.5A.75.75 0 0 1 6 10.5Z" />
                  </svg>
                </button>
                <p className="text-sm text-muted">Tap to start recording</p>
                <div className="rounded-lg border border-border bg-surface px-3 py-2 text-xs text-subtle text-center">
                  {preceptor} &middot; {rotation}
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 animate-pulse rounded-full bg-error" />
                  <span className="font-[family-name:var(--font-mono)] text-lg text-foreground">
                    {formatTime(elapsed)}
                  </span>
                </div>
                <div className="flex items-center gap-1 h-16">
                  {Array.from({ length: 24 }).map((_, i) => (
                    <div
                      key={i}
                      className="w-1 rounded-full bg-accent"
                      style={{
                        height: `${20 + Math.random() * 80}%`,
                        animation: `pulse 0.5s ease-in-out ${i * 0.05}s infinite alternate`,
                      }}
                    />
                  ))}
                </div>
                <p className="text-sm text-muted">
                  Hand your phone to your preceptor — or set it on the desk.
                </p>
                <button
                  onClick={stopRecording}
                  className="w-full rounded-lg bg-foreground px-4 py-3 text-base font-semibold text-background"
                >
                  Stop Recording
                </button>
              </>
            )}
          </div>
        )}

        {/* ─── PROCESSING ─── */}
        {step === "processing" && (
          <div className="flex flex-col items-center space-y-8 py-12">
            <h2 className="text-xl font-[family-name:var(--font-display)] text-foreground">Processing...</h2>
            <div className="w-full space-y-3">
              {processingLabels.map((label, i) => (
                <div key={i} className="flex items-center gap-3">
                  {processingStep > i ? (
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-success-bg text-success">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                    </span>
                  ) : processingStep === i ? (
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-light">
                      <span className="h-3 w-3 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                    </span>
                  ) : (
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-border-light">
                      <span className="h-2 w-2 rounded-full bg-subtle" />
                    </span>
                  )}
                  <span className={`text-sm ${processingStep >= i ? "text-foreground" : "text-subtle"}`}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── REVIEW ─── */}
        {step === "review" && (
          <div className="space-y-6 pb-24">
            <div>
              <h2 className="text-2xl font-[family-name:var(--font-display)] text-foreground">Review Assessment</h2>
              <p className="mt-1 text-sm text-muted">{preceptor} &rarr; You &middot; {rotation} &middot; Today</p>
              <p className="mt-0.5 text-xs text-subtle">{formType}</p>
            </div>

            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-subtle">Transcript</h3>
              <div className="rounded-xl border border-border bg-surface p-4">
                <p className="text-sm italic text-muted leading-relaxed">
                  &ldquo;Overall you did a good job today. Your history was thorough — you caught the
                  family history of colon cancer which was important for this patient. Your physical
                  exam technique needs work, especially abdominal palpation — you were too superficial.
                  Your plan was reasonable but you should have considered imaging earlier. You
                  communicated well with the patient and they seemed comfortable with you.&rdquo;
                </p>
              </div>
            </div>

            {MOCK_ASSESSMENT.outputs.map((output) => (
              <div key={output.output_index} className="space-y-4">
                <div className="grid gap-3">
                  <div className="rounded-xl border border-border bg-success-bg/30 p-4">
                    <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-success">Something you did well</h4>
                    <p className="text-sm text-foreground">{output.coaching_did_well}</p>
                  </div>
                  <div className="rounded-xl border border-border bg-warning-bg/30 p-4">
                    <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-warning">Consider next time</h4>
                    <p className="text-sm text-foreground">{output.coaching_consider}</p>
                  </div>
                </div>

                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-subtle">Assessment</h3>
                  <div className="rounded-xl border border-border bg-surface divide-y divide-border-light">
                    {Object.entries(output.structured_fields).map(([key, value]) => (
                      <div key={key} className="flex justify-between px-4 py-3">
                        <span className="text-sm text-muted">
                          {key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                        </span>
                        <span className="text-sm font-medium text-foreground text-right max-w-[60%]">
                          {Array.isArray(value) ? value.join(", ") : String(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {output.competency_tags.map((tag) => (
                    <span key={tag} className="rounded-full border border-border px-3 py-1 text-xs font-medium text-muted">{tag}</span>
                  ))}
                </div>

                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-subtle">Narrative Summary</h3>
                  <p className="text-sm text-foreground leading-relaxed">{output.narrative_summary}</p>
                </div>
              </div>
            ))}

            <div className="flex gap-3">
              <button className="flex-1 rounded-lg border border-border bg-surface px-4 py-3 text-sm font-semibold text-foreground">Edit</button>
              <button className="flex-1 rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-white">Export as PDF</button>
            </div>

            <button onClick={resetAll} className="w-full text-center text-sm font-medium text-accent py-2">
              Start a new session
            </button>
          </div>
        )}

        {step === "review" && audioUrl && (
          <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-surface px-4 py-3">
            <audio controls src={audioUrl} className="w-full h-10" />
          </div>
        )}
      </div>
    </main>
  );
}
