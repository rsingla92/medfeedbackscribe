import { describe, it, expect, vi, afterEach } from 'vitest'
import { transcribeAudio } from '@/lib/pipeline/stt'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDeepgramResponse(
  transcript: string,
  confidence = 0.95,
  duration = 42.7
) {
  return {
    metadata: { duration },
    results: {
      channels: [
        {
          alternatives: [{ transcript, confidence }],
        },
      ],
    },
  }
}

function mockFetchOk(body: object, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: 'OK',
    json: () => Promise.resolve(body),
  })
}

function mockFetchError(status: number, statusText: string) {
  return vi.fn().mockResolvedValue({
    ok: false,
    status,
    statusText,
    json: () => Promise.resolve({}),
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('transcribeAudio', () => {
  const API_KEY = 'test-api-key-abc'
  const AUDIO_URL = 'https://example.com/audio.webm'

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // 1. Success — correct return shape
  it('returns correct shape from a successful Deepgram response', async () => {
    vi.stubGlobal('fetch', mockFetchOk(makeDeepgramResponse('Patient did well.', 0.92, 65.3)))

    const result = await transcribeAudio(AUDIO_URL, 'en', API_KEY)

    expect(result).toEqual({
      transcript: 'Patient did well.',
      confidence: 0.92,
      duration_seconds: 65,
      language: 'en',
    })
  })

  // 2. Language routing — `en`
  it('sends language=en in the query string when language is "en"', async () => {
    const fetchMock = mockFetchOk(makeDeepgramResponse('Hello.'))
    vi.stubGlobal('fetch', fetchMock)

    await transcribeAudio(AUDIO_URL, 'en', API_KEY)

    const calledUrl: string = fetchMock.mock.calls[0][0]
    expect(new URL(calledUrl).searchParams.get('language')).toBe('en')
  })

  // 2. Language routing — `fr`
  it('sends language=fr in the query string when language is "fr"', async () => {
    const fetchMock = mockFetchOk(makeDeepgramResponse('Bonjour.'))
    vi.stubGlobal('fetch', fetchMock)

    await transcribeAudio(AUDIO_URL, 'fr', API_KEY)

    const calledUrl: string = fetchMock.mock.calls[0][0]
    expect(new URL(calledUrl).searchParams.get('language')).toBe('fr')
  })

  // 3a. Request targets correct host + path
  it('POSTs to api.deepgram.com/v1/listen with model=nova-2-medical', async () => {
    const fetchMock = mockFetchOk(makeDeepgramResponse('Test.'))
    vi.stubGlobal('fetch', fetchMock)

    await transcribeAudio(AUDIO_URL, 'en', API_KEY)

    const calledUrl: string = fetchMock.mock.calls[0][0]
    const parsedUrl = new URL(calledUrl)

    expect(parsedUrl.hostname).toBe('api.deepgram.com')
    expect(parsedUrl.pathname).toBe('/v1/listen')
    expect(parsedUrl.searchParams.get('model')).toBe('nova-2-medical')
  })

  // 3b. Correct headers — Authorization token
  it('sends Authorization header with the provided API key', async () => {
    const fetchMock = mockFetchOk(makeDeepgramResponse('Test.'))
    vi.stubGlobal('fetch', fetchMock)

    await transcribeAudio(AUDIO_URL, 'en', API_KEY)

    const init = fetchMock.mock.calls[0][1]
    expect(init.headers['Authorization']).toBe(`Token ${API_KEY}`)
  })

  // 3c. JSON body contains `{ url }`
  it('sends a JSON body with the audio URL', async () => {
    const fetchMock = mockFetchOk(makeDeepgramResponse('Test.'))
    vi.stubGlobal('fetch', fetchMock)

    await transcribeAudio(AUDIO_URL, 'en', API_KEY)

    const init = fetchMock.mock.calls[0][1]
    expect(JSON.parse(init.body)).toEqual({ url: AUDIO_URL })
  })

  // 4. HTTP 429 → STT_RATE_LIMIT
  it('throws STT_RATE_LIMIT on HTTP 429', async () => {
    vi.stubGlobal('fetch', mockFetchError(429, 'Too Many Requests'))

    await expect(transcribeAudio(AUDIO_URL, 'en', API_KEY)).rejects.toThrow('STT_RATE_LIMIT')
  })

  // 5. Other non-2xx (500) → STT_ERROR: 500 …
  it('throws STT_ERROR with status code on HTTP 500', async () => {
    vi.stubGlobal('fetch', mockFetchError(500, 'Internal Server Error'))

    await expect(transcribeAudio(AUDIO_URL, 'en', API_KEY)).rejects.toThrow(
      'STT_ERROR: 500 Internal Server Error'
    )
  })

  // 6. Empty transcript → STT_EMPTY_TRANSCRIPT
  it('throws STT_EMPTY_TRANSCRIPT when transcript is empty string', async () => {
    vi.stubGlobal('fetch', mockFetchOk(makeDeepgramResponse('')))

    await expect(transcribeAudio(AUDIO_URL, 'en', API_KEY)).rejects.toThrow('STT_EMPTY_TRANSCRIPT')
  })

  // 6. Whitespace-only transcript → STT_EMPTY_TRANSCRIPT
  it('throws STT_EMPTY_TRANSCRIPT when transcript is only whitespace', async () => {
    vi.stubGlobal('fetch', mockFetchOk(makeDeepgramResponse('   \t\n')))

    await expect(transcribeAudio(AUDIO_URL, 'en', API_KEY)).rejects.toThrow('STT_EMPTY_TRANSCRIPT')
  })

  // 7. Missing metadata.duration → defaults to 0
  it('defaults duration_seconds to 0 when metadata.duration is absent', async () => {
    const body = {
      metadata: {},
      results: {
        channels: [{ alternatives: [{ transcript: 'Hello.', confidence: 0.9 }] }],
      },
    }
    vi.stubGlobal('fetch', mockFetchOk(body))

    const result = await transcribeAudio(AUDIO_URL, 'en', API_KEY)
    expect(result.duration_seconds).toBe(0)
  })

  // 8. Missing confidence → defaults to 0
  it('defaults confidence to 0 when alternatives[0].confidence is absent', async () => {
    const body = {
      metadata: { duration: 10 },
      results: {
        channels: [{ alternatives: [{ transcript: 'Hello.' }] }],
      },
    }
    vi.stubGlobal('fetch', mockFetchOk(body))

    const result = await transcribeAudio(AUDIO_URL, 'en', API_KEY)
    expect(result.confidence).toBe(0)
  })

  // 9. Default language param when not passed → `en`
  it('defaults to language "en" when no language argument is provided', async () => {
    const fetchMock = mockFetchOk(makeDeepgramResponse('Default language test.'))
    vi.stubGlobal('fetch', fetchMock)

    // Omit language to exercise the default parameter value
    const result = await (transcribeAudio as (url: string, lang: undefined, key: string) => Promise<unknown>)(
      AUDIO_URL,
      undefined,
      API_KEY
    ) as { language: string }

    const calledUrl: string = fetchMock.mock.calls[0][0]
    expect(new URL(calledUrl).searchParams.get('language')).toBe('en')
    expect(result.language).toBe('en')
  })
})
