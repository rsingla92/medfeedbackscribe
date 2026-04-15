/**
 * Unit tests for the Debrief pipeline orchestrator (app/src/lib/pipeline/index.ts)
 *
 * Gemini-only pipeline. Provider-branching and STT_PROVIDER logic removed.
 *
 * Mock strategy:
 * - vi.mock() all external modules: gemini, email
 * - In-memory fake Supabase client that records calls and returns configurable data
 * - vi.stubEnv() to control RESEND_API_KEY / PROGRAM_ADMIN_EMAIL
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { runPipeline } from '@/lib/pipeline/index'

// Module mocks

vi.mock('@/lib/email', () => ({
  sendAssessmentNotification: vi.fn(),
}))

vi.mock('@/lib/pipeline/gemini', () => ({
  transcribeWithGemini: vi.fn(),
  scrubAndExtractWithGemini: vi.fn(),
  _resetVertexClient: vi.fn(),
}))

import { sendAssessmentNotification } from '@/lib/email'
import { transcribeWithGemini, scrubAndExtractWithGemini } from '@/lib/pipeline/gemini'

const mockSendAssessmentNotification = vi.mocked(sendAssessmentNotification)
const mockTranscribeWithGemini = vi.mocked(transcribeWithGemini)
const mockScrubAndExtractWithGemini = vi.mocked(scrubAndExtractWithGemini)

// In-memory Supabase fake

interface Call {
  table: string
  method: string
  args: unknown[]
}

function makeFakeSupabase(recordingData?: {
  transcript_clean?: string | null
  transcript_raw?: string | null
}) {
  const calls: Call[] = []

  function makeChain(table: string) {
    const chain = {
      update(data: unknown) {
        calls.push({ table, method: 'update', args: [data] })
        return chain
      },
      insert(data: unknown) {
        calls.push({ table, method: 'insert', args: [data] })
        return Promise.resolve({ error: null })
      },
      select(...cols: unknown[]) {
        calls.push({ table, method: 'select', args: cols })
        return chain
      },
      eq(col: unknown, val: unknown) {
        calls.push({ table, method: 'eq', args: [col, val] })
        return chain
      },
      single() {
        if (table === 'recordings') {
          return Promise.resolve({
            data: {
              transcript_clean: recordingData?.transcript_clean ?? null,
              transcript_raw: recordingData?.transcript_raw ?? 'raw transcript',
            },
            error: null,
          })
        }
        return Promise.resolve({ data: null, error: null })
      },
    }
    return chain
  }

  const supabase = {
    from(table: string) {
      return makeChain(table)
    },
    _calls: calls,
    _getCalls(table: string, method: string) {
      return calls.filter((c) => c.table === table && c.method === method)
    },
    _sessionUpdates() {
      return calls
        .filter((c) => c.table === 'sessions' && c.method === 'update')
        .map((c) => c.args[0])
    },
    _logInserts() {
      return calls
        .filter((c) => c.table === 'pipeline_logs' && c.method === 'insert')
        .map((c) => c.args[0])
    },
    _assessmentInserts() {
      return calls
        .filter((c) => c.table === 'assessments' && c.method === 'insert')
        .map((c) => c.args[0])
    },
  }

  return supabase
}

// Test fixtures

const baseInput = {
  sessionId: 'session-123',
  audioUrl: 'https://storage.example.com/audio.webm',
  language: 'en' as const,
  formTemplate: {
    name: 'T-Res Field Note',
    extraction_mode: 'multi' as const,
    max_outputs: 5,
    fields: { skill_dimension: { type: 'select', options: ['Medical Expert'] } },
    competency_framework: 'CanMEDS',
  },
  preceptorEmail: 'preceptor@hospital.ca',
  preceptorName: 'Dr. Smith',
  residentName: 'Dr. Jones',
  residentEmail: 'jones@hospital.ca',
  rotationName: 'Internal Medicine',
  sessionDate: '2026-04-14',
}

const baseConfig = {
  timeoutMs: 300_000,
  gcpProjectId: 'test-gcp-project',
}

const goodSTTResult = {
  transcript: 'The resident performed an excellent intubation.',
  confidence: 0.9,
  duration_seconds: 0,
  language: 'en',
}

const goodScrubExtractResult = {
  clean: 'The resident performed an excellent intubation.',
  totalRedactions: 0,
  extraction: {
    outputs: [
      {
        output_index: 1,
        structured_fields: { skill_dimension: 'Medical Expert', rating: 4 },
        competency_tags: ['Medical Expert'],
        narrative_summary: 'Resident performed an excellent intubation.',
        coaching_did_well: 'Smooth technique.',
        coaching_consider: 'Communicate steps aloud.',
        confidence: { skill_dimension: 0.9, rating: 0.85 },
      },
    ],
    model: 'gemini-2.5-flash-preview-04-17',
  },
}

describe('runPipeline', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.unstubAllEnvs()
    mockSendAssessmentNotification.mockResolvedValue(true)
    vi.stubEnv('RESEND_API_KEY', 'resend-test-key')
    vi.stubEnv('GCP_PROJECT_ID', 'test-project')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  describe('happy path', () => {
    it('sets session status to processing at the start', async () => {
      mockTranscribeWithGemini.mockResolvedValue(goodSTTResult)
      mockScrubAndExtractWithGemini.mockResolvedValue(goodScrubExtractResult)

      const supabase = makeFakeSupabase({ transcript_clean: goodScrubExtractResult.clean })
      await runPipeline(supabase as never, baseInput, baseConfig)

      const updates = supabase._sessionUpdates()
      expect(updates[0]).toMatchObject({ status: 'processing' })
    })

    it('calls transcribeWithGemini with correct arguments', async () => {
      mockTranscribeWithGemini.mockResolvedValue(goodSTTResult)
      mockScrubAndExtractWithGemini.mockResolvedValue(goodScrubExtractResult)

      const supabase = makeFakeSupabase({ transcript_clean: goodScrubExtractResult.clean })
      await runPipeline(supabase as never, baseInput, baseConfig)

      expect(mockTranscribeWithGemini).toHaveBeenCalledWith(
        baseInput.audioUrl,
        baseInput.language,
        baseConfig.gcpProjectId
      )
    })

    it('saves raw transcript to recordings after STT', async () => {
      mockTranscribeWithGemini.mockResolvedValue(goodSTTResult)
      mockScrubAndExtractWithGemini.mockResolvedValue(goodScrubExtractResult)

      const supabase = makeFakeSupabase({ transcript_clean: goodScrubExtractResult.clean })
      await runPipeline(supabase as never, baseInput, baseConfig)

      const recordingUpdates = supabase._getCalls('recordings', 'update')
      const rawUpdate = recordingUpdates.find(
        (c) => (c.args[0] as Record<string, unknown>).transcript_raw !== undefined
      )
      expect(rawUpdate).toBeDefined()
      expect(rawUpdate!.args[0]).toMatchObject({
        transcript_raw: goodSTTResult.transcript,
        duration_seconds: goodSTTResult.duration_seconds,
        stt_confidence: goodSTTResult.confidence,
        language: goodSTTResult.language,
      })
    })

    it('calls scrubAndExtractWithGemini with STT transcript', async () => {
      mockTranscribeWithGemini.mockResolvedValue(goodSTTResult)
      mockScrubAndExtractWithGemini.mockResolvedValue(goodScrubExtractResult)

      const supabase = makeFakeSupabase({ transcript_clean: goodScrubExtractResult.clean })
      await runPipeline(supabase as never, baseInput, baseConfig)

      expect(mockScrubAndExtractWithGemini).toHaveBeenCalledWith(
        goodSTTResult.transcript,
        baseInput.formTemplate,
        baseConfig.gcpProjectId
      )
    })

    it('saves clean transcript to recordings after PHI scrub', async () => {
      mockTranscribeWithGemini.mockResolvedValue(goodSTTResult)
      mockScrubAndExtractWithGemini.mockResolvedValue(goodScrubExtractResult)

      const supabase = makeFakeSupabase({ transcript_clean: goodScrubExtractResult.clean })
      await runPipeline(supabase as never, baseInput, baseConfig)

      const recordingUpdates = supabase._getCalls('recordings', 'update')
      const cleanUpdate = recordingUpdates.find(
        (c) => (c.args[0] as Record<string, unknown>).transcript_clean !== undefined
      )
      expect(cleanUpdate).toBeDefined()
      expect(cleanUpdate!.args[0]).toMatchObject({
        transcript_clean: goodScrubExtractResult.clean,
      })
    })

    it('inserts assessments with correct shape', async () => {
      mockTranscribeWithGemini.mockResolvedValue(goodSTTResult)
      mockScrubAndExtractWithGemini.mockResolvedValue(goodScrubExtractResult)

      const supabase = makeFakeSupabase({ transcript_clean: goodScrubExtractResult.clean })
      await runPipeline(supabase as never, baseInput, baseConfig)

      const inserts = supabase._assessmentInserts()
      expect(inserts).toHaveLength(1)
      const assessments = inserts[0] as Array<Record<string, unknown>>
      expect(Array.isArray(assessments)).toBe(true)
      expect(assessments[0]).toMatchObject({
        session_id: baseInput.sessionId,
        output_index: 1,
        structured_fields: goodScrubExtractResult.extraction.outputs[0].structured_fields,
        competency_tags: goodScrubExtractResult.extraction.outputs[0].competency_tags,
        narrative_summary: goodScrubExtractResult.extraction.outputs[0].narrative_summary,
        coaching_did_well: goodScrubExtractResult.extraction.outputs[0].coaching_did_well,
        coaching_consider: goodScrubExtractResult.extraction.outputs[0].coaching_consider,
        llm_confidence: goodScrubExtractResult.extraction.outputs[0].confidence,
      })
    })

    it('sets session status to ready at the end', async () => {
      mockTranscribeWithGemini.mockResolvedValue(goodSTTResult)
      mockScrubAndExtractWithGemini.mockResolvedValue(goodScrubExtractResult)

      const supabase = makeFakeSupabase({ transcript_clean: goodScrubExtractResult.clean })
      await runPipeline(supabase as never, baseInput, baseConfig)

      const updates = supabase._sessionUpdates()
      const lastUpdate = updates[updates.length - 1]
      expect(lastUpdate).toMatchObject({ status: 'ready' })
    })

    it('logs stt and phi_scrub and extract steps as completed', async () => {
      mockTranscribeWithGemini.mockResolvedValue(goodSTTResult)
      mockScrubAndExtractWithGemini.mockResolvedValue(goodScrubExtractResult)

      const supabase = makeFakeSupabase({ transcript_clean: goodScrubExtractResult.clean })
      await runPipeline(supabase as never, baseInput, baseConfig)

      const logs = supabase._logInserts()
      const steps = logs.map((l) => (l as Record<string, unknown>).step)
      expect(steps).toContain('stt')
      expect(steps).toContain('phi_scrub')
      expect(steps).toContain('extract')
      expect(steps).toContain('email')

      const sttLog = logs.find((l) => (l as Record<string, unknown>).step === 'stt')
      expect(sttLog).toMatchObject({ step: 'stt', status: 'completed' })
    })
  })

  describe('STT failure', () => {
    it('logs stt step as failed', async () => {
      mockTranscribeWithGemini.mockRejectedValue(new Error('STT_FETCH_ERROR: 500 Internal Server Error'))

      const supabase = makeFakeSupabase()
      await runPipeline(supabase as never, baseInput, baseConfig)

      const logs = supabase._logInserts()
      const sttLog = logs.find(
        (l) => (l as Record<string, unknown>).step === 'stt'
      )
      expect(sttLog).toBeDefined()
      expect(sttLog).toMatchObject({ step: 'stt', status: 'failed' })
    })

    it('sets session status to processing_failed', async () => {
      mockTranscribeWithGemini.mockRejectedValue(new Error('STT_EMPTY_TRANSCRIPT'))

      const supabase = makeFakeSupabase()
      await runPipeline(supabase as never, baseInput, baseConfig)

      const updates = supabase._sessionUpdates()
      const failedUpdate = updates.find(
        (u) => (u as Record<string, unknown>).status === 'processing_failed'
      )
      expect(failedUpdate).toBeDefined()
    })

    it('does not call scrubAndExtractWithGemini after STT failure', async () => {
      mockTranscribeWithGemini.mockRejectedValue(new Error('STT_ERROR'))

      const supabase = makeFakeSupabase()
      await runPipeline(supabase as never, baseInput, baseConfig)

      expect(mockScrubAndExtractWithGemini).not.toHaveBeenCalled()
    })
  })

  describe('PHI scrub / extract failure (FATAL — PHI may not reach storage unredacted)', () => {
    it('does NOT reach assessment insert when scrubAndExtract fails', async () => {
      mockTranscribeWithGemini.mockResolvedValue(goodSTTResult)
      mockScrubAndExtractWithGemini.mockRejectedValue(new Error('Gemini 503'))

      const supabase = makeFakeSupabase()
      await runPipeline(supabase as never, baseInput, baseConfig)

      expect(supabase._assessmentInserts()).toHaveLength(0)
    })

    it('sets session status to processing_failed when PHI scrub fails', async () => {
      mockTranscribeWithGemini.mockResolvedValue(goodSTTResult)
      mockScrubAndExtractWithGemini.mockRejectedValue(new Error('Gemini 503'))

      const supabase = makeFakeSupabase()
      await runPipeline(supabase as never, baseInput, baseConfig)

      const updates = supabase._sessionUpdates()
      const failedUpdate = updates.find(
        (u) => (u as Record<string, unknown>).status === 'processing_failed'
      )
      expect(failedUpdate).toBeDefined()
    })

    it('logs phi_scrub step as failed on non-extraction error', async () => {
      mockTranscribeWithGemini.mockResolvedValue(goodSTTResult)
      mockScrubAndExtractWithGemini.mockRejectedValue(new Error('Gemini quota'))

      const supabase = makeFakeSupabase()
      await runPipeline(supabase as never, baseInput, baseConfig)

      const logs = supabase._logInserts()
      const phiLog = logs.find(
        (l) => (l as Record<string, unknown>).step === 'phi_scrub'
      )
      expect(phiLog).toBeDefined()
      expect(phiLog).toMatchObject({ step: 'phi_scrub', status: 'failed' })
    })

    it('logs extract step as failed on EXTRACTION_ error', async () => {
      mockTranscribeWithGemini.mockResolvedValue(goodSTTResult)
      mockScrubAndExtractWithGemini.mockRejectedValue(new Error('EXTRACTION_PARSE_ERROR: no JSON'))

      const supabase = makeFakeSupabase()
      await runPipeline(supabase as never, baseInput, baseConfig)

      const logs = supabase._logInserts()
      const extractLog = logs.find(
        (l) => (l as Record<string, unknown>).step === 'extract'
      )
      expect(extractLog).toBeDefined()
      expect(extractLog).toMatchObject({ step: 'extract', status: 'failed' })
    })
  })

  describe('timeout guard after STT', () => {
    it('sets processing_failed and does not proceed to PHI/extract when time is low', async () => {
      mockTranscribeWithGemini.mockResolvedValue(goodSTTResult)

      const tightConfig = { ...baseConfig, timeoutMs: 0 }

      const supabase = makeFakeSupabase()
      await runPipeline(supabase as never, baseInput, tightConfig)

      const updates = supabase._sessionUpdates()
      const failedUpdate = updates.find(
        (u) => (u as Record<string, unknown>).status === 'processing_failed'
      )
      expect(failedUpdate).toBeDefined()
      expect(mockScrubAndExtractWithGemini).not.toHaveBeenCalled()
    })

    it('logs timeout_guard step as triggered', async () => {
      mockTranscribeWithGemini.mockResolvedValue(goodSTTResult)

      const tightConfig = { ...baseConfig, timeoutMs: 0 }
      const supabase = makeFakeSupabase()
      await runPipeline(supabase as never, baseInput, tightConfig)

      const logs = supabase._logInserts()
      const timeoutLog = logs.find(
        (l) => (l as Record<string, unknown>).step === 'timeout_guard'
      )
      expect(timeoutLog).toBeDefined()
      expect(timeoutLog).toMatchObject({ step: 'timeout_guard', status: 'triggered' })
    })
  })

  describe('assessment insert shape', () => {
    it('handles multiple outputs and coerces undefined coaching fields to null', async () => {
      const multiOutput = {
        clean: 'The resident did well.',
        totalRedactions: 0,
        extraction: {
          outputs: [
            {
              output_index: 1,
              structured_fields: { rating: 4 },
              competency_tags: ['Medical Expert'],
              narrative_summary: 'First encounter summary.',
              coaching_did_well: 'Good airway management.',
              coaching_consider: 'Document in chart.',
              confidence: { rating: 0.9 },
            },
            {
              output_index: 2,
              structured_fields: { rating: 3 },
              competency_tags: ['Communicator'],
              narrative_summary: 'Second encounter summary.',
              coaching_did_well: undefined,
              coaching_consider: undefined,
              confidence: { rating: 0.7 },
            },
          ],
          model: 'gemini-2.5-flash-preview-04-17',
        },
      }

      mockTranscribeWithGemini.mockResolvedValue(goodSTTResult)
      mockScrubAndExtractWithGemini.mockResolvedValue(multiOutput)

      const supabase = makeFakeSupabase()
      await runPipeline(supabase as never, baseInput, baseConfig)

      const inserts = supabase._assessmentInserts()
      expect(inserts).toHaveLength(1)
      const assessments = inserts[0] as Array<Record<string, unknown>>
      expect(assessments).toHaveLength(2)

      expect(assessments[0]).toMatchObject({
        session_id: baseInput.sessionId,
        output_index: 1,
        structured_fields: { rating: 4 },
        competency_tags: ['Medical Expert'],
        narrative_summary: 'First encounter summary.',
        coaching_did_well: 'Good airway management.',
        coaching_consider: 'Document in chart.',
        llm_confidence: { rating: 0.9 },
      })

      expect(assessments[1]).toMatchObject({
        session_id: baseInput.sessionId,
        output_index: 2,
        competency_tags: ['Communicator'],
        coaching_did_well: null,
        coaching_consider: null,
      })
    })
  })

  describe('email step', () => {
    it('skips email when RESEND_API_KEY is unset', async () => {
      vi.stubEnv('RESEND_API_KEY', '')
      delete process.env.RESEND_API_KEY

      mockTranscribeWithGemini.mockResolvedValue(goodSTTResult)
      mockScrubAndExtractWithGemini.mockResolvedValue(goodScrubExtractResult)

      const supabase = makeFakeSupabase()
      await runPipeline(supabase as never, baseInput, baseConfig)

      expect(mockSendAssessmentNotification).not.toHaveBeenCalled()

      const logs = supabase._logInserts()
      const emailLog = logs.find(
        (l) => (l as Record<string, unknown>).step === 'email'
      )
      expect(emailLog).toMatchObject({ step: 'email', status: 'skipped' })
    })

    it('skips email when narrative summary is empty', async () => {
      vi.stubEnv('RESEND_API_KEY', 'resend-key')
      mockTranscribeWithGemini.mockResolvedValue(goodSTTResult)
      mockScrubAndExtractWithGemini.mockResolvedValue({
        clean: 'text',
        totalRedactions: 0,
        extraction: {
          outputs: [
            {
              output_index: 1,
              structured_fields: {},
              competency_tags: [],
              narrative_summary: '',
              coaching_did_well: undefined,
              coaching_consider: undefined,
              confidence: {},
            },
          ],
          model: 'gemini-2.5-flash-preview-04-17',
        },
      })

      const supabase = makeFakeSupabase()
      await runPipeline(supabase as never, baseInput, baseConfig)

      expect(mockSendAssessmentNotification).not.toHaveBeenCalled()

      const logs = supabase._logInserts()
      const emailLog = logs.find(
        (l) => (l as Record<string, unknown>).step === 'email'
      )
      expect(emailLog).toMatchObject({ step: 'email', status: 'skipped' })
    })

    it('sends to preceptor and resident when both are set', async () => {
      vi.stubEnv('RESEND_API_KEY', 'resend-key')
      delete process.env.PROGRAM_ADMIN_EMAIL

      mockTranscribeWithGemini.mockResolvedValue(goodSTTResult)
      mockScrubAndExtractWithGemini.mockResolvedValue(goodScrubExtractResult)

      const supabase = makeFakeSupabase()
      await runPipeline(supabase as never, baseInput, baseConfig)

      expect(mockSendAssessmentNotification).toHaveBeenCalledTimes(2)

      const calls = mockSendAssessmentNotification.mock.calls
      const toAddresses = calls.map((c) => c[0].to)
      expect(toAddresses).toContain(baseInput.preceptorEmail)
      expect(toAddresses).toContain(baseInput.residentEmail)

      const preceptorCall = calls.find((c) => c[0].to === baseInput.preceptorEmail)
      expect(preceptorCall![0].role).toBe('preceptor')

      const residentCall = calls.find((c) => c[0].to === baseInput.residentEmail)
      expect(residentCall![0].role).toBe('resident')
    })

    it('also sends to admin when PROGRAM_ADMIN_EMAIL is set', async () => {
      vi.stubEnv('RESEND_API_KEY', 'resend-key')
      vi.stubEnv('PROGRAM_ADMIN_EMAIL', 'admin@hospital.ca')

      mockTranscribeWithGemini.mockResolvedValue(goodSTTResult)
      mockScrubAndExtractWithGemini.mockResolvedValue(goodScrubExtractResult)

      const supabase = makeFakeSupabase()
      await runPipeline(supabase as never, baseInput, baseConfig)

      expect(mockSendAssessmentNotification).toHaveBeenCalledTimes(3)

      const toAddresses = mockSendAssessmentNotification.mock.calls.map((c) => c[0].to)
      expect(toAddresses).toContain('admin@hospital.ca')
    })
  })

  describe('email failure (non-fatal)', () => {
    it('session still reaches ready when email throws', async () => {
      vi.stubEnv('RESEND_API_KEY', 'resend-key')
      mockTranscribeWithGemini.mockResolvedValue(goodSTTResult)
      mockScrubAndExtractWithGemini.mockResolvedValue(goodScrubExtractResult)
      mockSendAssessmentNotification.mockRejectedValue(new Error('Resend API 429'))

      const supabase = makeFakeSupabase()
      await runPipeline(supabase as never, baseInput, baseConfig)

      const updates = supabase._sessionUpdates()
      const readyUpdate = updates.find(
        (u) => (u as Record<string, unknown>).status === 'ready'
      )
      expect(readyUpdate).toBeDefined()
    })

    it('logs email step as failed when email throws', async () => {
      vi.stubEnv('RESEND_API_KEY', 'resend-key')
      mockTranscribeWithGemini.mockResolvedValue(goodSTTResult)
      mockScrubAndExtractWithGemini.mockResolvedValue(goodScrubExtractResult)
      mockSendAssessmentNotification.mockRejectedValue(new Error('Resend API 429'))

      const supabase = makeFakeSupabase()
      await runPipeline(supabase as never, baseInput, baseConfig)

      const logs = supabase._logInserts()
      const emailLog = logs.find(
        (l) => (l as Record<string, unknown>).step === 'email'
      )
      expect(emailLog).toBeDefined()
      expect(emailLog).toMatchObject({ step: 'email', status: 'failed' })
    })

    it('logs email step as failed when sendAssessmentNotification returns false', async () => {
      vi.stubEnv('RESEND_API_KEY', 'resend-key')
      delete process.env.PROGRAM_ADMIN_EMAIL
      mockTranscribeWithGemini.mockResolvedValue(goodSTTResult)
      mockScrubAndExtractWithGemini.mockResolvedValue(goodScrubExtractResult)
      mockSendAssessmentNotification.mockResolvedValue(false)

      const supabase = makeFakeSupabase()
      await runPipeline(supabase as never, baseInput, baseConfig)

      const logs = supabase._logInserts()
      const emailLog = logs.find(
        (l) => (l as Record<string, unknown>).step === 'email'
      )
      expect(emailLog).toMatchObject({ step: 'email', status: 'failed' })

      const updates = supabase._sessionUpdates()
      const readyUpdate = updates.find(
        (u) => (u as Record<string, unknown>).status === 'ready'
      )
      expect(readyUpdate).toBeDefined()
    })
  })
})
