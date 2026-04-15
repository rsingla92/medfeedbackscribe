/**
 * Unit tests for export route handlers
 *
 * Routes under test:
 *   POST /api/export/[id]       → PDF
 *   POST /api/export/csv/[id]   → CSV
 *
 * All Supabase and @react-pdf/renderer calls are mocked so no DB or
 * external services are required.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ────────────────────────────────────────────────────────────────────────────
// Shared constants
// ────────────────────────────────────────────────────────────────────────────

const VALID_UUID = '11111111-2222-3333-4444-555555555555'
const OTHER_USER_UUID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
const OWNER_USER_ID = 'user-owner-uuid'
const FORM_TEMPLATE_ID = 'form-template-uuid'

/** Minimal assessment row returned from the assessments table */
const MOCK_ASSESSMENT = {
  id: 'assessment-uuid',
  output_index: 1,
  structured_fields: { overall_performance: 'Meets expectations' },
  competency_tags: ['Communicator'],
  narrative_summary: 'Good job',
  coaching_did_well: 'Listened well',
  coaching_consider: 'Be more concise',
}

/** Minimal session row */
const MOCK_SESSION = {
  id: VALID_UUID,
  user_id: OWNER_USER_ID,
  date: '2024-01-15',
  form_template_id: FORM_TEMPLATE_ID,
  preceptor_id: null,
  created_at: '2024-01-15T10:00:00Z',
  preceptor: { name: 'Dr Smith', email: 'drsmith@example.com' },
  rotation: { name: 'Internal Medicine' },
}

/** Minimal form template row */
const MOCK_FORM_TEMPLATE = {
  name: 'Daily Evaluation Form',
  fields: { overall_performance: { label: 'Overall Performance' } },
}

// ────────────────────────────────────────────────────────────────────────────
// Supabase mock factory
// ────────────────────────────────────────────────────────────────────────────

type SupabaseMockOverrides = {
  user?: { id: string; email: string } | null
  authError?: Error | null
  session?: typeof MOCK_SESSION | null
  sessionError?: { message: string } | null
  assessments?: typeof MOCK_ASSESSMENT[] | null
  assessmentsError?: { message: string } | null
  formTemplate?: typeof MOCK_FORM_TEMPLATE | null
  templateError?: { message: string } | null
  profile?: { full_name: string } | null
  assessmentUpdateError?: { message: string } | null
  sessionUpdateError?: { message: string } | null
}

function makeSupabaseMock(overrides: SupabaseMockOverrides = {}) {
  const {
    user = { id: OWNER_USER_ID, email: 'resident@example.com' },
    authError = null,
    session = MOCK_SESSION,
    sessionError = null,
    assessments = [MOCK_ASSESSMENT],
    assessmentsError = null,
    formTemplate = MOCK_FORM_TEMPLATE,
    templateError = null,
    profile = { full_name: 'Dr Resident' },
    assessmentUpdateError = null,
    sessionUpdateError = null,
  } = overrides

  // Chainable query builder helper for single-row results
  function makeQueryChain(data: unknown, error: unknown) {
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data, error }),
      order: vi.fn().mockResolvedValue({ data, error }),
      update: vi.fn().mockReturnThis(),
    }
  }

  const fromImpl = vi.fn((table: string) => {
    switch (table) {
      case 'sessions':
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: session, error: sessionError }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: sessionUpdateError }),
          }),
        }
      case 'assessments':
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({
            data: assessments,
            error: assessmentsError,
          }),
          update: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ error: assessmentUpdateError }),
          }),
        }
      case 'form_templates':
        return makeQueryChain(formTemplate, templateError)
      case 'profiles':
        return makeQueryChain(profile, null)
      default:
        return makeQueryChain(null, null)
    }
  })

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user },
        error: authError,
      }),
    },
    from: fromImpl,
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Module-level mocks (hoisted before imports via vi.mock hoisting)
// ────────────────────────────────────────────────────────────────────────────

// Supabase server client – overridden per test via supabaseMockRef
const supabaseMockRef = { current: makeSupabaseMock() }

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve(supabaseMockRef.current)),
}))

// next/headers – cookies() is not available in jsdom
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({ getAll: () => [], set: () => {} }),
}))

// @react-pdf/renderer – avoid heavy canvas/font dependencies in jsdom
vi.mock('@react-pdf/renderer', () => {
  const fakePdfBytes = new Uint8Array([37, 80, 68, 70, 45]) // "%PDF-" header bytes
  return {
    default: {
      renderToBuffer: vi.fn().mockResolvedValue(Buffer.from(fakePdfBytes)),
    },
    Document: vi.fn(({ children }: { children: unknown }) => children),
    Page: vi.fn(({ children }: { children: unknown }) => children),
    Text: vi.fn(() => null),
    View: vi.fn(({ children }: { children: unknown }) => children),
    StyleSheet: {
      create: (styles: Record<string, unknown>) => styles,
    },
  }
})

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function makeRequest(url = 'http://localhost/api/export'): NextRequest {
  return new NextRequest(url, { method: 'POST' })
}

function makeParams(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) }
}

// ────────────────────────────────────────────────────────────────────────────
// PDF route tests
// ────────────────────────────────────────────────────────────────────────────

describe('POST /api/export/[id] (PDF)', () => {
  let POST: (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => Promise<Response>

  beforeEach(async () => {
    vi.resetModules()
    vi.mock('@/lib/supabase/server', () => ({
      createClient: vi.fn(() => Promise.resolve(supabaseMockRef.current)),
    }))
    vi.mock('next/headers', () => ({
      cookies: vi.fn().mockResolvedValue({ getAll: () => [], set: () => {} }),
    }))
    vi.mock('@react-pdf/renderer', () => {
      const fakePdfBytes = new Uint8Array([37, 80, 68, 70, 45])
      return {
        default: {
          renderToBuffer: vi.fn().mockResolvedValue(Buffer.from(fakePdfBytes)),
        },
        Document: vi.fn(({ children }: { children: unknown }) => children),
        Page: vi.fn(({ children }: { children: unknown }) => children),
        Text: vi.fn(() => null),
        View: vi.fn(({ children }: { children: unknown }) => children),
        StyleSheet: { create: (s: Record<string, unknown>) => s },
      }
    })
    const mod = await import('@/app/api/export/[id]/route')
    POST = mod.POST
    supabaseMockRef.current = makeSupabaseMock()
  })

  // 1. Unauthenticated
  it('returns 401 when user is not authenticated', async () => {
    supabaseMockRef.current = makeSupabaseMock({ user: null })
    const res = await POST(makeRequest(), makeParams(VALID_UUID))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toMatch(/unauthorized/i)
  })

  // 2. Non-owner (session belongs to different user_id)
  it('returns 403 when session belongs to another user', async () => {
    supabaseMockRef.current = makeSupabaseMock({
      user: { id: OTHER_USER_UUID, email: 'other@example.com' },
      session: { ...MOCK_SESSION, user_id: OWNER_USER_ID },
    })
    const res = await POST(makeRequest(), makeParams(VALID_UUID))
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toMatch(/forbidden/i)
  })

  // 3. Invalid UUID
  it('returns 400 for an invalid UUID string', async () => {
    const res = await POST(makeRequest(), makeParams('not-a-uuid'))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/invalid session id/i)
  })

  it('returns 400 for an empty-string UUID', async () => {
    const res = await POST(makeRequest(), makeParams(''))
    expect(res.status).toBe(400)
  })

  // 4. Successful export
  it('returns 200 with application/pdf Content-Type and attachment Content-Disposition', async () => {
    const res = await POST(makeRequest(), makeParams(VALID_UUID))
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('application/pdf')
    const disposition = res.headers.get('Content-Disposition')
    expect(disposition).toBeTruthy()
    expect(disposition).toMatch(/^attachment; filename="/)
    expect(disposition).toMatch(/\.pdf"$/)
  })

  // 5. safeName fallback
  it('safeName falls back to "export" when form template name is empty', async () => {
    supabaseMockRef.current = makeSupabaseMock({
      formTemplate: { ...MOCK_FORM_TEMPLATE, name: '' },
    })
    const res = await POST(makeRequest(), makeParams(VALID_UUID))
    expect(res.status).toBe(200)
    const disposition = res.headers.get('Content-Disposition') ?? ''
    expect(disposition).toContain('"export-')
  })

  it('safeName falls back to "export" when name is only special characters', async () => {
    supabaseMockRef.current = makeSupabaseMock({
      formTemplate: { ...MOCK_FORM_TEMPLATE, name: '!!!@@@###' },
    })
    const res = await POST(makeRequest(), makeParams(VALID_UUID))
    expect(res.status).toBe(200)
    const disposition = res.headers.get('Content-Disposition') ?? ''
    expect(disposition).toContain('"export-')
  })

  // 6. Filename length limit
  it('truncates long form names to 50 chars max in the filename', async () => {
    const longName = 'A'.repeat(100)
    supabaseMockRef.current = makeSupabaseMock({
      formTemplate: { ...MOCK_FORM_TEMPLATE, name: longName },
    })
    const res = await POST(makeRequest(), makeParams(VALID_UUID))
    expect(res.status).toBe(200)
    const disposition = res.headers.get('Content-Disposition') ?? ''
    const match = disposition.match(/filename="([^"]+)"/)
    expect(match).toBeTruthy()
    const filename = match![1]
    const namePart = filename.split('-')[0]
    expect(namePart.length).toBeLessThanOrEqual(50)
  })

  // 8. Returns non-zero bytes
  it('returns a non-zero byte stream in the response body', async () => {
    const res = await POST(makeRequest(), makeParams(VALID_UUID))
    expect(res.status).toBe(200)
    const buffer = await res.arrayBuffer()
    expect(buffer.byteLength).toBeGreaterThan(0)
  })

  // 9. Database errors
  it('returns 404 when session DB query returns an error', async () => {
    supabaseMockRef.current = makeSupabaseMock({
      session: null,
      sessionError: { message: 'relation "sessions" does not exist' },
    })
    const res = await POST(makeRequest(), makeParams(VALID_UUID))
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBeDefined()
  })

  it('returns 404 when no assessments exist for the session', async () => {
    supabaseMockRef.current = makeSupabaseMock({ assessments: [] })
    const res = await POST(makeRequest(), makeParams(VALID_UUID))
    expect(res.status).toBe(404)
  })

  it('returns 500 when assessment exported_at update fails', async () => {
    supabaseMockRef.current = makeSupabaseMock({
      assessmentUpdateError: { message: 'Constraint violation' },
    })
    const res = await POST(makeRequest(), makeParams(VALID_UUID))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBeDefined()
  })

  it('returns 500 when session status update fails', async () => {
    supabaseMockRef.current = makeSupabaseMock({
      sessionUpdateError: { message: 'Session update failed' },
    })
    const res = await POST(makeRequest(), makeParams(VALID_UUID))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBeDefined()
  })
})

// ────────────────────────────────────────────────────────────────────────────
// CSV route tests
// ────────────────────────────────────────────────────────────────────────────

describe('POST /api/export/csv/[id] (CSV)', () => {
  let POST: (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => Promise<Response>

  const CANMEDS_ROLES = [
    'Family Medicine Expert',
    'Communicator',
    'Collaborator',
    'Manager',
    'Health Advocate',
    'Scholar',
    'Professional',
  ] as const

  const EXPECTED_HEADERS = [
    'Resident Name',
    'Preceptor Name',
    'Rotation',
    'Date',
    'Overall Performance',
    ...CANMEDS_ROLES.map((role) => `${role} - Rating`),
    ...CANMEDS_ROLES.map((role) => `${role} - Comments`),
    'Narrative Summary',
    'Coaching: Did Well',
    'Coaching: Consider Next Time',
  ]

  beforeEach(async () => {
    vi.resetModules()
    vi.mock('@/lib/supabase/server', () => ({
      createClient: vi.fn(() => Promise.resolve(supabaseMockRef.current)),
    }))
    vi.mock('next/headers', () => ({
      cookies: vi.fn().mockResolvedValue({ getAll: () => [], set: () => {} }),
    }))
    const mod = await import('@/app/api/export/csv/[id]/route')
    POST = mod.POST
    supabaseMockRef.current = makeSupabaseMock()
  })

  // 1. Unauthenticated
  it('returns 401 when user is not authenticated', async () => {
    supabaseMockRef.current = makeSupabaseMock({ user: null })
    const res = await POST(makeRequest(), makeParams(VALID_UUID))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toMatch(/unauthorized/i)
  })

  // 2. Non-owner
  it('returns 403 when session belongs to another user', async () => {
    supabaseMockRef.current = makeSupabaseMock({
      user: { id: OTHER_USER_UUID, email: 'other@example.com' },
      session: { ...MOCK_SESSION, user_id: OWNER_USER_ID },
    })
    const res = await POST(makeRequest(), makeParams(VALID_UUID))
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toMatch(/forbidden/i)
  })

  // 3. Invalid UUID
  it('returns 400 for an invalid UUID string', async () => {
    const res = await POST(makeRequest(), makeParams('not-a-uuid'))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/invalid session id/i)
  })

  it('returns 400 for an empty-string UUID', async () => {
    const res = await POST(makeRequest(), makeParams(''))
    expect(res.status).toBe(400)
  })

  // 4. Successful export
  it('returns 200 with text/csv Content-Type and attachment Content-Disposition', async () => {
    const res = await POST(makeRequest(), makeParams(VALID_UUID))
    expect(res.status).toBe(200)
    const contentType = res.headers.get('Content-Type') ?? ''
    expect(contentType).toMatch(/text\/csv/)
    const disposition = res.headers.get('Content-Disposition')
    expect(disposition).toBeTruthy()
    expect(disposition).toMatch(/^attachment; filename="/)
    expect(disposition).toMatch(/\.csv"$/)
  })

  // 5. safeName fallback
  it('safeName falls back to "export" when form template name is empty', async () => {
    supabaseMockRef.current = makeSupabaseMock({
      formTemplate: { ...MOCK_FORM_TEMPLATE, name: '' },
    })
    const res = await POST(makeRequest(), makeParams(VALID_UUID))
    expect(res.status).toBe(200)
    const disposition = res.headers.get('Content-Disposition') ?? ''
    expect(disposition).toContain('"export-')
  })

  it('safeName falls back to "export" when name is only special characters', async () => {
    supabaseMockRef.current = makeSupabaseMock({
      formTemplate: { ...MOCK_FORM_TEMPLATE, name: '!!!###$$$' },
    })
    const res = await POST(makeRequest(), makeParams(VALID_UUID))
    expect(res.status).toBe(200)
    const disposition = res.headers.get('Content-Disposition') ?? ''
    expect(disposition).toContain('"export-')
  })

  // 6. Filename length limit
  it('truncates long form names to 50 chars max in the filename', async () => {
    const longName = 'B'.repeat(100)
    supabaseMockRef.current = makeSupabaseMock({
      formTemplate: { ...MOCK_FORM_TEMPLATE, name: longName },
    })
    const res = await POST(makeRequest(), makeParams(VALID_UUID))
    expect(res.status).toBe(200)
    const disposition = res.headers.get('Content-Disposition') ?? ''
    const match = disposition.match(/filename="([^"]+)"/)
    expect(match).toBeTruthy()
    const filename = match![1]
    const namePart = filename.split('-')[0]
    expect(namePart.length).toBeLessThanOrEqual(50)
  })

  // 7. Column order is deterministic
  it('CSV header row is deterministic and matches the expected column order', async () => {
    const res = await POST(makeRequest(), makeParams(VALID_UUID))
    expect(res.status).toBe(200)
    const text = await res.text()
    const firstLine = text.split('\n')[0]
    // Parse headers — values may be quoted if they contain commas
    const parsedHeaders = firstLine.split(',').map((h) =>
      h.replace(/^"(.*)"$/, '$1').replace(/""/g, '"'
    ))
    expect(parsedHeaders).toEqual(EXPECTED_HEADERS)
  })

  it('CSV data row has the same column count as the header row', async () => {
    const res = await POST(makeRequest(), makeParams(VALID_UUID))
    expect(res.status).toBe(200)
    const text = await res.text()
    const lines = text.split('\n')
    expect(lines.length).toBeGreaterThanOrEqual(2)
    expect(lines[0].split(',').length).toBe(lines[1].split(',').length)
  })

  // 9. Database error paths
  it('returns 404 when session DB query returns an error', async () => {
    supabaseMockRef.current = makeSupabaseMock({
      session: null,
      sessionError: { message: 'relation "sessions" does not exist' },
    })
    const res = await POST(makeRequest(), makeParams(VALID_UUID))
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBeDefined()
  })

  it('returns 404 when no assessments exist for the session', async () => {
    supabaseMockRef.current = makeSupabaseMock({ assessments: [] })
    const res = await POST(makeRequest(), makeParams(VALID_UUID))
    expect(res.status).toBe(404)
  })

  it('returns 500 when assessment exported_at update fails', async () => {
    supabaseMockRef.current = makeSupabaseMock({
      assessmentUpdateError: { message: 'Constraint violation' },
    })
    const res = await POST(makeRequest(), makeParams(VALID_UUID))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBeDefined()
  })

  it('returns 500 when session status update fails', async () => {
    supabaseMockRef.current = makeSupabaseMock({
      sessionUpdateError: { message: 'Session status update failed' },
    })
    const res = await POST(makeRequest(), makeParams(VALID_UUID))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBeDefined()
  })
})
