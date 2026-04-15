/**
 * Unit tests for app/src/app/api/process/route.ts
 *
 * Strategy: mock `@/lib/supabase/server` to return a configurable Supabase
 * client stub, and mock `@/lib/pipeline/index` so runPipeline never makes
 * real network calls.  `next/headers` (cookies) is also mocked so the server
 * helper can be imported outside a Next.js runtime.
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from "vitest";

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";
const USER_ID = "user-111-0000-0000-000000000000";

/** Build a minimal Request for the POST handler */
function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/process", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ──────────────────────────────────────────────────────────────────────────────
// Mock: next/server — capture after() callbacks for testing
// ──────────────────────────────────────────────────────────────────────────────

/** Captured after() callbacks, executed manually in tests that need it. */
const afterCallbacks: Array<() => unknown> = [];

vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return {
    ...actual,
    after: vi.fn((cb: () => unknown) => {
      afterCallbacks.push(cb);
    }),
  };
});

// ──────────────────────────────────────────────────────────────────────────────
// Mock: next/headers (required by createClient)
// ──────────────────────────────────────────────────────────────────────────────
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    getAll: () => [],
    set: vi.fn(),
  }),
}));

// ──────────────────────────────────────────────────────────────────────────────
// Mock: @/lib/pipeline/index
// ──────────────────────────────────────────────────────────────────────────────
const mockRunPipeline = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/pipeline/index", () => ({
  runPipeline: (...args: unknown[]) => mockRunPipeline(...args),
}));

// ──────────────────────────────────────────────────────────────────────────────
// Supabase client factory helpers
// ──────────────────────────────────────────────────────────────────────────────

type ChainResult<T> = { data: T; error: null } | { data: null; error: { message: string } };

function ok<T>(data: T): ChainResult<T> {
  return { data, error: null };
}
function err(msg: string): { data: null; error: { message: string } } {
  return { data: null, error: { message: msg } };
}

interface SupabaseStubOptions {
  user?: { id: string; email: string } | null;
  authError?: boolean;
  session?: Record<string, unknown> | null;
  sessionError?: boolean;
  recording?: { audio_path: string; language: string } | null;
  recordingError?: boolean;
  signedUrl?: string | null;
  signedUrlError?: boolean;
  preceptor?: { name: string; email: string } | null;
  profile?: { full_name: string } | null;
  rotation?: { name: string } | null;
  formTemplate?: Record<string, unknown> | null;
  formTemplateError?: boolean;
}

function makeSupabaseClient(opts: SupabaseStubOptions) {
  const user =
    opts.user !== undefined
      ? opts.user
      : { id: USER_ID, email: "resident@example.com" };

  const client = {
    auth: {
      getUser: vi.fn().mockResolvedValue(
        opts.authError
          ? { data: { user: null }, error: { message: "auth error" } }
          : { data: { user }, error: null }
      ),
    },
    from: vi.fn((table: string) => {
      const builder = {
        select: vi.fn(() => builder),
        eq: vi.fn(() => builder),
        update: vi.fn(() => builder),
        insert: vi.fn(() => Promise.resolve(ok([]))),
        single: vi.fn(() => {
          if (table === "sessions") {
            if (opts.sessionError) return Promise.resolve(err("not found"));
            return Promise.resolve(
              ok(
                opts.session !== undefined
                  ? opts.session
                  : {
                      id: VALID_UUID,
                      user_id: USER_ID,
                      form_template_id: "ft-0000-0000-0000-000000000000",
                      preceptor_id: "pr-0000-0000-0000-000000000000",
                      rotation_id: "rot-000-0000-0000-000000000000",
                      date: "2026-04-14",
                      status: "pending",
                    }
              )
            );
          }
          if (table === "recordings") {
            if (opts.recordingError) return Promise.resolve(err("no recording"));
            return Promise.resolve(
              ok(
                opts.recording !== undefined
                  ? opts.recording
                  : {
                      audio_path: "recordings/test.webm",
                      language: "en",
                    }
              )
            );
          }
          if (table === "preceptors") {
            return Promise.resolve(
              ok(
                opts.preceptor !== undefined
                  ? opts.preceptor
                  : { name: "Dr. Smith", email: "preceptor@hospital.ca" }
              )
            );
          }
          if (table === "profiles") {
            return Promise.resolve(
              ok(
                opts.profile !== undefined
                  ? opts.profile
                  : { full_name: "Jane Resident" }
              )
            );
          }
          if (table === "rotations") {
            return Promise.resolve(
              ok(
                opts.rotation !== undefined
                  ? opts.rotation
                  : { name: "Internal Medicine" }
              )
            );
          }
          if (table === "form_templates") {
            if (opts.formTemplateError) return Promise.resolve(err("not found"));
            return Promise.resolve(
              ok(
                opts.formTemplate !== undefined
                  ? opts.formTemplate
                  : {
                      name: "T-Res Field Note",
                      extraction_mode: "multi",
                      max_outputs: 5,
                      fields: { rating: { type: "scale", min: 1, max: 5 } },
                      competency_framework: "CanMEDS",
                    }
              )
            );
          }
          return Promise.resolve(ok(null));
        }),
      };
      // update() returns a builder with .eq()
      builder.update.mockImplementation(() => ({
        eq: () => Promise.resolve(ok(null)),
      }));
      return builder;
    }),
    storage: {
      from: vi.fn(() => ({
        createSignedUrl: vi.fn().mockResolvedValue(
          opts.signedUrlError
            ? err("storage error")
            : ok({
                signedUrl:
                  opts.signedUrl !== undefined
                    ? opts.signedUrl
                    : "https://storage.example.com/signed",
              })
        ),
      })),
    },
  };
  return client;
}

// ──────────────────────────────────────────────────────────────────────────────
// Mock: @/lib/supabase/server
// ──────────────────────────────────────────────────────────────────────────────
let currentSupabaseClient: ReturnType<typeof makeSupabaseClient>;

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => Promise.resolve(currentSupabaseClient)),
}));

// ──────────────────────────────────────────────────────────────────────────────
// Import route AFTER mocks are in place
// ──────────────────────────────────────────────────────────────────────────────
import { POST } from "@/app/api/process/route";
import { after } from "next/server";

// ──────────────────────────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────────────────────────

describe("POST /api/process", () => {
  const savedDeepgram = process.env.DEEPGRAM_API_KEY;
  const savedAnthropic = process.env.ANTHROPIC_API_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    afterCallbacks.length = 0;
    mockRunPipeline.mockResolvedValue(undefined);
    process.env.DEEPGRAM_API_KEY = "test-deepgram-key";
    process.env.ANTHROPIC_API_KEY = "test-anthropic-key";
  });

  afterEach(() => {
    process.env.DEEPGRAM_API_KEY = savedDeepgram;
    process.env.ANTHROPIC_API_KEY = savedAnthropic;
  });

  // ── 1. Unauthenticated ────────────────────────────────────────────────────
  it("returns 401 when getUser returns an auth error", async () => {
    currentSupabaseClient = makeSupabaseClient({ authError: true });
    const res = await POST(makeRequest({ sessionId: VALID_UUID }) as never);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("returns 401 when getUser returns null user", async () => {
    currentSupabaseClient = makeSupabaseClient({ user: null });
    const res = await POST(makeRequest({ sessionId: VALID_UUID }) as never);
    expect(res.status).toBe(401);
  });

  // ── 2. Session not found / RLS returns none ───────────────────────────────
  it("returns 404 when session does not exist (RLS hides it)", async () => {
    currentSupabaseClient = makeSupabaseClient({ session: null });
    const res = await POST(makeRequest({ sessionId: VALID_UUID }) as never);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/session not found/i);
  });

  it("returns 404 when session query returns an error", async () => {
    currentSupabaseClient = makeSupabaseClient({ sessionError: true });
    const res = await POST(makeRequest({ sessionId: VALID_UUID }) as never);
    expect(res.status).toBe(404);
  });

  // ── 3. Invalid UUID ───────────────────────────────────────────────────────
  it("returns 400 when sessionId is absent", async () => {
    currentSupabaseClient = makeSupabaseClient({});
    const res = await POST(makeRequest({}) as never);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/sessionId/i);
  });

  it("returns 400 when sessionId is not a valid UUID string", async () => {
    currentSupabaseClient = makeSupabaseClient({});
    const res = await POST(makeRequest({ sessionId: "not-a-uuid" }) as never);
    expect(res.status).toBe(400);
  });

  it("returns 400 when sessionId is a number instead of string", async () => {
    currentSupabaseClient = makeSupabaseClient({});
    const res = await POST(makeRequest({ sessionId: 12345 }) as never);
    expect(res.status).toBe(400);
  });

  // ── 4. Happy path ─────────────────────────────────────────────────────────
  it("registers runPipeline via after() with the correct input shape and returns 202", async () => {
    currentSupabaseClient = makeSupabaseClient({});
    const res = await POST(makeRequest({ sessionId: VALID_UUID }) as never);
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body).toMatchObject({ success: true, status: "processing" });

    // after() should have been called once; runPipeline is NOT called yet
    expect(after).toHaveBeenCalledOnce();
    expect(mockRunPipeline).not.toHaveBeenCalled();

    // Drain the after() callback to verify the correct args are passed through
    expect(afterCallbacks).toHaveLength(1);
    await afterCallbacks[0]();
    expect(mockRunPipeline).toHaveBeenCalledOnce();

    const [_supabase, input, config] = mockRunPipeline.mock.calls[0];

    expect(input.sessionId).toBe(VALID_UUID);
    expect(input.audioUrl).toBe("https://storage.example.com/signed");
    expect(input.language).toBe("en");
    expect(input.formTemplate).toMatchObject({
      name: "T-Res Field Note",
      extraction_mode: "multi",
      max_outputs: 5,
    });
    expect(input.preceptorEmail).toBe("preceptor@hospital.ca");
    expect(input.preceptorName).toBe("Dr. Smith");
    expect(input.residentName).toBe("Jane Resident");
    expect(input.residentEmail).toBe("resident@example.com");
    expect(input.rotationName).toBe("Internal Medicine");

    expect(config.deepgramApiKey).toBe("test-deepgram-key");
    expect(config.anthropicApiKey).toBe("test-anthropic-key");
    expect(typeof config.timeoutMs).toBe("number");
    expect(config.timeoutMs).toBeGreaterThan(0);
  });

  it("passes French language from recording to runPipeline (via after callback)", async () => {
    currentSupabaseClient = makeSupabaseClient({
      recording: { audio_path: "recordings/fr.webm", language: "fr" },
    });
    await POST(makeRequest({ sessionId: VALID_UUID }) as never);
    // Drain the callback
    await afterCallbacks[0]();
    const [, input] = mockRunPipeline.mock.calls[0];
    expect(input.language).toBe("fr");
  });

  // ── 5. Missing required env vars ──────────────────────────────────────────
  it("returns 500 when DEEPGRAM_API_KEY is missing", async () => {
    currentSupabaseClient = makeSupabaseClient({});
    delete process.env.DEEPGRAM_API_KEY;
    const res = await POST(makeRequest({ sessionId: VALID_UUID }) as never);
    expect(res.status).toBe(500);
    const bodyText = await res.text();
    // Must not leak the other key or any secret
    expect(bodyText).not.toContain("test-anthropic-key");
    const body = JSON.parse(bodyText);
    expect(body.error).toMatch(/server configuration/i);
  });

  it("returns 500 when ANTHROPIC_API_KEY is missing", async () => {
    currentSupabaseClient = makeSupabaseClient({});
    delete process.env.ANTHROPIC_API_KEY;
    const res = await POST(makeRequest({ sessionId: VALID_UUID }) as never);
    expect(res.status).toBe(500);
    const bodyText = await res.text();
    expect(bodyText).not.toContain("test-deepgram-key");
  });

  it("does not leak API key values when both keys are missing", async () => {
    currentSupabaseClient = makeSupabaseClient({});
    delete process.env.DEEPGRAM_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    const res = await POST(makeRequest({ sessionId: VALID_UUID }) as never);
    const bodyText = await res.text();
    expect(bodyText).not.toContain("test-deepgram-key");
    expect(bodyText).not.toContain("test-anthropic-key");
  });

  // ── 6. Duplicate trigger ──────────────────────────────────────────────────
  it("returns 409 when session status is already 'processing'", async () => {
    currentSupabaseClient = makeSupabaseClient({
      session: {
        id: VALID_UUID,
        user_id: USER_ID,
        form_template_id: "ft-0000-0000-0000-000000000000",
        preceptor_id: null,
        rotation_id: null,
        date: "2026-04-14",
        status: "processing",
      },
    });
    const res = await POST(makeRequest({ sessionId: VALID_UUID }) as never);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/already being processed/i);
  });

  it("does not call runPipeline on a 409 duplicate trigger", async () => {
    currentSupabaseClient = makeSupabaseClient({
      session: {
        id: VALID_UUID,
        user_id: USER_ID,
        form_template_id: "ft-0000",
        preceptor_id: null,
        rotation_id: null,
        date: "2026-04-14",
        status: "processing",
      },
    });
    await POST(makeRequest({ sessionId: VALID_UUID }) as never);
    expect(mockRunPipeline).not.toHaveBeenCalled();
  });

  // ── 7. Response shape on success ──────────────────────────────────────────
  it("returns JSON { success: true, status: 'processing' } with status 202 on success", async () => {
    currentSupabaseClient = makeSupabaseClient({});
    const res = await POST(makeRequest({ sessionId: VALID_UUID }) as never);
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body).toMatchObject({ success: true, status: "processing" });
  });

  it("returns application/json content-type on success", async () => {
    currentSupabaseClient = makeSupabaseClient({});
    const res = await POST(makeRequest({ sessionId: VALID_UUID }) as never);
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
  });

  // ── 8. Missing recording / audio path ────────────────────────────────────
  it("returns 404 when no recording exists for the session", async () => {
    currentSupabaseClient = makeSupabaseClient({ recording: null });
    const res = await POST(makeRequest({ sessionId: VALID_UUID }) as never);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/no recording/i);
  });

  it("returns 404 when recording has an empty audio_path", async () => {
    currentSupabaseClient = makeSupabaseClient({
      recording: { audio_path: "", language: "en" },
    });
    const res = await POST(makeRequest({ sessionId: VALID_UUID }) as never);
    expect(res.status).toBe(404);
  });

  // ── 9. Background-triggering: response returns BEFORE pipeline resolves ───
  // With after(), the route returns 202 immediately; runPipeline is only
  // invoked when the after() callback is drained (after the response).
  it("response is returned before runPipeline is called (fire-and-forget)", async () => {
    currentSupabaseClient = makeSupabaseClient({});
    let pipelineCalledAt = 0;

    mockRunPipeline.mockImplementation(async () => {
      pipelineCalledAt = Date.now();
      // Simulate slow pipeline work
      await new Promise((r) => setTimeout(r, 10));
    });

    const res = await POST(makeRequest({ sessionId: VALID_UUID }) as never);
    const responseReturnedAt = Date.now();

    // Response should be 202 and runPipeline NOT yet called
    expect(res.status).toBe(202);
    expect(pipelineCalledAt).toBe(0);
    expect(mockRunPipeline).not.toHaveBeenCalled();

    // after() should have captured the callback
    expect(after).toHaveBeenCalledOnce();
    expect(afterCallbacks).toHaveLength(1);

    // Draining the callback simulates Vercel executing it post-response
    await afterCallbacks[0]();

    // Pipeline ran AFTER the response was already returned
    expect(pipelineCalledAt).toBeGreaterThan(0);
    expect(pipelineCalledAt).toBeGreaterThanOrEqual(responseReturnedAt);
    expect(mockRunPipeline).toHaveBeenCalledOnce();
  });

  // ── 10. Forbidden: session belongs to another user ────────────────────────
  it("returns 403 when session belongs to a different user", async () => {
    currentSupabaseClient = makeSupabaseClient({
      session: {
        id: VALID_UUID,
        user_id: "other-user-000-0000-000000000000",
        form_template_id: "ft-0000",
        preceptor_id: null,
        rotation_id: null,
        date: "2026-04-14",
        status: "pending",
      },
    });
    const res = await POST(makeRequest({ sessionId: VALID_UUID }) as never);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/forbidden/i);
  });

  // ── 11. Optional preceptor / rotation absent ──────────────────────────────
  it("succeeds when session has no preceptor_id or rotation_id", async () => {
    currentSupabaseClient = makeSupabaseClient({
      session: {
        id: VALID_UUID,
        user_id: USER_ID,
        form_template_id: "ft-0000-0000-0000-000000000000",
        preceptor_id: null,
        rotation_id: null,
        date: "2026-04-14",
        status: "pending",
      },
    });
    const res = await POST(makeRequest({ sessionId: VALID_UUID }) as never);
    expect(res.status).toBe(202);
    // Drain after() callback to verify pipeline args
    await afterCallbacks[0]();
    const [, input] = mockRunPipeline.mock.calls[0];
    expect(input.preceptorEmail).toBeUndefined();
    expect(input.rotationName).toBeNull();
  });

  // ── 12. Form template not found ───────────────────────────────────────────
  it("returns 404 when form template query returns null", async () => {
    currentSupabaseClient = makeSupabaseClient({ formTemplate: null });
    const res = await POST(makeRequest({ sessionId: VALID_UUID }) as never);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/form template not found/i);
  });

  it("returns 404 when form template query errors", async () => {
    currentSupabaseClient = makeSupabaseClient({ formTemplateError: true });
    const res = await POST(makeRequest({ sessionId: VALID_UUID }) as never);
    expect(res.status).toBe(404);
  });

  // ── 13. Signed URL failure ────────────────────────────────────────────────
  it("returns 500 when signed URL creation fails", async () => {
    currentSupabaseClient = makeSupabaseClient({ signedUrlError: true });
    const res = await POST(makeRequest({ sessionId: VALID_UUID }) as never);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/failed to create audio url/i);
  });
});
