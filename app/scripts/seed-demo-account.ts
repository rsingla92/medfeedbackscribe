/**
 * Seed the demo account: demo@getdebrief.com / demodemo
 *
 * Creates the auth user, profile, 30 fictional preceptors (TV/film doctors),
 * and 15 pre-baked feedback sessions across 9 rotations. No audio files or
 * Gemini calls — transcripts and extracted fields are written directly.
 *
 * Safe to re-run: wipes the demo user's prior sessions first; preceptors are
 * inserted once and reused.
 *
 * Usage:
 *   cd app
 *   SUPABASE_SERVICE_ROLE_KEY=<key> bunx tsx scripts/seed-demo-account.ts
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

const envPath = resolve(__dirname, "../.env.local");
const envFile = readFileSync(envPath, "utf-8");
function envVar(name: string): string | undefined {
  const m = envFile.match(new RegExp(`^${name}=(.+)$`, "m"));
  return m?.[1]?.trim();
}

const SUPABASE_URL = envVar("NEXT_PUBLIC_SUPABASE_URL");
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || envVar("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL) throw new Error("NEXT_PUBLIC_SUPABASE_URL missing in .env.local");
if (!SERVICE_ROLE_KEY) {
  throw new Error(
    "SUPABASE_SERVICE_ROLE_KEY missing. Pass via env: SUPABASE_SERVICE_ROLE_KEY=... bunx tsx scripts/seed-demo-account.ts",
  );
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const DEMO_EMAIL = "demo@getdebrief.com";
const DEMO_PASSWORD = "demodemo";
const DEMO_PROFILE = {
  full_name: "Cristina Yang",
  program: "UBC Family Medicine",
  specialty: "Family Medicine",
  year_of_training: 2,
  site: "UBC FM",
};

const PRECEPTORS: { name: string; specialty: string }[] = [
  { name: "Dr. Gregory House", specialty: "Internal Medicine" },
  { name: "Dr. Meredith Grey", specialty: "General Surgery" },
  { name: "Dr. Beverly Crusher", specialty: "Family Medicine" },
  { name: "Dr. Leonard McCoy", specialty: "Family Medicine" },
  { name: "Dr. Stephen Strange", specialty: "Internal Medicine" },
  { name: "Dr. John Watson", specialty: "Family Medicine" },
  { name: "Dr. Perry Cox", specialty: "Emergency Medicine" },
  { name: "Dr. John Dorian", specialty: "Internal Medicine" },
  { name: "Dr. Elliot Reid", specialty: "Pediatrics" },
  { name: "Dr. Christopher Turk", specialty: "General Surgery" },
  { name: "Dr. Temperance Brennan", specialty: "Psychiatry" },
  { name: "Dr. Allison Cameron", specialty: "Internal Medicine" },
  { name: "Dr. Eric Foreman", specialty: "Neurology" },
  { name: "Dr. Robert Chase", specialty: "Internal Medicine" },
  { name: "Dr. Lisa Cuddy", specialty: "Internal Medicine" },
  { name: "Dr. James Wilson", specialty: "Palliative Care" },
  { name: "Dr. Emmett Brown", specialty: "Family Medicine" },
  { name: "Dr. Henry Jones", specialty: "Family Medicine" },
  { name: "Dr. Ellie Sattler", specialty: "Internal Medicine" },
  { name: "Dr. Ian Malcolm", specialty: "Internal Medicine" },
  { name: "Dr. Alan Grant", specialty: "Family Medicine" },
  { name: "Dr. Julian Bashir", specialty: "Emergency Medicine" },
  { name: "Dr. Bruce Banner", specialty: "Internal Medicine" },
  { name: "Dr. Miranda Bailey", specialty: "Obstetrics & Gynecology" },
  { name: "Dr. Derek Shepherd", specialty: "Neurology" },
  { name: "Dr. Doug Ross", specialty: "Pediatrics" },
  { name: "Dr. Mark Greene", specialty: "Emergency Medicine" },
  { name: "Dr. Frasier Crane", specialty: "Psychiatry" },
  { name: "Dr. Bob Kelso", specialty: "Geriatrics" },
  { name: "Dr. Hermann Gottlieb", specialty: "Internal Medicine" },
];

const TRES = "T-Res Field Note" as const;
const ONE45 = "One45 Daily Evaluation (Emergency Medicine)" as const;

type AssessmentFixture = {
  structured_fields: Record<string, unknown>;
  competency_tags: string[];
  narrative_summary: string;
  coaching_did_well?: string;
  coaching_consider?: string;
};

type SessionFixture = {
  preceptorName: string;
  rotationName: string;
  formName: typeof TRES | typeof ONE45;
  daysAgo: number;
  status: "ready" | "exported";
  duration_seconds: number;
  transcript: string;
  resident_reviewed: boolean;
  assessments: AssessmentFixture[];
};

const SESSIONS: SessionFixture[] = [
  {
    preceptorName: "Dr. Gregory House",
    rotationName: "Family Medicine Clinic",
    formName: TRES,
    daysAgo: 2,
    status: "exported",
    duration_seconds: 142,
    transcript:
      "Your approach to the diabetic patient today was solid. You took a thorough history — you caught that she'd been skipping her metformin because of GI side effects, which is huge. Your physical was appropriate, you checked her feet and pulses. Where I'd push you is on shared decision making — you kind of steamrolled her into starting an SGLT2 without exploring her concerns first. Next time slow down and ask what matters to her.",
    resident_reviewed: true,
    assessments: [
      {
        structured_fields: {
          activity_type: "Field Note",
          observation_type: "Direct Observation",
          skill_dimension: ["Clinical Reasoning/Skills", "Communication"],
          domain_of_care: "Care of Adults",
          priority_topics: ["Diabetes", "Chronic Disease Management"],
        },
        competency_tags: ["Medical Expert", "Communicator"],
        narrative_summary:
          "Thorough history uncovered non-adherence to metformin due to GI side effects. Appropriate physical exam including foot exam and pulses. Treatment plan was clinically reasonable but shared decision-making was rushed.",
        coaching_did_well:
          "History-taking was thorough and caught an important adherence issue. Physical exam was appropriate and complete for a diabetes follow-up.",
        coaching_consider:
          "Slow down during shared decision-making — explore the patient's concerns before pivoting to a new medication. Lead with what matters to them.",
      },
    ],
  },
  {
    preceptorName: "Dr. Meredith Grey",
    rotationName: "General Surgery",
    formName: TRES,
    daysAgo: 14,
    status: "ready",
    duration_seconds: 186,
    transcript:
      "Quick review on the two cases today. The lap chole — nice work, you handled the triangle of Calot methodically, identified the cystic duct clearly before clipping. Good spatial awareness. On the hernia repair, though, your mesh placement was off-center. You need to spend more time mapping out the anatomy before deploying. Also on the scholarly side — when I asked you about mesh types you were vague. Go read up on it this weekend.",
    resident_reviewed: true,
    assessments: [
      {
        structured_fields: {
          activity_type: "Field Note",
          observation_type: "Direct Observation",
          skill_dimension: ["Clinical Reasoning/Skills"],
          domain_of_care: "Surgical and Procedural Skills",
          priority_topics: ["Other"],
        },
        competency_tags: ["Medical Expert"],
        narrative_summary:
          "Laparoscopic cholecystectomy performed methodically. Triangle of Calot dissected clearly with appropriate identification of the cystic duct before clipping. Strong spatial awareness demonstrated intraoperatively.",
        coaching_did_well:
          "Methodical approach to the triangle of Calot with clear identification of the cystic duct before clipping. Strong intraoperative spatial awareness.",
        coaching_consider:
          "Continue practicing the full methodical flow on less straightforward gallbladder anatomy.",
      },
      {
        structured_fields: {
          activity_type: "Field Note",
          observation_type: "Direct Observation",
          skill_dimension: ["Clinical Reasoning/Skills", "Scholarship"],
          domain_of_care: "Surgical and Procedural Skills",
          priority_topics: ["Other"],
        },
        competency_tags: ["Medical Expert", "Scholar"],
        narrative_summary:
          "Inguinal hernia repair had off-center mesh placement. Anatomic mapping prior to mesh deployment was insufficient. Knowledge base around mesh selection was limited.",
        coaching_did_well: "Completed the case without intraoperative complications.",
        coaching_consider:
          "Spend more time mapping anatomy before deploying mesh. Self-directed reading on mesh types and selection criteria this weekend.",
      },
    ],
  },
  {
    preceptorName: "Dr. Perry Cox",
    rotationName: "Emergency Medicine",
    formName: ONE45,
    daysAgo: 21,
    status: "ready",
    duration_seconds: 214,
    transcript:
      "Alright newbie, here's your shift eval. Medical expert side — your assessments were generally meeting expectations. Your resus of the STEMI was decent, you called cath lab at the right time. Procedures, I'd say inconsistent — your central line attempt was shaky and I had to take over. Communication was solid — families felt heard. Teamwork, you're fine. Manager, we'll say generally meets — you moved patients reasonably. Advocate and scholar, inconsistent, you weren't pushing yourself to teach the med students. Professional, no complaints. Strengths: communication and calm under pressure. Needs work: procedures, and pushing yourself academically.",
    resident_reviewed: false,
    assessments: [
      {
        structured_fields: {
          medical_expert: {
            rating: "Generally Meets",
            comments:
              "STEMI resuscitation appropriately managed with timely cath lab activation. Central line attempt required supervisor takeover.",
          },
          communicator: {
            rating: "Sometimes Exceeds",
            comments: "Families felt heard. Communication is a consistent strength.",
          },
          collaborator: {
            rating: "Generally Meets",
            comments: "Worked well within the team.",
          },
          manager: {
            rating: "Generally Meets",
            comments: "Patient flow reasonable across the shift.",
          },
          advocate: {
            rating: "Inconsistently Meets",
            comments: "Did not consistently engage in medical student teaching.",
          },
          scholar: {
            rating: "Inconsistently Meets",
            comments: "Opportunities to teach learners were missed.",
          },
          professional: {
            rating: "Generally Meets",
            comments: "No concerns raised.",
          },
          strengths:
            "Calm under pressure. Strong communication with patients and families.",
          needs_improvement:
            "Procedural confidence — especially central lines. Increase engagement with teaching and scholarship.",
        },
        competency_tags: [
          "Medical Expert",
          "Communicator",
          "Collaborator",
          "Manager",
          "Scholar",
          "Professional",
        ],
        narrative_summary:
          "Shift demonstrated generally meeting expectations across medical expert, manager, collaborator and professional roles. Communication emerged as a clear strength. Procedural skills and engagement in scholarship and teaching remain areas for focused improvement.",
      },
    ],
  },
  {
    preceptorName: "Dr. Miranda Bailey",
    rotationName: "Obstetrics & Gynecology",
    formName: TRES,
    daysAgo: 28,
    status: "ready",
    duration_seconds: 124,
    transcript:
      "Prenatal visit today — you did well reviewing the GTT results with the patient and explaining what gestational diabetes means for her pregnancy. Your teaching on nutrition was patient-centered. Where you need to improve: you missed asking about fetal movement, that's a must-ask question after 28 weeks. Also your Leopolds technique was rough — you weren't confident with the second maneuver. Practice that.",
    resident_reviewed: true,
    assessments: [
      {
        structured_fields: {
          activity_type: "Field Note",
          observation_type: "Direct Observation",
          skill_dimension: ["Communication", "Clinical Reasoning/Skills"],
          domain_of_care: "Maternity and Newborn Care",
          priority_topics: ["Pregnancy", "Diabetes"],
        },
        competency_tags: ["Medical Expert", "Communicator"],
        narrative_summary:
          "Prenatal visit with gestational diabetes counseling. GTT results explained clearly and nutritional counseling was patient-centered. Missed fetal movement inquiry (standard after 28 weeks). Leopold maneuvers lacked confidence, particularly the second maneuver.",
        coaching_did_well:
          "Clear patient-centered explanation of gestational diabetes and nutrition counseling that connected to the patient's daily routine.",
        coaching_consider:
          "Always ask about fetal movement after 28 weeks — it is a required question. Practice the four Leopold maneuvers until all four flow without hesitation.",
      },
    ],
  },
  {
    preceptorName: "Dr. Frasier Crane",
    rotationName: "Psychiatry",
    formName: TRES,
    daysAgo: 35,
    status: "ready",
    duration_seconds: 198,
    transcript:
      "Today's session was a complex one. Your therapeutic alliance with that patient was really impressive — she opened up in ways I haven't seen her do with other trainees. You listened actively. Where you struggled was the formulation — you jumped to a diagnosis of major depression without fully considering the bipolar spectrum, despite the history of mood instability. Next time, take your time with the differential. Also, your documentation after was thin — risk assessment needs to be more explicit.",
    resident_reviewed: true,
    assessments: [
      {
        structured_fields: {
          activity_type: "Field Note",
          observation_type: "Direct Observation",
          skill_dimension: ["Communication", "Clinical Reasoning/Skills"],
          domain_of_care: "Mental Health and Addictions Care",
          priority_topics: ["Mental Health", "Anxiety/Depression"],
        },
        competency_tags: ["Medical Expert", "Communicator"],
        narrative_summary:
          "Complex psychiatric session. Therapeutic alliance was notably strong — the patient disclosed material she had not shared with other trainees. Formulation anchored prematurely on major depression without adequate consideration of bipolar spectrum. Documentation lacked explicit risk assessment.",
        coaching_did_well:
          "Exceptional therapeutic alliance — active listening created space for meaningful disclosure.",
        coaching_consider:
          "Broaden the differential before anchoring on MDD, especially with any history of mood instability. Document risk assessment explicitly.",
      },
    ],
  },
  {
    preceptorName: "Dr. Lisa Cuddy",
    rotationName: "Internal Medicine",
    formName: TRES,
    daysAgo: 42,
    status: "ready",
    duration_seconds: 154,
    transcript:
      "Your consult on the heart failure patient was well organized. You got the volume status right — JVP, crackles, edema — and your plan for diuresis was appropriate. One thing to tighten: you didn't address the underlying etiology. You treated the failure but didn't ask why. Is this ischemic? Valvular? New cardiomyopathy? That's the question that makes you a consultant versus a technician.",
    resident_reviewed: false,
    assessments: [
      {
        structured_fields: {
          activity_type: "Field Note",
          observation_type: "Direct Observation",
          skill_dimension: ["Clinical Reasoning/Skills"],
          domain_of_care: "Care of Adults",
          priority_topics: ["Chest Pain", "Chronic Disease Management"],
        },
        competency_tags: ["Medical Expert"],
        narrative_summary:
          "Heart failure consult was well organized. Volume status assessment accurately used JVP, crackles and peripheral edema. Diuresis plan was clinically appropriate. Etiologic workup was not addressed.",
        coaching_did_well:
          "Well-organized consult with accurate volume status assessment and appropriate diuresis plan.",
        coaching_consider:
          "Always frame the underlying etiology — ischemic, valvular, new cardiomyopathy — not just the acute management. Consultants ask why.",
      },
    ],
  },
  {
    preceptorName: "Dr. Elliot Reid",
    rotationName: "Pediatrics",
    formName: TRES,
    daysAgo: 48,
    status: "exported",
    duration_seconds: 176,
    transcript:
      "That was a beautiful well-child visit. You built rapport with the toddler using that little penguin toy, you got through the full exam without any tears. Your developmental screening was thorough and you caught that he's behind on expressive language — good pickup. You counseled the parents on sleep hygiene clearly and with empathy. Honestly I don't have much to improve on here. If I'm nitpicking, you could have been more explicit about next steps for the language delay — does he need SLP referral, or watchful waiting?",
    resident_reviewed: true,
    assessments: [
      {
        structured_fields: {
          activity_type: "Field Note",
          observation_type: "Direct Observation",
          skill_dimension: ["Communication", "Clinical Reasoning/Skills"],
          domain_of_care: "Care of Children and Adolescents",
          priority_topics: ["Well Child Visit", "Preventive Care"],
        },
        competency_tags: ["Medical Expert", "Communicator", "Health Advocate"],
        narrative_summary:
          "Exemplary well-child visit. Strong rapport with the toddler enabled a complete exam. Developmental screening correctly identified expressive language delay. Sleep hygiene counseling was empathic and clear.",
        coaching_did_well:
          "Built rapport with the toddler before starting the exam — completed the full physical without distress. Strong developmental screen with accurate pickup of expressive language delay.",
        coaching_consider:
          "Close the loop explicitly on findings like the language delay — specify SLP referral or watchful waiting, with a timeline for re-check.",
      },
    ],
  },
  {
    preceptorName: "Dr. Bob Kelso",
    rotationName: "Geriatrics",
    formName: TRES,
    daysAgo: 56,
    status: "ready",
    duration_seconds: 221,
    transcript:
      "Two patients today. The frailty assessment on Mrs. Chen — solid. You used the clinical frailty scale appropriately, your functional history was detailed, you asked about goals of care which most residents forget. Good job. On the medication review for Mr. Davies, though, you missed that he's on both a benzo and an opioid. That combo is a red flag in an 82-year-old. You should have flagged deprescribing as priority number one. Beers criteria — review them.",
    resident_reviewed: true,
    assessments: [
      {
        structured_fields: {
          activity_type: "Field Note",
          observation_type: "Direct Observation",
          skill_dimension: ["Clinical Reasoning/Skills", "Communication"],
          domain_of_care: "Care of the Elderly",
          priority_topics: ["Chronic Disease Management"],
        },
        competency_tags: ["Medical Expert", "Communicator"],
        narrative_summary:
          "Frailty assessment was thorough. Clinical Frailty Scale applied correctly. Functional history was detailed. Goals of care conversation was initiated, which is frequently missed at this training stage.",
        coaching_did_well:
          "Applied the Clinical Frailty Scale correctly and integrated a goals-of-care conversation — a consistent gap for residents at this stage.",
        coaching_consider:
          "Continue building the frailty assessment habit on every geriatric encounter.",
      },
      {
        structured_fields: {
          activity_type: "Field Note",
          observation_type: "Direct Observation",
          skill_dimension: ["Clinical Reasoning/Skills"],
          domain_of_care: "Care of the Elderly",
          priority_topics: ["Drug Prescribing/Interaction", "Pain Management"],
        },
        competency_tags: ["Medical Expert"],
        narrative_summary:
          "Medication review missed a high-risk concurrent benzodiazepine and opioid combination in an 82-year-old. Deprescribing opportunity not identified.",
        coaching_did_well: "Completed a structured medication review.",
        coaching_consider:
          "Review the Beers Criteria. Flag concurrent benzo + opioid combinations as top deprescribing priority in older adults.",
      },
    ],
  },
  {
    preceptorName: "Dr. James Wilson",
    rotationName: "Palliative Care",
    formName: TRES,
    daysAgo: 63,
    status: "ready",
    duration_seconds: 168,
    transcript:
      "Goals of care conversation today — a hard one. You did well with the silence — you let the patient cry, you didn't fill the space with platitudes. That's rare in a trainee. Your transition to code status was smooth. One thing: when the daughter pushed back on the DNR, you got defensive. Rather than defend the recommendation, reflect her fear. Name it. 'It sounds like this feels like giving up.' That shifts the conversation.",
    resident_reviewed: true,
    assessments: [
      {
        structured_fields: {
          activity_type: "Field Note",
          observation_type: "Direct Observation",
          skill_dimension: ["Communication", "Professionalism"],
          domain_of_care: "Palliative and End of Life Care",
          priority_topics: ["Palliative Care"],
        },
        competency_tags: ["Communicator", "Professional"],
        narrative_summary:
          "Goals-of-care conversation handled with unusual skill for a trainee. Silence was used effectively and transition to code status was smooth. Became defensive under family pushback on DNR.",
        coaching_did_well:
          "Comfortable with silence — let the patient feel emotion without filling space with platitudes. Smooth transition to code status conversation.",
        coaching_consider:
          "When family members push back, reflect the underlying fear rather than defending the recommendation — name the emotion explicitly.",
      },
    ],
  },
  {
    preceptorName: "Dr. Julian Bashir",
    rotationName: "Emergency Medicine",
    formName: ONE45,
    daysAgo: 70,
    status: "ready",
    duration_seconds: 232,
    transcript:
      "Overall a strong shift. Medical expert — you were generally meeting, with a strong moment on the pulmonary embolism workup, you risk-stratified appropriately using PERC then Wells. Procedures, your LP was clean, first try. Judgment was good — you didn't CT-scan every headache. Communication excellent with the agitated patient, you de-escalated without me even getting involved. Teamwork, solid. Manager, we can improve — your flow slowed down in the middle of the shift and you had five patients queued. Learn to disposition faster. Advocate and scholar were generally meeting. Professional excellent.",
    resident_reviewed: true,
    assessments: [
      {
        structured_fields: {
          medical_expert: {
            rating: "Sometimes Exceeds",
            comments:
              "Strong PE workup with appropriate PERC then Wells risk stratification. Judgment sound — avoided reflex CT for benign headaches. Clean first-attempt LP.",
          },
          communicator: {
            rating: "Consistently Exceeds",
            comments:
              "De-escalated an agitated patient independently. Communication is a clear strength.",
          },
          collaborator: {
            rating: "Generally Meets",
            comments: "Worked well with nursing and consult teams.",
          },
          manager: {
            rating: "Inconsistently Meets",
            comments:
              "Flow slowed mid-shift; queued up five patients. Disposition speed needs work.",
          },
          advocate: {
            rating: "Generally Meets",
            comments: "Appropriate engagement with patients and families.",
          },
          scholar: {
            rating: "Generally Meets",
            comments: "Demonstrated evidence-based use of clinical decision rules.",
          },
          professional: {
            rating: "Consistently Exceeds",
            comments: "Professional conduct exemplary throughout the shift.",
          },
          strengths:
            "Patient communication and de-escalation. Appropriate use of clinical decision rules.",
          needs_improvement:
            "Disposition speed and managing patient queue size during high-volume periods.",
        },
        competency_tags: [
          "Medical Expert",
          "Communicator",
          "Manager",
          "Scholar",
          "Professional",
        ],
        narrative_summary:
          "Strong overall shift with standout communication and sound use of clinical decision rules (PERC, Wells, judicious neuroimaging). Procedural skills progressing. Queue management and disposition speed are the next growth edges.",
      },
    ],
  },
  {
    preceptorName: "Dr. Leonard McCoy",
    rotationName: "Family Medicine Clinic",
    formName: TRES,
    daysAgo: 77,
    status: "ready",
    duration_seconds: 138,
    transcript:
      "Hypertension follow-up. You reviewed the home BP log well and noticed the morning spikes. Your titration plan for the ACE inhibitor was reasonable. Critique: you didn't address the salt intake or the weight gain. Lifestyle is 50% of the story in hypertension and you skipped over it. Also, counseling was one-way — you lectured. Motivational interviewing. Use it.",
    resident_reviewed: false,
    assessments: [
      {
        structured_fields: {
          activity_type: "Field Note",
          observation_type: "Direct Observation",
          skill_dimension: ["Clinical Reasoning/Skills", "Communication"],
          domain_of_care: "Care of Adults",
          priority_topics: ["Hypertension", "Preventive Care"],
        },
        competency_tags: ["Medical Expert", "Communicator"],
        narrative_summary:
          "Hypertension follow-up handled with sound medication management. Home BP log interpretation caught morning hypertension and titration plan was reasonable. Lifestyle counseling — salt, weight — was not addressed. Counseling style was didactic rather than collaborative.",
        coaching_did_well:
          "Sound interpretation of home BP log; caught morning hypertension pattern and titrated the ACE inhibitor appropriately.",
        coaching_consider:
          "Lifestyle — salt, weight — is half the story in HTN. Use motivational interviewing rather than one-way counseling.",
      },
    ],
  },
  {
    preceptorName: "Dr. Stephen Strange",
    rotationName: "Internal Medicine",
    formName: TRES,
    daysAgo: 84,
    status: "ready",
    duration_seconds: 172,
    transcript:
      "Sepsis workup on the admission today. Your resuscitation timeline was appropriate — lactate, cultures, broad-spectrum within the hour. Great. The gap was differential breadth — you anchored on pneumonia and never seriously considered biliary source despite the right upper quadrant tenderness. Broaden your mental model for septic shock. And your documentation of your thinking was minimal — write down why you ordered what you ordered.",
    resident_reviewed: true,
    assessments: [
      {
        structured_fields: {
          activity_type: "Field Note",
          observation_type: "Direct Observation",
          skill_dimension: ["Clinical Reasoning/Skills"],
          domain_of_care: "Care of Adults",
          priority_topics: ["Abdominal Pain", "Chronic Disease Management"],
        },
        competency_tags: ["Medical Expert", "Scholar"],
        narrative_summary:
          "Sepsis resuscitation timeline met one-hour bundle expectations (lactate, cultures, broad-spectrum antibiotics). Differential anchored prematurely on pneumonia — biliary source was not seriously considered despite right-upper-quadrant tenderness. Documentation of clinical reasoning was thin.",
        coaching_did_well:
          "Hit the one-hour sepsis bundle — lactate, cultures, and broad-spectrum antibiotics within the hour.",
        coaching_consider:
          "Broaden the septic shock differential — biliary, urinary, skin/soft tissue, CNS — especially when physical findings point elsewhere. Document clinical reasoning alongside orders.",
      },
    ],
  },
  {
    preceptorName: "Dr. Christopher Turk",
    rotationName: "Pediatrics",
    formName: TRES,
    daysAgo: 91,
    status: "ready",
    duration_seconds: 287,
    transcript:
      "Three cases to review. First, the bronchiolitis admission — your assessment of work of breathing was spot on, you correctly identified moderate severity and initiated high-flow nasal cannula. Good. Second case, the kid with fever and rash — you jumped to Kawasaki too quickly without meeting criteria. Slow down, apply the criteria methodically. Third, the teen with abdominal pain, you were dismissive — she was embarrassed and you didn't pick up on it. Check in on mental health and psychosocial stuff with adolescents, always.",
    resident_reviewed: false,
    assessments: [
      {
        structured_fields: {
          activity_type: "Field Note",
          observation_type: "Direct Observation",
          skill_dimension: ["Clinical Reasoning/Skills"],
          domain_of_care: "Care of Children and Adolescents",
          priority_topics: ["Cough/Dyspnea"],
        },
        competency_tags: ["Medical Expert"],
        narrative_summary:
          "Bronchiolitis admission assessed accurately. Work-of-breathing evaluation correctly identified moderate severity. High-flow nasal cannula initiated appropriately.",
        coaching_did_well:
          "Accurate work-of-breathing assessment. Appropriate escalation to HFNC for moderate severity.",
        coaching_consider:
          "Continue practicing systematic severity scoring for bronchiolitis.",
      },
      {
        structured_fields: {
          activity_type: "Field Note",
          observation_type: "Direct Observation",
          skill_dimension: ["Clinical Reasoning/Skills"],
          domain_of_care: "Care of Children and Adolescents",
          priority_topics: ["Rash", "Other"],
        },
        competency_tags: ["Medical Expert", "Scholar"],
        narrative_summary:
          "Fever-and-rash presentation. Kawasaki disease considered prematurely without applying classic diagnostic criteria methodically.",
        coaching_did_well:
          "Recognized Kawasaki as a possibility in fever plus rash — a reasonable zebra to keep on the list.",
        coaching_consider:
          "Apply Kawasaki criteria step by step before committing to the diagnosis. Consider broader febrile exanthem differential first.",
      },
      {
        structured_fields: {
          activity_type: "Field Note",
          observation_type: "Direct Observation",
          skill_dimension: ["Communication", "Professionalism"],
          domain_of_care: "Care of Children and Adolescents",
          priority_topics: ["Mental Health", "Abdominal Pain"],
        },
        competency_tags: ["Communicator", "Professional"],
        narrative_summary:
          "Adolescent with abdominal pain. Patient embarrassment cues were missed and the interaction came across as dismissive. Mental health and psychosocial screening were not explored.",
        coaching_did_well:
          "Took an appropriate somatic history for abdominal pain.",
        coaching_consider:
          "With adolescents, always screen for psychosocial context and mental health. Read embarrassment cues — tone and pace matter as much as content.",
      },
    ],
  },
  {
    preceptorName: "Dr. Perry Cox",
    rotationName: "Emergency Medicine",
    formName: ONE45,
    daysAgo: 98,
    status: "ready",
    duration_seconds: 203,
    transcript:
      "Better shift than last time, newbie. I'll give you that. Your procedures were sharper — your central line was textbook this time. Medical expert still generally meeting but I saw real improvement on the chest pain workup. You used the HEART score properly. Communication excellent again — that's your strength, lean into it. Teamwork, manager, advocate, scholar — all generally meeting. You're showing real progress.",
    resident_reviewed: false,
    assessments: [
      {
        structured_fields: {
          medical_expert: {
            rating: "Generally Meets",
            comments:
              "Notable improvement on chest pain workup — HEART score applied properly. Central line placement textbook first attempt.",
          },
          communicator: {
            rating: "Consistently Exceeds",
            comments: "Communication remains a clear strength shift over shift.",
          },
          collaborator: {
            rating: "Generally Meets",
            comments: "Good team integration.",
          },
          manager: {
            rating: "Generally Meets",
            comments: "Flow management adequate.",
          },
          advocate: {
            rating: "Generally Meets",
            comments: "Appropriate advocacy.",
          },
          scholar: {
            rating: "Generally Meets",
            comments: "Evidence-based application of decision rules.",
          },
          professional: {
            rating: "Sometimes Exceeds",
            comments: "Professional throughout.",
          },
          strengths:
            "Patient communication. Improved procedural skill — central line textbook this shift.",
          needs_improvement:
            "Continue building breadth across medical expert competencies.",
        },
        competency_tags: [
          "Medical Expert",
          "Communicator",
          "Collaborator",
          "Manager",
          "Scholar",
          "Professional",
        ],
        narrative_summary:
          "Clear shift-over-shift progress. Procedural skill substantially improved. Appropriate use of HEART score. Communication remains a consistent exceeding-expectations strength.",
      },
    ],
  },
  {
    preceptorName: "Dr. Temperance Brennan",
    rotationName: "Psychiatry",
    formName: TRES,
    daysAgo: 105,
    status: "ready",
    duration_seconds: 191,
    transcript:
      "Suicide risk assessment on the ED consult. Your structured assessment was solid — you went through the Columbia scale, asked about means access, prior attempts, protective factors. That was thorough. Where I'd push you is on tone — the patient said you sounded like you were reading from a checklist. For this kind of conversation, put the clipboard down, look at them. Also your disposition reasoning wasn't well documented. Why admission versus discharge? Make that explicit.",
    resident_reviewed: true,
    assessments: [
      {
        structured_fields: {
          activity_type: "Field Note",
          observation_type: "Direct Observation",
          skill_dimension: ["Clinical Reasoning/Skills", "Communication"],
          domain_of_care: "Mental Health and Addictions Care",
          priority_topics: ["Mental Health"],
        },
        competency_tags: ["Medical Expert", "Communicator"],
        narrative_summary:
          "Suicide risk assessment was structurally complete — Columbia scale applied with inquiry into means, prior attempts, and protective factors. Patient experienced the interaction as checklist-driven. Disposition reasoning not documented explicitly.",
        coaching_did_well:
          "Structurally complete risk assessment covering means, prior attempts, and protective factors.",
        coaching_consider:
          "Balance structured content with presence — set the clipboard aside, let the conversation breathe. Document the admission versus discharge reasoning explicitly.",
      },
    ],
  },
];

async function main() {
  console.log(`Supabase: ${SUPABASE_URL}`);

  console.log(`\nEnsuring ${PRECEPTORS.length} fictional preceptors...`);
  const { data: existing, error: listErr } = await admin
    .from("preceptors")
    .select("name");
  if (listErr) throw listErr;
  const existingNames = new Set((existing ?? []).map((r) => r.name));
  const toInsert = PRECEPTORS.filter((p) => !existingNames.has(p.name));
  if (toInsert.length > 0) {
    const { error } = await admin
      .from("preceptors")
      .insert(toInsert.map((p) => ({ ...p, site: "Demo" })));
    if (error) throw error;
    console.log(`  inserted ${toInsert.length} new preceptors`);
  } else {
    console.log(`  all 30 preceptors already present`);
  }

  const { data: allPreceptors, error: pErr } = await admin
    .from("preceptors")
    .select("id, name")
    .in(
      "name",
      PRECEPTORS.map((p) => p.name),
    );
  if (pErr) throw pErr;
  const preceptorIdByName = Object.fromEntries(
    (allPreceptors ?? []).map((p) => [p.name, p.id as string]),
  );

  const { data: rotations, error: rErr } = await admin
    .from("rotations")
    .select("id, name");
  if (rErr) throw rErr;
  const rotationIdByName = Object.fromEntries(
    (rotations ?? []).map((r) => [r.name, r.id as string]),
  );

  const { data: forms, error: fErr } = await admin
    .from("form_templates")
    .select("id, name");
  if (fErr) throw fErr;
  const formIdByName = Object.fromEntries(
    (forms ?? []).map((f) => [f.name, f.id as string]),
  );

  console.log(`\nEnsuring demo auth user ${DEMO_EMAIL}...`);
  let userId: string | undefined;
  let page = 1;
  while (!userId) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw error;
    const match = data.users.find((u) => u.email === DEMO_EMAIL);
    if (match) userId = match.id;
    if (data.users.length < 200) break;
    page++;
  }

  if (userId) {
    console.log(`  user exists (${userId})`);
    const { error } = await admin.auth.admin.updateUserById(userId, {
      password: DEMO_PASSWORD,
      email_confirm: true,
    });
    if (error) throw error;
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      email_confirm: true,
    });
    if (error) throw error;
    userId = data.user.id;
    console.log(`  created user (${userId})`);
  }

  console.log(`\nUpserting profile...`);
  const { error: profileErr } = await admin
    .from("profiles")
    .upsert({ id: userId, ...DEMO_PROFILE });
  if (profileErr) throw profileErr;

  console.log(`\nClearing prior demo sessions...`);
  const { error: delErr, count } = await admin
    .from("sessions")
    .delete({ count: "exact" })
    .eq("user_id", userId);
  if (delErr) throw delErr;
  console.log(`  deleted ${count ?? 0} prior sessions (cascaded recordings + assessments)`);

  console.log(`\nInserting ${SESSIONS.length} sessions...`);
  for (let i = 0; i < SESSIONS.length; i++) {
    const s = SESSIONS[i];
    const preceptorId = preceptorIdByName[s.preceptorName];
    const rotationId = rotationIdByName[s.rotationName];
    const formId = formIdByName[s.formName];

    if (!preceptorId) throw new Error(`preceptor not found: ${s.preceptorName}`);
    if (!rotationId) throw new Error(`rotation not found: ${s.rotationName}`);
    if (!formId) throw new Error(`form template not found: ${s.formName}`);

    const date = new Date();
    date.setDate(date.getDate() - s.daysAgo);
    const dateStr = date.toISOString().slice(0, 10);

    const { data: session, error: sessErr } = await admin
      .from("sessions")
      .insert({
        user_id: userId,
        preceptor_id: preceptorId,
        rotation_id: rotationId,
        form_template_id: formId,
        date: dateStr,
        consent_confirmed: true,
        status: s.status,
      })
      .select("id")
      .single();
    if (sessErr) throw sessErr;

    const { error: recErr } = await admin.from("recordings").insert({
      session_id: session.id,
      audio_path: null,
      duration_seconds: s.duration_seconds,
      transcript_raw: s.transcript,
      transcript_clean: s.transcript,
      language: "en",
      stt_confidence: 0.94,
    });
    if (recErr) throw recErr;

    const exportedAt =
      s.status === "exported"
        ? new Date(date.getTime() + 60 * 60 * 1000).toISOString()
        : null;

    const { error: asmErr } = await admin.from("assessments").insert(
      s.assessments.map((a, idx) => ({
        session_id: session.id,
        output_index: idx + 1,
        structured_fields: a.structured_fields,
        competency_tags: a.competency_tags,
        narrative_summary: a.narrative_summary,
        coaching_did_well: a.coaching_did_well ?? null,
        coaching_consider: a.coaching_consider ?? null,
        resident_reviewed: s.resident_reviewed,
        resident_edited: false,
        exported_at: exportedAt,
      })),
    );
    if (asmErr) throw asmErr;

    console.log(
      `  [${String(i + 1).padStart(2, "0")}/${SESSIONS.length}] ${s.rotationName} · ${s.preceptorName} · ${s.formName} · ${s.assessments.length} output(s)`,
    );
  }

  console.log(`\nDone.`);
  console.log(`  Email:    ${DEMO_EMAIL}`);
  console.log(`  Password: ${DEMO_PASSWORD}`);
  console.log(`  Profile:  ${DEMO_PROFILE.full_name} (${DEMO_PROFILE.program}, PGY-${DEMO_PROFILE.year_of_training})`);
  console.log(`  Sessions: ${SESSIONS.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
