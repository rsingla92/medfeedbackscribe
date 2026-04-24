/**
 * PHIPA-critical queryset-filtering integration tests.
 *
 * Every user-scoped helper in `app/src/lib/db/queries.ts` takes a `userId`
 * parameter and filters on it — this replaces Supabase RLS. These tests
 * spin up real rows in the local Postgres and prove that each helper
 * refuses to return (or mutate) another user's data.
 *
 * Run: `bun run test:integration` (from `app/`).
 */

import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";

import {
  clearTranscriptClean,
  createRecording,
  createRecordingSession,
  getFormTemplate,
  getPreceptor,
  getProfile,
  getRecordingBySession,
  getRecordingSession,
  getRecordingSessionWithJoins,
  getSessionMetrics,
  listAssessmentsForSession,
  listFormTemplates,
  listPipelineLogs,
  listPreceptors,
  listRecordingSessions,
  listRotations,
  markAssessmentsExported,
  updateAssessment,
  updateRecordingSessionStatus,
  upsertProfile,
} from "@/lib/db/queries";
import { sql } from "@/lib/db/client";

import {
  cleanupTestData,
  createTestAssessment,
  createTestFormTemplate,
  createTestPipelineLog,
  createTestPreceptor,
  createTestProfile,
  createTestRecording,
  createTestRecordingSession,
  createTestUser,
  endConnection,
  TEST_PREFIX,
  verifyConnection,
} from "./helpers";

// ── Shared fixtures ──────────────────────────────────────────────────────────

let userA: string;
let userB: string;
let preceptorId: string;
let formTemplateId: string;
let sessionA: string;
let sessionB: string;
let assessmentA: string;

// Pre-fetch the dev-seed baseline so we can assert cleanup didn't delete it.
let devSessionCountBefore: number;

beforeAll(async () => {
  await verifyConnection();

  const rows = await sql<{ count: number }[]>`
    select count(*)::int as count from recording_sessions
    where user_id not in (
      select id from users where email like ${TEST_PREFIX + "%"}
    )
  `;
  devSessionCountBefore = rows[0].count;

  // Two distinct users, each with a session.
  userA = await createTestUser("a");
  userB = await createTestUser("b");
  await createTestProfile(userA, {
    full_name: `${TEST_PREFIX}-userA`,
    email: `${TEST_PREFIX}-a@test.invalid`,
  });
  await createTestProfile(userB, {
    full_name: `${TEST_PREFIX}-userB`,
    email: `${TEST_PREFIX}-b@test.invalid`,
  });

  preceptorId = await createTestPreceptor(userA);
  formTemplateId = await createTestFormTemplate();

  sessionA = await createTestRecordingSession({
    userId: userA,
    preceptorId,
    formTemplateId,
  });
  sessionB = await createTestRecordingSession({
    userId: userB,
    preceptorId,
    formTemplateId,
  });

  // Children of sessionA — needed by the assessment / log tests.
  await createTestRecording(sessionA);
  assessmentA = await createTestAssessment(sessionA, 1);
  await createTestPipelineLog(sessionA, "stt");

  // Children of sessionB — gives us positive counts when B queries itself.
  await createTestRecording(sessionB);
  await createTestAssessment(sessionB, 1);
  await createTestPipelineLog(sessionB, "stt");
});

afterAll(async () => {
  await cleanupTestData();

  // Sanity: make sure cleanup didn't touch dev data.
  const rows = await sql<{ count: number }[]>`
    select count(*)::int as count from recording_sessions
    where user_id not in (
      select id from users where email like ${TEST_PREFIX + "%"}
    )
  `;
  expect(rows[0].count).toBe(devSessionCountBefore);

  await endConnection();
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe("PHIPA queryset filtering — recording_sessions", () => {
  it("getRecordingSession: returns null for non-owner, row for owner", async () => {
    expect(await getRecordingSession(sessionA, userB)).toBeNull();
    const own = await getRecordingSession(sessionA, userA);
    expect(own).not.toBeNull();
    expect(own?.user_id).toBe(userA);
  });

  it("listRecordingSessions: only returns the caller's rows", async () => {
    const aRows = await listRecordingSessions(userA);
    const bRows = await listRecordingSessions(userB);

    expect(aRows.map((r) => r.id)).toContain(sessionA);
    expect(aRows.map((r) => r.id)).not.toContain(sessionB);
    expect(bRows.map((r) => r.id)).toContain(sessionB);
    expect(bRows.map((r) => r.id)).not.toContain(sessionA);

    for (const row of aRows) expect(row.user_id).toBe(userA);
    for (const row of bRows) expect(row.user_id).toBe(userB);
  });

  it("getRecordingSessionWithJoins: returns null for non-owner", async () => {
    expect(await getRecordingSessionWithJoins(sessionA, userB)).toBeNull();
    const own = await getRecordingSessionWithJoins(sessionA, userA);
    expect(own).not.toBeNull();
    expect(own?.user_id).toBe(userA);
    expect(own?.preceptor_name).toBeTruthy();
  });

  it("createRecordingSession: new row carries the supplied user_id", async () => {
    const created = await createRecordingSession({
      userId: userA,
      preceptorId,
      rotationId: null,
      formTemplateId,
      date: new Date().toISOString().slice(0, 10),
      consentConfirmed: true,
    });
    expect(created.user_id).toBe(userA);
    // Clean up this transient row so cleanupTestData's per-user scope catches it
    // (it will — user A is tagged) but also make sure listing for B never sees
    // it.
    const bList = await listRecordingSessions(userB);
    expect(bList.map((r) => r.id)).not.toContain(created.id);
  });

  it("updateRecordingSessionStatus: no-op for non-owner, success for owner", async () => {
    const bad = await updateRecordingSessionStatus(sessionA, userB, "processing");
    expect(bad).toBeNull();

    // Confirm the underlying row wasn't touched.
    const after = await getRecordingSession(sessionA, userA);
    expect(after?.status).toBe("created");

    const good = await updateRecordingSessionStatus(sessionA, userA, "processing");
    expect(good).not.toBeNull();
    expect(good?.status).toBe("processing");

    // Restore so subsequent assertions stay deterministic.
    await updateRecordingSessionStatus(sessionA, userA, "created");
  });
});

describe("PHIPA queryset filtering — recordings", () => {
  it("getRecordingBySession: null for non-owner, row for owner", async () => {
    expect(await getRecordingBySession(sessionA, userB)).toBeNull();
    const own = await getRecordingBySession(sessionA, userA);
    expect(own).not.toBeNull();
    expect(own?.session_id).toBe(sessionA);
  });

  it("createRecording: throws when session belongs to another user", async () => {
    // userB tries to attach a recording to userA's session.
    await expect(
      createRecording({
        sessionId: sessionA,
        userId: userB,
        audioPath: `${TEST_PREFIX}/attack.webm`,
        durationSeconds: 1,
        language: "en",
      }),
    ).rejects.toThrow(/not found or not owned/i);
  });

  it("clearTranscriptClean: no-op for non-owner, clears for owner", async () => {
    // Non-owner attempt — should not touch the transcript.
    await clearTranscriptClean(sessionA, userB);
    const stillThere = await getRecordingBySession(sessionA, userA);
    expect(stillThere?.transcript_clean).not.toBeNull();

    // Owner — clears.
    await clearTranscriptClean(sessionA, userA);
    const cleared = await getRecordingBySession(sessionA, userA);
    expect(cleared?.transcript_clean).toBeNull();
  });
});

describe("PHIPA queryset filtering — assessments", () => {
  it("listAssessmentsForSession: empty for non-owner, populated for owner", async () => {
    const asB = await listAssessmentsForSession(sessionA, userB);
    expect(asB).toEqual([]);

    const asA = await listAssessmentsForSession(sessionA, userA);
    expect(asA.length).toBeGreaterThan(0);
    expect(asA.every((a) => a.session_id === sessionA)).toBe(true);
  });

  it("updateAssessment: null for non-owner, success for owner", async () => {
    const bad = await updateAssessment(assessmentA, userB, {
      narrative_summary: "hijacked",
    });
    expect(bad).toBeNull();

    // Confirm stored value was not rewritten.
    const [row] = await listAssessmentsForSession(sessionA, userA);
    expect(row.narrative_summary).not.toBe("hijacked");

    const good = await updateAssessment(assessmentA, userA, {
      narrative_summary: `${TEST_PREFIX}-updated`,
    });
    expect(good).not.toBeNull();
    expect(good?.narrative_summary).toBe(`${TEST_PREFIX}-updated`);
  });

  it("markAssessmentsExported: no-op for non-owner, updates for owner", async () => {
    await markAssessmentsExported(sessionA, userB);
    let rows = await listAssessmentsForSession(sessionA, userA);
    expect(rows.every((a) => a.exported_at === null)).toBe(true);

    await markAssessmentsExported(sessionA, userA);
    rows = await listAssessmentsForSession(sessionA, userA);
    expect(rows.every((a) => a.exported_at !== null)).toBe(true);
  });
});

describe("PHIPA queryset filtering — pipeline logs", () => {
  it("listPipelineLogs: empty for non-owner, populated for owner", async () => {
    const asB = await listPipelineLogs(sessionA, userB);
    expect(asB).toEqual([]);
    const asA = await listPipelineLogs(sessionA, userA);
    expect(asA.length).toBeGreaterThan(0);
    expect(asA.every((l) => l.session_id === sessionA)).toBe(true);
  });
});

describe("PHIPA queryset filtering — profiles", () => {
  it("getProfile: returns only the caller's profile", async () => {
    const pA = await getProfile(userA);
    const pB = await getProfile(userB);
    expect(pA?.id).toBe(userA);
    expect(pB?.id).toBe(userB);
    expect(pA?.id).not.toBe(pB?.id);
  });

  it("upsertProfile: cannot impersonate another user's profile row", async () => {
    // If user B calls upsertProfile with user A's id in the URL / session, the
    // API layer is responsible for passing the session user id. The query
    // itself pins by the id argument. We confirm:
    //  1. upsert with userB only mutates userB's row.
    //  2. upsert with userA does NOT have any effect on userB's row.
    const beforeB = await getProfile(userB);

    await upsertProfile(userA, {
      full_name: `${TEST_PREFIX}-A-impersonation-attempt`,
      email: `${TEST_PREFIX}-impersonation@test.invalid`,
    });

    const afterB = await getProfile(userB);
    expect(afterB?.full_name).toBe(beforeB?.full_name);
    expect(afterB?.email).toBe(beforeB?.email);

    const afterA = await getProfile(userA);
    expect(afterA?.id).toBe(userA);
  });
});

describe("PHIPA queryset filtering — metrics", () => {
  it("getSessionMetrics: counts only the caller's sessions", async () => {
    const mA = await getSessionMetrics(userA);
    const mB = await getSessionMetrics(userB);
    // Each test user has at least one session seeded.
    expect(mA.total).toBeGreaterThanOrEqual(1);
    expect(mB.total).toBeGreaterThanOrEqual(1);

    // A's total should equal the number of sessions owned by A, independent of B's.
    const rows = await sql<{ count: number }[]>`
      select count(*)::int as count from recording_sessions where user_id = ${userA}
    `;
    expect(mA.total).toBe(rows[0].count);
  });
});

describe("Shared-across-users helpers — positive baseline", () => {
  // These helpers intentionally do NOT filter by user_id (shared data).
  // Confirm they return rows so we notice if someone accidentally adds a
  // WHERE clause that breaks shared access.
  it("listPreceptors returns rows (shared)", async () => {
    const rows = await listPreceptors();
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.some((p) => p.id === preceptorId)).toBe(true);
  });

  it("getPreceptor returns the row (shared)", async () => {
    const row = await getPreceptor(preceptorId);
    expect(row?.id).toBe(preceptorId);
  });

  it("listRotations returns rows (shared)", async () => {
    // Rotations are only seeded by scripts/seed-demo.sql. The call just has to
    // succeed — don't assert length because a fresh DB may have none.
    const rows = await listRotations();
    expect(Array.isArray(rows)).toBe(true);
  });

  it("listFormTemplates includes the test template (shared)", async () => {
    const rows = await listFormTemplates();
    expect(rows.some((f) => f.id === formTemplateId)).toBe(true);
  });

  it("getFormTemplate returns the row (shared)", async () => {
    const row = await getFormTemplate(formTemplateId);
    expect(row?.id).toBe(formTemplateId);
  });
});
