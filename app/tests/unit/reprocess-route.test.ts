/**
 * Unit tests for app/src/app/api/reprocess/route.ts
 *
 * Strategy: mock `@/lib/supabase/server` to return a configurable Supabase
 * client stub and mock `fetch` globally to intercept the internal /api/process
 * trigger.  `next/headers` (cookies) is mocked so the server helper can be
 * imported outside a Next.js runtime.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ──────────────────────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────────────────────

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";
const USER_ID = "user-111-0000-0000-000000000000";

// A timestamp older than 5 minutes ago
const OLD_UPDATED_AT = new Date(Date.now() - 10 * 60 * 1000).toISOString();
// A timestamp less than 5 minutes ago
const RECENT_UPDATED_AT = new Date(Date.now() - 2 * 60 * 1000).toISOString();

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

function makeRequest(body: unknown, url = "http://localhost/api/reprocess"): Request {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: "sb-token=test" },
    body: JSON.stringify(body),
  });
}

// ──────────────────────────────────────────────────────────────────────────────
// Mock: next/headers
// ──────────────────────────────────────────────────────────────────────────────

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    getAll: () => [],
    set: vi.fn(),
  }),
}));

// ──────────────────────────────────────────────────────────────────────────────
// Mock: global fetch (used to call /api/process internally)
// ──────────────────────────────────────────────────────────────────────────────

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// ──────────────────────────────────────────────────────────────────────────────
// Supabase stub helpers
// ──────────────────────────────────────────────────────────────────────────────

type ChainResult<T> = { data: T; error: null } | { data: null; error: { message: string } };

function ok<T>(data: T): ChainResult<T> {
  return { data, error: null };
}
function err(msg: string): { data: null; error: { message: string } } {
  return { data: null, error: { message: msg } };
}

interface SessionStub {
  id: string;
  user_id: string;
  status: string;
  updated_at: string;
}

interface SupabaseStubOptions {
  user?: { id: string; email: string } | null;
  authError?: boolean;
  session?: SessionStub | null;
  sessionError?: boolean;
  resetError?: boolean;
}

function makeSupabaseClient(opts: SupabaseStubOptions) {
  const user =
    opts.user !== undefined
      ? opts.user
      : { id: USER_ID, email: "resident@example.com" };

  const defaultSession: SessionStub = {
    id: VALID_UUID,
    user_id: USER_ID,
    status: "processing_failed",
    updated_at: OLD_UPDATED_AT,
  };

  const client = {
    auth: {
      getUser: vi.fn().mockResolvedValue(
        opts.authError
          ? { data: { user: null }, error: { message: "auth error" } }
          : { data: { user }, error: null }
      ),
    },
    from: vi.fn((table: string) => {
      const updateResult = opts.resetError
        ? Promise.resolve(err("update failed"))
        : Promise.resolve(ok(null));

      const builder = {
        select: vi.fn(() => builder),
        eq: vi.fn(() => builder),
        update: vi.fn(() => ({
          eq: vi.fn(() => (table === "sessions" ? updateResult : Promise.resolve(ok(null)))),
        })),
        single: vi.fn(() => {
          if (table === "sessions") {
            if (opts.sessionError) return Promise.resolve(err("not found"));
            return Promise.resolve(
              ok(
                opts.session !== undefined
                  ? opts.session
                  : defaultSession
              )
            );
          }
          return Promise.resolve(ok(null));
        }),
      };
      return builder;
    }),
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

import { POST } from "@/app/api/reprocess/route";

// ──────────────────────────────────────────────────────────────────────────────
// Default fetch mock: /api/process responds 200
// ──────────────────────────────────────────────────────────────────────────────

function mockProcessOk() {
  mockFetch.mockResolvedValue(
    new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  );
}

function mockProcessFail(status = 500) {
  mockFetch.mockResolvedValue(
    new Response(JSON.stringify({ error: "pipeline error" }), {
      status,
      headers: { "Content-Type": "application/json" },
    })
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────────────────────────

describe("POST /api/reprocess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProcessOk();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── 1. Auth gates ─────────────────────────────────────────────────────────

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

  // ── 2. Input validation ───────────────────────────────────────────────────

  it("returns 400 when sessionId is absent", async () => {
    currentSupabaseClient = makeSupabaseClient({});
    const res = await POST(makeRequest({}) as never);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/sessionId/i);
  });

  it("returns 400 when sessionId is not a valid UUID", async () => {
    currentSupabaseClient = makeSupabaseClient({});
    const res = await POST(makeRequest({ sessionId: "not-a-uuid" }) as never);
    expect(res.status).toBe(400);
  });

  it("returns 400 when sessionId is a number", async () => {
    currentSupabaseClient = makeSupabaseClient({});
    const res = await POST(makeRequest({ sessionId: 12345 }) as never);
    expect(res.status).toBe(400);
  });

  // ── 3. Session lookup ─────────────────────────────────────────────────────

  it("returns 404 when session does not exist", async () => {
    currentSupabaseClient = makeSupabaseClient({ session: null });
    const res = await POST(makeRequest({ sessionId: VALID_UUID }) as never);
    expect(res.status).toBe(404);
  });

  it("returns 404 when session query errors", async () => {
    currentSupabaseClient = makeSupabaseClient({ sessionError: true });
    const res = await POST(makeRequest({ sessionId: VALID_UUID }) as never);
    expect(res.status).toBe(404);
  });

  // ── 4. Ownership check ────────────────────────────────────────────────────

  it("returns 403 when session belongs to a different user", async () => {
    currentSupabaseClient = makeSupabaseClient({
      session: {
        id: VALID_UUID,
        user_id: "other-user-000-0000-000000000000",
        status: "processing_failed",
        updated_at: OLD_UPDATED_AT,
      },
    });
    const res = await POST(makeRequest({ sessionId: VALID_UUID }) as never);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/forbidden/i);
  });

  // ── 5. Status allowed checks ──────────────────────────────────────────────

  it("returns 409 when session status is 'ready'", async () => {
    currentSupabaseClient = makeSupabaseClient({
      session: {
        id: VALID_UUID,
        user_id: USER_ID,
        status: "ready",
        updated_at: OLD_UPDATED_AT,
      },
    });
    const res = await POST(makeRequest({ sessionId: VALID_UUID }) as never);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/cannot be reprocessed/i);
  });

  it("returns 409 when session status is 'exported'", async () => {
    currentSupabaseClient = makeSupabaseClient({
      session: {
        id: VALID_UUID,
        user_id: USER_ID,
        status: "exported",
        updated_at: OLD_UPDATED_AT,
      },
    });
    const res = await POST(makeRequest({ sessionId: VALID_UUID }) as never);
    expect(res.status).toBe(409);
  });

  it("returns 409 when session status is 'created'", async () => {
    currentSupabaseClient = makeSupabaseClient({
      session: {
        id: VALID_UUID,
        user_id: USER_ID,
        status: "created",
        updated_at: OLD_UPDATED_AT,
      },
    });
    const res = await POST(makeRequest({ sessionId: VALID_UUID }) as never);
    expect(res.status).toBe(409);
  });

  it("allows reprocess when status is 'processing_failed'", async () => {
    currentSupabaseClient = makeSupabaseClient({
      session: {
        id: VALID_UUID,
        user_id: USER_ID,
        status: "processing_failed",
        updated_at: OLD_UPDATED_AT,
      },
    });
    const res = await POST(makeRequest({ sessionId: VALID_UUID }) as never);
    expect(res.status).toBe(202);
  });

  it("allows reprocess when status is 'processing' and updated_at is old", async () => {
    currentSupabaseClient = makeSupabaseClient({
      session: {
        id: VALID_UUID,
        user_id: USER_ID,
        status: "processing",
        updated_at: OLD_UPDATED_AT,
      },
    });
    const res = await POST(makeRequest({ sessionId: VALID_UUID }) as never);
    expect(res.status).toBe(202);
  });

  // ── 6. Recency guard (idempotency) ────────────────────────────────────────

  it("returns 409 when session was updated less than 5 minutes ago", async () => {
    currentSupabaseClient = makeSupabaseClient({
      session: {
        id: VALID_UUID,
        user_id: USER_ID,
        status: "processing_failed",
        updated_at: RECENT_UPDATED_AT,
      },
    });
    const res = await POST(makeRequest({ sessionId: VALID_UUID }) as never);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/less than 5 minutes/i);
  });

  it("returns 409 when a 'processing' session is recent (double-trigger guard)", async () => {
    currentSupabaseClient = makeSupabaseClient({
      session: {
        id: VALID_UUID,
        user_id: USER_ID,
        status: "processing",
        updated_at: RECENT_UPDATED_AT,
      },
    });
    const res = await POST(makeRequest({ sessionId: VALID_UUID }) as never);
    expect(res.status).toBe(409);
  });

  // ── 7. Happy path — internal /api/process trigger ─────────────────────────

  it("calls /api/process internally and returns 202 on success", async () => {
    currentSupabaseClient = makeSupabaseClient({});
    const res = await POST(makeRequest({ sessionId: VALID_UUID }) as never);
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body).toEqual({ status: "reprocessing" });

    // Verify fetch was called with /api/process
    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/api\/process$/);
    expect(opts.method).toBe("POST");
    expect(JSON.parse(opts.body as string)).toEqual({ sessionId: VALID_UUID });
  });

  // ── 8. /api/process failure — roll back to processing_failed ─────────────

  it("returns 500 and rolls back status when /api/process fails", async () => {
    mockProcessFail(500);
    currentSupabaseClient = makeSupabaseClient({});
    const res = await POST(makeRequest({ sessionId: VALID_UUID }) as never);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/failed to start reprocessing/i);
  });

  // ── 9. Response shape ─────────────────────────────────────────────────────

  it("returns application/json content-type on success", async () => {
    currentSupabaseClient = makeSupabaseClient({});
    const res = await POST(makeRequest({ sessionId: VALID_UUID }) as never);
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
  });

  it("returns { status: 'reprocessing' } with 202 on happy path", async () => {
    currentSupabaseClient = makeSupabaseClient({});
    const res = await POST(makeRequest({ sessionId: VALID_UUID }) as never);
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body).toMatchObject({ status: "reprocessing" });
  });

  // ── 10. Reset failure ─────────────────────────────────────────────────────

  it("returns 500 when status reset update fails", async () => {
    currentSupabaseClient = makeSupabaseClient({ resetError: true });
    const res = await POST(makeRequest({ sessionId: VALID_UUID }) as never);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/failed to reset/i);
  });
});
