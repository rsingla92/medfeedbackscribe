/**
 * Speech-to-Text via Deepgram API
 *
 *   audio file ──▶ Deepgram ──▶ { transcript, confidence, duration }
 */

export interface STTResult {
  transcript: string;
  confidence: number;
  duration_seconds: number;
  language: string;
}

export async function transcribeAudio(
  audioUrl: string,
  language: "en" | "fr" = "en",
  apiKey: string
): Promise<STTResult> {
  const response = await fetch(
    "https://api.deepgram.com/v1/listen?" +
      new URLSearchParams({
        model: "nova-2-medical",
        language,
        smart_format: "true",
        punctuate: "true",
        diarize: "false",
      }),
    {
      method: "POST",
      headers: {
        Authorization: `Token ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url: audioUrl }),
    }
  );

  if (!response.ok) {
    const status = response.status;
    if (status === 429) {
      throw new Error("STT_RATE_LIMIT");
    }
    throw new Error(`STT_ERROR: ${status} ${response.statusText}`);
  }

  const data = await response.json();
  const result = data.results?.channels?.[0]?.alternatives?.[0];

  if (!result || !result.transcript || result.transcript.trim().length === 0) {
    throw new Error("STT_EMPTY_TRANSCRIPT");
  }

  return {
    transcript: result.transcript,
    confidence: result.confidence ?? 0,
    duration_seconds: Math.round(data.metadata?.duration ?? 0),
    language,
  };
}
