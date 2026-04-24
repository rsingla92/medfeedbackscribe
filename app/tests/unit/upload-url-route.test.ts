/**
 * Unit tests for app/src/app/api/upload-url/route.ts
 *
 * Strategy: mock `@/lib/auth` for auth, `@/lib/db/queries` for ownership
 * lookup, and `@/lib/storage/s3` so no real AWS SDK calls happen.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";
const USER_ID = "11111111-1111-1111-1111-111111111111";

function makeRequest(
  body: unknown,
  url = "http://localhost/api/upload-url",
): Request {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const mockGetPresignedUploadUrl = vi.fn();
const mockAuth = vi.fn();
const mockGetRecordingSession = vi.fn();

vi.mock("@/lib/storage/s3", () => ({
  getPresignedUploadUrl: (...args: unknown[]) =>
    mockGetPresignedUploadUrl(...args),
}));

vi.mock("@/lib/auth", () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
}));

vi.mock("@/lib/db/queries", () => ({
  getRecordingSession: (...args: unknown[]) => mockGetRecordingSession(...args),
}));

import { POST } from "@/app/api/upload-url/route";

describe("POST /api/upload-url", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({
      user: { id: USER_ID, email: "resident@example.com" },
    });
    mockGetRecordingSession.mockResolvedValue({
      id: VALID_UUID,
      user_id: USER_ID,
    });
    mockGetPresignedUploadUrl.mockResolvedValue({
      url: "https://s3.example.com/signed-put-url",
      key: `${USER_ID}/${VALID_UUID}.webm`,
    });
  });

  it("returns 401 when no session", async () => {
    mockAuth.mockResolvedValueOnce(null);
    const res = await POST(
      makeRequest({
        sessionId: VALID_UUID,
        contentType: "audio/webm",
      }) as never,
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 when sessionId is missing", async () => {
    const res = await POST(
      makeRequest({ contentType: "audio/webm" }) as never,
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when sessionId is not a UUID", async () => {
    const res = await POST(
      makeRequest({
        sessionId: "not-a-uuid",
        contentType: "audio/webm",
      }) as never,
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when contentType is not allowed", async () => {
    const res = await POST(
      makeRequest({
        sessionId: VALID_UUID,
        contentType: "application/pdf",
      }) as never,
    );
    expect(res.status).toBe(400);
  });

  it("accepts audio/webm and audio/mp4", async () => {
    const r1 = await POST(
      makeRequest({
        sessionId: VALID_UUID,
        contentType: "audio/webm",
      }) as never,
    );
    expect(r1.status).toBe(200);
    const r2 = await POST(
      makeRequest({
        sessionId: VALID_UUID,
        contentType: "audio/mp4",
      }) as never,
    );
    expect(r2.status).toBe(200);
  });

  it("returns 404 when session does not exist or isn't owned", async () => {
    mockGetRecordingSession.mockResolvedValueOnce(null);
    const res = await POST(
      makeRequest({
        sessionId: VALID_UUID,
        contentType: "audio/webm",
      }) as never,
    );
    expect(res.status).toBe(404);
  });

  it("returns { url, key } on success", async () => {
    const res = await POST(
      makeRequest({
        sessionId: VALID_UUID,
        contentType: "audio/webm",
      }) as never,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      url: "https://s3.example.com/signed-put-url",
      key: `${USER_ID}/${VALID_UUID}.webm`,
    });
  });

  it("passes userId/sessionId/contentType through to the presigner", async () => {
    await POST(
      makeRequest({
        sessionId: VALID_UUID,
        contentType: "audio/webm",
      }) as never,
    );
    expect(mockGetPresignedUploadUrl).toHaveBeenCalledWith({
      userId: USER_ID,
      sessionId: VALID_UUID,
      contentType: "audio/webm",
    });
  });

  it("returns 500 with generic error on presigner failure", async () => {
    mockGetPresignedUploadUrl.mockRejectedValueOnce(
      new Error("S3_RECORDINGS_BUCKET env var is not set"),
    );
    const res = await POST(
      makeRequest({
        sessionId: VALID_UUID,
        contentType: "audio/webm",
      }) as never,
    );
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Failed to create upload URL");
  });
});
