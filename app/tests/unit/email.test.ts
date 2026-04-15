import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock resend before importing the module under test.
// The `function` keyword is required so vi.fn() can be used as a constructor with `new`.
vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(function () {
    return { emails: { send: vi.fn() } }
  }),
}))

import { sendEmail, sendAssessmentNotification, sendPreceptorSummary } from '@/lib/email'
import { Resend } from 'resend'

// Helper: sets up the next Resend instantiation to use a controlled send mock.
function mockSendOnce(result: unknown) {
  const mockSend = vi.fn().mockResolvedValue(result)
  vi.mocked(Resend).mockImplementationOnce(function () {
    return { emails: { send: mockSend } }
  } as unknown as new (key: string) => unknown)
  return mockSend
}

function okSend() {
  return mockSendOnce({ data: { id: 'x' }, error: null })
}

describe('sendEmail', () => {
  beforeEach(() => {
    vi.mocked(Resend).mockClear()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns false when RESEND_API_KEY is unset', async () => {
    vi.stubEnv('RESEND_API_KEY', '')
    const result = await sendEmail({ to: 'a@b.com', subject: 'Hi', html: '<p>Hi</p>' })
    expect(result).toBe(false)
  })

  it('returns true when Resend succeeds', async () => {
    vi.stubEnv('RESEND_API_KEY', 'test-key-123')
    okSend()
    const result = await sendEmail({ to: 'a@b.com', subject: 'Hi', html: '<p>Hi</p>' })
    expect(result).toBe(true)
  })

  it('returns false and logs console.error when Resend returns an error', async () => {
    vi.stubEnv('RESEND_API_KEY', 'test-key-123')
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockSendOnce({ data: null, error: { message: 'rate limited' } })
    const result = await sendEmail({ to: 'a@b.com', subject: 'Hi', html: '<p>Hi</p>' })
    expect(result).toBe(false)
    expect(consoleSpy).toHaveBeenCalled()
    consoleSpy.mockRestore()
  })

  it('uses RESEND_FROM_EMAIL when set', async () => {
    vi.stubEnv('RESEND_API_KEY', 'test-key-123')
    vi.stubEnv('RESEND_FROM_EMAIL', 'custom@example.com')
    const mockSend = okSend()
    await sendEmail({ to: 'a@b.com', subject: 'Hi', html: '<p>Hi</p>' })
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ from: 'custom@example.com' })
    )
  })

  it('uses the default from address when RESEND_FROM_EMAIL is not set', async () => {
    vi.stubEnv('RESEND_API_KEY', 'test-key-123')
    delete process.env.RESEND_FROM_EMAIL
    const mockSend = okSend()
    await sendEmail({ to: 'a@b.com', subject: 'Hi', html: '<p>Hi</p>' })
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ from: expect.stringContaining('noreply@') })
    )
  })
})

// ----- sendAssessmentNotification -----

const baseArgs = {
  to: 'dr@hospital.com',
  recipientName: 'Dr Smith',
  role: 'preceptor' as const,
  preceptorName: 'Dr Smith',
  residentName: 'Jane Doe',
  rotation: 'Emergency Medicine',
  date: '2026-04-14',
  narrativeSummary: 'Good performance.',
}

function captureHtmlAndSubject() {
  return okSend()
}

describe('sendAssessmentNotification — HTML escaping', () => {
  beforeEach(() => {
    vi.mocked(Resend).mockClear()
    vi.stubEnv('RESEND_API_KEY', 'test-key')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('escapes <script> tags and special chars in names/summary/coaching', async () => {
    const mockSend = captureHtmlAndSubject()
    await sendAssessmentNotification({
      ...baseArgs,
      recipientName: "Dr O'Brien <script>alert(1)</script>",
      preceptorName: 'Dr & "Evil"',
      residentName: 'Jane <b>Doe</b>',
      narrativeSummary: 'She said "good" & <great>',
      coachingDidWell: 'Brilliant <script>stealCookies()</script>',
      coachingConsider: 'Nothing & everything "matters"',
    })

    const html: string = mockSend.mock.calls[0][0].html
    expect(html).not.toMatch(/<script>/i)
    expect(html).not.toMatch(/<\/script>/i)
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('&amp;')
    expect(html).toContain('&quot;')
  })
})

describe('sendAssessmentNotification — subject line', () => {
  beforeEach(() => {
    vi.mocked(Resend).mockClear()
    vi.stubEnv('RESEND_API_KEY', 'test-key')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('includes rotation in subject when provided', async () => {
    const mockSend = captureHtmlAndSubject()
    await sendAssessmentNotification({ ...baseArgs, rotation: 'ICU' })
    const subject: string = mockSend.mock.calls[0][0].subject
    expect(subject).toContain('ICU')
    expect(subject).toContain('2026-04-14')
  })

  it('omits rotation suffix in subject when rotation is null', async () => {
    const mockSend = captureHtmlAndSubject()
    await sendAssessmentNotification({ ...baseArgs, rotation: null })
    const subject: string = mockSend.mock.calls[0][0].subject
    expect(subject).not.toMatch(/— .+\(/)
    expect(subject).toContain('2026-04-14')
  })
})

describe('sendAssessmentNotification — preceptor vs resident rendering', () => {
  beforeEach(() => {
    vi.mocked(Resend).mockClear()
    vi.stubEnv('RESEND_API_KEY', 'test-key')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('uses "Preceptor" label and "resident will review" footer for preceptor role', async () => {
    const mockSend = captureHtmlAndSubject()
    await sendAssessmentNotification({ ...baseArgs, role: 'preceptor' })
    const html: string = mockSend.mock.calls[0][0].html
    expect(html).toContain('Preceptor')
    expect(html).toContain('The resident will review')
    expect(html).not.toContain('Please review this assessment before submitting')
  })

  it('uses "Resident" label and "Please review" footer for resident role', async () => {
    const mockSend = captureHtmlAndSubject()
    await sendAssessmentNotification({
      ...baseArgs,
      role: 'resident',
      recipientName: 'Jane Doe',
    })
    const html: string = mockSend.mock.calls[0][0].html
    expect(html).toContain('Resident')
    expect(html).toContain('Please review this assessment before submitting')
    expect(html).not.toContain('The resident will review')
  })

  it('shows resident name as "other person" when role is preceptor', async () => {
    const mockSend = captureHtmlAndSubject()
    await sendAssessmentNotification({
      ...baseArgs,
      role: 'preceptor',
      preceptorName: 'Dr A',
      residentName: 'Dr B',
    })
    const html: string = mockSend.mock.calls[0][0].html
    expect(html).toContain('Dr B')
  })

  it('shows preceptor name as "other person" when role is resident', async () => {
    const mockSend = captureHtmlAndSubject()
    await sendAssessmentNotification({
      ...baseArgs,
      role: 'resident',
      preceptorName: 'Dr A',
      residentName: 'Dr B',
    })
    const html: string = mockSend.mock.calls[0][0].html
    expect(html).toContain('Dr A')
  })
})

describe('sendAssessmentNotification — coaching sections', () => {
  beforeEach(() => {
    vi.mocked(Resend).mockClear()
    vi.stubEnv('RESEND_API_KEY', 'test-key')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('renders no coaching section when both are null', async () => {
    const mockSend = captureHtmlAndSubject()
    await sendAssessmentNotification({
      ...baseArgs,
      coachingDidWell: null,
      coachingConsider: null,
    })
    const html: string = mockSend.mock.calls[0][0].html
    expect(html).not.toContain('What went well')
    expect(html).not.toContain('Consider next time')
  })

  it('renders only "What went well" when coachingConsider is null', async () => {
    const mockSend = captureHtmlAndSubject()
    await sendAssessmentNotification({
      ...baseArgs,
      coachingDidWell: 'Great job!',
      coachingConsider: null,
    })
    const html: string = mockSend.mock.calls[0][0].html
    expect(html).toContain('What went well')
    expect(html).toContain('Great job!')
    expect(html).not.toContain('Consider next time')
  })

  it('renders only "Consider next time" when coachingDidWell is null', async () => {
    const mockSend = captureHtmlAndSubject()
    await sendAssessmentNotification({
      ...baseArgs,
      coachingDidWell: null,
      coachingConsider: 'Try harder next time.',
    })
    const html: string = mockSend.mock.calls[0][0].html
    expect(html).not.toContain('What went well')
    expect(html).toContain('Consider next time')
    expect(html).toContain('Try harder next time.')
  })

  it('renders both sections when both are provided', async () => {
    const mockSend = captureHtmlAndSubject()
    await sendAssessmentNotification({
      ...baseArgs,
      coachingDidWell: 'Excellent!',
      coachingConsider: 'Work on X.',
    })
    const html: string = mockSend.mock.calls[0][0].html
    expect(html).toContain('What went well')
    expect(html).toContain('Excellent!')
    expect(html).toContain('Consider next time')
    expect(html).toContain('Work on X.')
  })
})

describe('sendPreceptorSummary', () => {
  beforeEach(() => {
    vi.mocked(Resend).mockClear()
    vi.stubEnv('RESEND_API_KEY', 'test-key')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('delegates to sendAssessmentNotification with role=preceptor and includes summary in HTML', async () => {
    const mockSend = okSend()
    const result = await sendPreceptorSummary('doc@hospital.com', 'Great work overall.')
    expect(result).toBe(true)
    expect(mockSend).toHaveBeenCalledTimes(1)
    const html: string = mockSend.mock.calls[0][0].html
    expect(html).toContain('Preceptor')
    expect(html).toContain('Great work overall.')
  })
})
