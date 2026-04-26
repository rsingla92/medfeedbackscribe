"use client";

import { useState, useRef, useEffect } from "react";
import { ErrorAlert } from "@/app/_components/error-alert";
import { micError, type ErrorCopy } from "@/lib/errors";

type DemoStep = "pick-rotation" | "pick-preceptor" | "pick-form" | "consent" | "recording" | "processing" | "review";

// Stable waveform bar heights — precomputed once to avoid Math.random() in render
// (using Math.random() during render causes hydration mismatches and visual flicker)
const WAVEFORM_HEIGHTS = Array.from({ length: 24 }, (_, i) => {
  // Deterministic pseudo-random pattern using sine waves at different frequencies
  return 20 + Math.round((Math.sin(i * 0.7) * 0.5 + 0.5) * 40 + (Math.sin(i * 1.3 + 1) * 0.5 + 0.5) * 20);
});

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

const DEMO_TRANSCRIPT: { speaker: "Preceptor" | "Resident"; text: string }[] = [
  {
    speaker: "Preceptor",
    text: "Okay, let's debrief. The abdominal pain case — the 58-year-old with the rectal bleeding. Walk me through your thinking when you first saw him.",
  },
  {
    speaker: "Resident",
    text: "Yeah. So when I walked in, he was otherwise healthy, hadn't seen a doctor in years. Intermittent lower abdominal pain for about two weeks, bright red blood in the stool a few times over the past week. No fevers, no weight loss that he knew of. My first thought was hemorrhoids given the bright red blood — but the two weeks of abdominal pain didn't really fit, so I wanted to widen the differential.",
  },
  {
    speaker: "Preceptor",
    text: "Good. What did you widen it to?",
  },
  {
    speaker: "Resident",
    text: "Hemorrhoids, anal fissure, diverticular disease, infectious colitis, IBD, and colorectal cancer. His age and the fact that he'd never had a colonoscopy pushed malignancy up the list for me.",
  },
  {
    speaker: "Preceptor",
    text: "That's actually where I want to stop you — that's the thing you did best on this case. You caught the family history. You asked a follow-up question I wouldn't necessarily have asked at your stage.",
  },
  {
    speaker: "Resident",
    text: "The uncle with colon cancer?",
  },
  {
    speaker: "Preceptor",
    text: "Right. And more importantly you asked what age — which came back at 46. That moves the pretest probability for a malignancy a lot. It also changes what you tell him about urgency of workup. He didn't volunteer it, did he?",
  },
  {
    speaker: "Resident",
    text: "No, he didn't. I only got it when I did the full family history. A lot of people stop after 'anything run in the family?' and I almost did, but I kept going because the blood plus the abdominal pain didn't add up.",
  },
  {
    speaker: "Preceptor",
    text: "That's the point. Hold onto that habit. Now. The exam.",
  },
  {
    speaker: "Resident",
    text: "Yeah...",
  },
  {
    speaker: "Preceptor",
    text: "Your abdominal exam was, let's say, gentle.",
  },
  {
    speaker: "Resident",
    text: "I know. I was trying not to cause him pain — he was already uncomfortable.",
  },
  {
    speaker: "Preceptor",
    text: "I get it. But a superficial palp on someone with two weeks of abdominal pain doesn't give you the information you need. You can go deep and be kind at the same time. You warn the patient, you watch their face, you let them stop you. But you have to actually palpate. What would you have found if you'd gone deeper today?",
  },
  {
    speaker: "Resident",
    text: "Probably nothing palpable. But I would have known whether there was guarding or rebound.",
  },
  {
    speaker: "Preceptor",
    text: "Exactly. You didn't have that information when you presented the plan. Which brings me to the plan itself.",
  },
  {
    speaker: "Resident",
    text: "CBC, electrolytes, renal function, lipase, CRP, and a CT abdomen-pelvis with contrast.",
  },
  {
    speaker: "Preceptor",
    text: "All reasonable. What was missing?",
  },
  {
    speaker: "Resident",
    text: "Hmm. FIT testing?",
  },
  {
    speaker: "Preceptor",
    text: "FIT's not the right test in front of someone who's actively bleeding. But you also didn't order a type and screen, and you were ready to send him home before the CT was read. If that CT had shown an obstruction or a perforation, you'd have had no blood ready.",
  },
  {
    speaker: "Resident",
    text: "Oh. Yeah, that's a good point.",
  },
  {
    speaker: "Preceptor",
    text: "Small thing, but it's the thing that bites you on a busy night. Type and screen anyone where you might plausibly need blood. Cheap, fast, saves you.",
  },
  {
    speaker: "Resident",
    text: "Okay. That's going into my notes.",
  },
  {
    speaker: "Preceptor",
    text: "Your communication with him was good, though. He was anxious, and you didn't rush him. You explained the CT in plain language. You told him what you were worried about without scaring him. That's a real skill and it's not always there at PGY-2.",
  },
  {
    speaker: "Resident",
    text: "Thanks. I appreciate that.",
  },
  {
    speaker: "Preceptor",
    text: "So — summary. History-taking, especially family history, very strong. Keep doing that. Physical exam, work on depth of palpation. Plan was solid except for the type-and-screen miss. Communication was excellent. Fair?",
  },
  {
    speaker: "Resident",
    text: "Fair. Thank you.",
  },
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
  const [step, setStep] = useState<DemoStep>("pick-rotation");
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
  const [micErr, setMicErr] = useState<ErrorCopy | null>(null);

  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isRecording]);

  useEffect(() => {
    if (step === "processing") {
      let i = 0;
      const interval = setInterval(() => {
        i++;
        if (i < 4) setProcessingStep(i);
        else { clearInterval(interval); setStep("review"); }
      }, 1500);
      return () => clearInterval(interval);
    }
  }, [step]);

  async function startRecording() {
    setMicErr(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus" : "audio/mp4";
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
    } catch (err) {
      setMicErr(micError(err));
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
    setStep("pick-rotation");
    setRotation(""); setPreceptor(""); setFormType("");
    setElapsed(0); setAudioUrl(null);
  }

  const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  const procLabels = [
    "Uploading audio...", "Transcribing speech to text...",
    "De-identifying patient information...", "Extracting structured assessment...",
  ];

  // Shared styles
  const listBtn = "w-full text-left px-4 py-3 rounded-lg border border-border bg-surface text-base text-foreground active:bg-accent-light";
  const primaryBtn = "w-full rounded-lg bg-accent px-4 py-3 text-base font-semibold text-white";
  const secondaryBtn = "w-full rounded-lg border border-border bg-surface px-4 py-3 text-base font-medium text-foreground";

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-md px-6 py-8">
        {/* Back-to-home link */}
        <a
          href="/"
          className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-foreground transition-colors"
        >
          <svg
            aria-hidden="true"
            className="h-4 w-4"
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
          Back to home
        </a>

        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-[family-name:var(--font-display)] text-foreground">
              Debrief
            </h1>
            <p className="text-sm text-muted">Demo Mode</p>
          </div>
          <span className="rounded-full border border-warning/40 bg-warning-bg px-3 py-1 text-xs font-medium text-warning uppercase tracking-wider">
            Demo · simulated data
          </span>
        </div>

        {/* ─── PICK ROTATION ─── */}
        {step === "pick-rotation" && (
          <div>
            {/* Demo notice — only shown on pick-rotation step */}
            <div className="mb-6 rounded-lg border border-border bg-surface p-3 text-xs text-muted leading-relaxed">
              This is a demo with simulated data. The real app at{" "}
              <a href="/auth" className="text-accent font-medium">/auth</a>{" "}
              tracks sessions per authenticated resident with real STT + LLM processing.
            </div>
            <h2 className="mb-3 text-lg font-semibold text-foreground">Select Rotation</h2>
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {ROTATIONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => { setRotation(r); setStep("pick-preceptor"); }}
                  className={listBtn}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ─── PICK PRECEPTOR ─── */}
        {step === "pick-preceptor" && (
          <div>
            <p className="mb-1 text-xs text-subtle">{rotation}</p>
            <h2 className="mb-3 text-lg font-semibold text-foreground">Select Preceptor</h2>
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {PRECEPTORS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    setPreceptor(p);
                    if (rotation === "Emergency Medicine") {
                      setStep("pick-form");
                    } else {
                      setFormType("Coaching Note");
                      setStep("consent");
                    }
                  }}
                  className={listBtn}
                >
                  {p}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setStep("pick-rotation")} className="mt-3 text-sm text-accent">
              &larr; Back to rotations
            </button>
          </div>
        )}

        {/* ─── PICK FORM TYPE (EM only) ─── */}
        {step === "pick-form" && (
          <div>
            <p className="mb-1 text-xs text-subtle">{rotation} &middot; {preceptor}</p>
            <h2 className="mb-3 text-lg font-semibold text-foreground">Select Form Type</h2>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => { setFormType("Coaching Note"); setStep("consent"); }}
                className={listBtn}
              >
                <span className="font-medium">Coaching Note</span>
                <span className="block text-sm text-muted mt-0.5">1-5 coaching notes per conversation</span>
              </button>
              <button
                type="button"
                onClick={() => { setFormType("Daily Shift Evaluation"); setStep("consent"); }}
                className={listBtn}
              >
                <span className="font-medium">Daily Shift Evaluation</span>
                <span className="block text-sm text-muted mt-0.5">One holistic evaluation per shift</span>
              </button>
            </div>
            <button type="button" onClick={() => setStep("pick-preceptor")} className="mt-3 text-sm text-accent">
              &larr; Back to preceptors
            </button>
          </div>
        )}

        {/* ─── CONSENT ─── */}
        {step === "consent" && (
          <div className="space-y-6">
            <div className="rounded-xl border border-border bg-surface p-6">
              <h2 className="mb-2 text-lg font-semibold text-foreground">Consent Confirmation</h2>
              <p className="text-sm text-muted">
                <span className="font-medium text-foreground">{preceptor}</span>{" "}
                has agreed to have this feedback session recorded and processed by Debrief.
              </p>
              <div className="mt-3 rounded-lg bg-background px-3 py-2 text-xs text-subtle">
                {rotation} &middot; {formType}
              </div>
            </div>
            <button type="button" onClick={() => setStep("recording")} className={primaryBtn}>
              Confirm &amp; Start Recording
            </button>
            <button type="button" onClick={() => setStep("pick-rotation")} className={secondaryBtn}>
              Start Over
            </button>
          </div>
        )}

        {/* ─── RECORDING ─── */}
        {step === "recording" && (
          <div className="flex flex-col items-center space-y-6 py-8">
            {micErr && (
              <div className="w-full">
                <ErrorAlert
                  copy={{
                    ...micErr,
                    action: {
                      label: "Try again",
                      onClick: () => setMicErr(null),
                    },
                  }}
                  onDismiss={() => setMicErr(null)}
                />
              </div>
            )}
            {!isRecording ? (
              <>
                <button type="button" onClick={startRecording} aria-label="Start recording"
                  className="flex h-24 w-24 items-center justify-center rounded-full bg-accent text-white shadow-lg shadow-accent/30">
                  <svg className="h-10 w-10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
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
                  <span className="font-[family-name:var(--font-mono)] text-lg text-foreground">{fmt(elapsed)}</span>
                </div>
                <div className="flex items-center gap-1 h-16">
                  {WAVEFORM_HEIGHTS.map((h, i) => (
                    <div key={i} className="w-1 rounded-full bg-accent"
                      style={{ height: `${h}%`, animation: `pulse 0.5s ease-in-out ${i * 0.05}s infinite alternate` }} />
                  ))}
                </div>
                <p className="text-sm text-muted">Hand your phone to your preceptor — or set it on the desk.</p>
                <button type="button" onClick={stopRecording}
                  className="w-full rounded-lg bg-foreground px-4 py-3 text-base font-semibold text-background">
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
              {procLabels.map((label, i) => (
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
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-subtle">
                  Transcript
                </h3>
                <span className="text-xs text-subtle">~4 min · scroll</span>
              </div>
              <div className="rounded-xl border border-border bg-surface">
                <div className="max-h-[50vh] overflow-y-auto p-4 space-y-3 text-sm leading-relaxed">
                  {DEMO_TRANSCRIPT.map((turn, i) => (
                    <p key={i} className="text-foreground">
                      <span
                        className={`font-semibold ${
                          turn.speaker === "Preceptor"
                            ? "text-accent"
                            : "text-foreground"
                        }`}
                      >
                        {turn.speaker}:
                      </span>{" "}
                      <span className="text-muted">{turn.text}</span>
                    </p>
                  ))}
                </div>
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
                        <span className="text-sm text-muted">{key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</span>
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

            <div className="rounded-lg border border-dashed border-border bg-surface p-3 text-xs text-muted text-center">
              Demo only — buttons below are illustrative. The real app at{" "}
              <a href="/auth" className="font-medium text-accent">
                /auth
              </a>{" "}
              actually edits, downloads, and emails the PDF.
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                disabled
                title="Demo — sign in to enable editing"
                className="flex-1 rounded-lg border border-border bg-surface px-4 py-3 text-sm font-semibold text-muted cursor-not-allowed"
              >
                Edit
              </button>
              <button
                type="button"
                disabled
                title="Demo — sign in to enable PDF export"
                className="flex-1 rounded-lg bg-accent/40 px-4 py-3 text-sm font-semibold text-white cursor-not-allowed"
              >
                Export as PDF
              </button>
            </div>
            <button
              type="button"
              disabled
              title="Demo — sign in to email the PDF to your institutional address"
              className="w-full rounded-lg border border-dashed border-border bg-surface px-4 py-3 text-sm font-medium text-muted cursor-not-allowed"
            >
              Email PDF to me
            </button>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={resetAll}
                className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground hover:bg-border-light"
              >
                Start a new demo
              </button>
              <a
                href="/"
                className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background text-center hover:opacity-90"
              >
                Back to home
              </a>
            </div>
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
