/**
 * Unit tests for gemini.ts (Vertex AI mocked).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Vertex AI mock (hoisted before module imports)
// ---------------------------------------------------------------------------

let mockGenerateContent = vi.fn();

vi.mock("@google-cloud/vertexai", () => {
  let _mockGenerateContent: ReturnType<typeof vi.fn> | null = null;

  const setMockGenerateContent = (fn: ReturnType<typeof vi.fn>) => {
    _mockGenerateContent = fn;
  };

  class MockVertexAI {
    preview = {
      getGenerativeModel: () => ({
        generateContent: (...args: unknown[]) =>
          (_mockGenerateContent as unknown as (...a: unknown[]) => unknown)(...args),
      }),
    };
  }

  return {
    VertexAI: MockVertexAI,
    __setMockGenerateContent: setMockGenerateContent,
  };
});

// Also stub Secrets Manager so the credential bootstrap path is a no-op.
vi.mock("@aws-sdk/client-secrets-manager", () => {
  class MockSecretsManagerClient {
    async send() {
      return { SecretString: "{}" };
    }
  }
  class GetSecretValueCommand {
    constructor(public input: unknown) {}
  }
  return { SecretsManagerClient: MockSecretsManagerClient, GetSecretValueCommand };
});

import {
  transcribeWithGemini,
  scrubAndExtractWithGemini,
  _resetVertexClient,
} from "../gemini.js";

import * as vertexAIMock from "@google-cloud/vertexai";
const setMockGenerateContent = (
  vertexAIMock as unknown as {
    __setMockGenerateContent: (fn: ReturnType<typeof vi.fn>) => void;
  }
).__setMockGenerateContent;

function makeVertexResponse(text: string) {
  return {
    response: {
      candidates: [
        {
          content: {
            parts: [{ text }],
          },
        },
      ],
    },
  };
}

function makeAudioFetchMock(ok: boolean, byteLength = 1024) {
  const buffer = new ArrayBuffer(byteLength);
  return vi.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 500,
    statusText: ok ? "OK" : "Internal Server Error",
    arrayBuffer: () => Promise.resolve(buffer),
  });
}

const PROJECT_ID = "test-gcp-project";
const AUDIO_URL = "https://storage.example.com/audio.webm";

const multiTemplate = {
  name: "T-Res Field Note",
  extraction_mode: "multi" as const,
  max_outputs: 5,
  fields: {
    skill_dimension: { type: "select", options: ["Medical Expert", "Communicator"] },
    rating: { type: "scale", min: 1, max: 5 },
    narrative: { type: "text" },
  },
  competency_framework: "CanMEDS",
};

const singleTemplate = {
  name: "One45 Daily Eval",
  extraction_mode: "single" as const,
  max_outputs: 1,
  fields: {
    overall_rating: { type: "scale", min: 1, max: 5 },
    comments: { type: "text" },
  },
  competency_framework: "CanMEDS",
};

const goodExtractionJson = JSON.stringify({
  outputs: [
    {
      output_index: 1,
      structured_fields: { skill_dimension: "Medical Expert", rating: 4 },
      competency_tags: ["Medical Expert"],
      narrative_summary: "Resident performed an excellent intubation.",
      coaching_did_well: "Smooth technique.",
      coaching_consider: "Communicate steps aloud.",
      confidence: { skill_dimension: 0.9, rating: 0.85 },
    },
  ],
});

// ---------------------------------------------------------------------------
// transcribeWithGemini
// ---------------------------------------------------------------------------

describe("transcribeWithGemini", () => {
  beforeEach(() => {
    _resetVertexClient();
    mockGenerateContent = vi.fn();
    setMockGenerateContent(mockGenerateContent);
    process.env.GOOGLE_APPLICATION_CREDENTIALS = "/tmp/fake-sa.json";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns correct shape on success (en)", async () => {
    vi.stubGlobal("fetch", makeAudioFetchMock(true));
    mockGenerateContent.mockResolvedValue(
      makeVertexResponse("The resident performed an excellent intubation.")
    );

    const result = await transcribeWithGemini(AUDIO_URL, "en", PROJECT_ID);

    expect(result).toMatchObject({
      transcript: "The resident performed an excellent intubation.",
      language: "en",
    });
    expect(typeof result.confidence).toBe("number");
    expect(typeof result.duration_seconds).toBe("number");
  });

  it("returns correct shape on success (fr)", async () => {
    vi.stubGlobal("fetch", makeAudioFetchMock(true));
    mockGenerateContent.mockResolvedValue(
      makeVertexResponse("Le résident a effectué une excellente intubation.")
    );

    const result = await transcribeWithGemini(AUDIO_URL, "fr", PROJECT_ID);

    expect(result.transcript).toBe("Le résident a effectué une excellente intubation.");
    expect(result.language).toBe("fr");
  });

  it("sends French language instruction when language is fr", async () => {
    vi.stubGlobal("fetch", makeAudioFetchMock(true));
    mockGenerateContent.mockResolvedValue(makeVertexResponse("Bonjour."));

    await transcribeWithGemini(AUDIO_URL, "fr", PROJECT_ID);

    const call = mockGenerateContent.mock.calls[0][0];
    const textPart = call.contents[0].parts[1].text as string;
    expect(textPart).toContain("Canadian French");
    expect(textPart).toContain("Quebec");
  });

  it("sends English language instruction when language is en", async () => {
    vi.stubGlobal("fetch", makeAudioFetchMock(true));
    mockGenerateContent.mockResolvedValue(makeVertexResponse("Hello."));

    await transcribeWithGemini(AUDIO_URL, "en", PROJECT_ID);

    const call = mockGenerateContent.mock.calls[0][0];
    const textPart = call.contents[0].parts[1].text as string;
    expect(textPart).toContain("Canadian English");
  });

  it("sends audio as inline base64 data", async () => {
    vi.stubGlobal("fetch", makeAudioFetchMock(true));
    mockGenerateContent.mockResolvedValue(makeVertexResponse("Test."));

    await transcribeWithGemini(AUDIO_URL, "en", PROJECT_ID);

    const call = mockGenerateContent.mock.calls[0][0];
    const inlinePart = call.contents[0].parts[0];
    expect(inlinePart).toHaveProperty("inlineData");
    expect(inlinePart.inlineData).toHaveProperty("mimeType");
    expect(inlinePart.inlineData).toHaveProperty("data");
    expect(inlinePart.inlineData.mimeType).toBe("audio/webm");
  });

  it("throws STT_FETCH_ERROR when audio fetch returns non-2xx", async () => {
    vi.stubGlobal("fetch", makeAudioFetchMock(false));

    await expect(
      transcribeWithGemini(AUDIO_URL, "en", PROJECT_ID)
    ).rejects.toThrow("STT_FETCH_ERROR");
  });

  it("throws STT_EMPTY_TRANSCRIPT when audio buffer is empty", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: "OK",
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
      })
    );

    await expect(
      transcribeWithGemini(AUDIO_URL, "en", PROJECT_ID)
    ).rejects.toThrow("STT_EMPTY_TRANSCRIPT");
  });

  it("throws STT_EMPTY_TRANSCRIPT when Gemini returns empty text", async () => {
    vi.stubGlobal("fetch", makeAudioFetchMock(true));
    mockGenerateContent.mockResolvedValue(makeVertexResponse(""));

    await expect(
      transcribeWithGemini(AUDIO_URL, "en", PROJECT_ID)
    ).rejects.toThrow("STT_EMPTY_TRANSCRIPT");
  });

  it("throws STT_EMPTY_TRANSCRIPT when Gemini returns no candidates", async () => {
    vi.stubGlobal("fetch", makeAudioFetchMock(true));
    mockGenerateContent.mockResolvedValue({ response: { candidates: [] } });

    await expect(
      transcribeWithGemini(AUDIO_URL, "en", PROJECT_ID)
    ).rejects.toThrow("STT_EMPTY_TRANSCRIPT");
  });

  it("propagates Vertex AI errors", async () => {
    vi.stubGlobal("fetch", makeAudioFetchMock(true));
    mockGenerateContent.mockRejectedValue(new Error("VERTEX_QUOTA_EXCEEDED"));

    await expect(
      transcribeWithGemini(AUDIO_URL, "en", PROJECT_ID)
    ).rejects.toThrow("VERTEX_QUOTA_EXCEEDED");
  });

  it("uses audio/mp4 mime type for .mp4 URLs", async () => {
    vi.stubGlobal("fetch", makeAudioFetchMock(true));
    mockGenerateContent.mockResolvedValue(makeVertexResponse("Hello."));

    await transcribeWithGemini(
      "https://storage.example.com/audio.mp4",
      "en",
      PROJECT_ID
    );

    const call = mockGenerateContent.mock.calls[0][0];
    expect(call.contents[0].parts[0].inlineData.mimeType).toBe("audio/mp4");
  });
});

// ---------------------------------------------------------------------------
// scrubAndExtractWithGemini
// ---------------------------------------------------------------------------

describe("scrubAndExtractWithGemini", () => {
  beforeEach(() => {
    _resetVertexClient();
    mockGenerateContent = vi.fn();
    setMockGenerateContent(mockGenerateContent);
    process.env.GOOGLE_APPLICATION_CREDENTIALS = "/tmp/fake-sa.json";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns correct shape on success", async () => {
    mockGenerateContent
      .mockResolvedValueOnce(makeVertexResponse("Scrubbed transcript text."))
      .mockResolvedValueOnce(makeVertexResponse(goodExtractionJson));

    const result = await scrubAndExtractWithGemini(
      "The resident treated patient John Doe in room 214.",
      multiTemplate,
      PROJECT_ID
    );

    expect(result.clean).toBe("Scrubbed transcript text.");
    expect(typeof result.totalRedactions).toBe("number");
    expect(result.extraction.outputs).toHaveLength(1);
    expect(result.extraction.outputs[0]).toMatchObject({
      output_index: 1,
      narrative_summary: "Resident performed an excellent intubation.",
      competency_tags: ["Medical Expert"],
    });
    expect(result.extraction.model).toBeTruthy();
  });

  it("regex pass runs first — MRNs redacted before Gemini sees the text", async () => {
    let capturedScrubPrompt = "";
    mockGenerateContent
      .mockImplementationOnce((req: { contents: Array<{ parts: Array<{ text?: string }> }> }) => {
        capturedScrubPrompt = req.contents[0].parts[0].text ?? "";
        return Promise.resolve(makeVertexResponse("Clean text."));
      })
      .mockResolvedValueOnce(makeVertexResponse(goodExtractionJson));

    await scrubAndExtractWithGemini(
      "Patient MRN C123-4567 presented with dyspnea. Call (416) 555-1234.",
      multiTemplate,
      PROJECT_ID
    );

    expect(capturedScrubPrompt).not.toContain("C123-4567");
    expect(capturedScrubPrompt).not.toContain("555-1234");
    expect(capturedScrubPrompt).toContain("[REDACTED-MRN]");
    expect(capturedScrubPrompt).toContain("[REDACTED-PHONE]");
  });

  it("extraction prompt includes formTemplate field names", async () => {
    let capturedExtractPrompt = "";
    mockGenerateContent
      .mockResolvedValueOnce(makeVertexResponse("Scrubbed."))
      .mockImplementationOnce((req: { contents: Array<{ parts: Array<{ text?: string }> }> }) => {
        capturedExtractPrompt = req.contents[0].parts[0].text ?? "";
        return Promise.resolve(makeVertexResponse(goodExtractionJson));
      });

    await scrubAndExtractWithGemini(
      "Good job with the intubation.",
      multiTemplate,
      PROJECT_ID
    );

    expect(capturedExtractPrompt).toContain("skill_dimension");
    expect(capturedExtractPrompt).toContain("Medical Expert");
    expect(capturedExtractPrompt).toContain("Communicator");
    expect(capturedExtractPrompt).toContain("T-Res Field Note");
    expect(capturedExtractPrompt).toContain("CanMEDS");
  });

  it("extraction prompt says 'exactly ONE' in single mode", async () => {
    let capturedExtractPrompt = "";
    mockGenerateContent
      .mockResolvedValueOnce(makeVertexResponse("Scrubbed."))
      .mockImplementationOnce((req: { contents: Array<{ parts: Array<{ text?: string }> }> }) => {
        capturedExtractPrompt = req.contents[0].parts[0].text ?? "";
        return Promise.resolve(
          makeVertexResponse(
            JSON.stringify({
              outputs: [
                {
                  output_index: 1,
                  structured_fields: { overall_rating: 4 },
                  competency_tags: [],
                  narrative_summary: "Good evaluation.",
                  confidence: {},
                },
              ],
            })
          )
        );
      });

    await scrubAndExtractWithGemini("Good job.", singleTemplate, PROJECT_ID);

    expect(capturedExtractPrompt).toContain("exactly ONE");
    expect(capturedExtractPrompt).not.toContain("MULTIPLE");
  });

  it("extraction prompt contains 'MULTIPLE' in multi mode", async () => {
    let capturedExtractPrompt = "";
    mockGenerateContent
      .mockResolvedValueOnce(makeVertexResponse("Scrubbed."))
      .mockImplementationOnce((req: { contents: Array<{ parts: Array<{ text?: string }> }> }) => {
        capturedExtractPrompt = req.contents[0].parts[0].text ?? "";
        return Promise.resolve(makeVertexResponse(goodExtractionJson));
      });

    await scrubAndExtractWithGemini("Good job.", multiTemplate, PROJECT_ID);

    expect(capturedExtractPrompt).toContain("MULTIPLE");
  });

  it("falls back to regex-only clean text when Gemini scrub call fails", async () => {
    mockGenerateContent
      .mockRejectedValueOnce(new Error("Vertex 503"))
      .mockResolvedValueOnce(makeVertexResponse(goodExtractionJson));

    const result = await scrubAndExtractWithGemini(
      "The resident did well.",
      multiTemplate,
      PROJECT_ID
    );

    expect(typeof result.clean).toBe("string");
    expect(result.clean.length).toBeGreaterThan(0);
    expect(result.extraction.outputs.length).toBeGreaterThan(0);
  });

  it("throws EXTRACTION_EMPTY_RESPONSE when Gemini extraction returns empty text", async () => {
    mockGenerateContent
      .mockResolvedValueOnce(makeVertexResponse("Scrubbed."))
      .mockResolvedValueOnce(makeVertexResponse(""));

    await expect(
      scrubAndExtractWithGemini("Good job.", multiTemplate, PROJECT_ID)
    ).rejects.toThrow("EXTRACTION_EMPTY_RESPONSE");
  });

  it("throws EXTRACTION_PARSE_ERROR when Gemini extraction returns no JSON", async () => {
    mockGenerateContent
      .mockResolvedValueOnce(makeVertexResponse("Scrubbed."))
      .mockResolvedValueOnce(makeVertexResponse("Here is the extraction: sorry, no JSON today."));

    await expect(
      scrubAndExtractWithGemini("Good job.", multiTemplate, PROJECT_ID)
    ).rejects.toThrow("EXTRACTION_PARSE_ERROR");
  });

  it("throws EXTRACTION_PARSE_ERROR when Gemini returns invalid JSON", async () => {
    mockGenerateContent
      .mockResolvedValueOnce(makeVertexResponse("Scrubbed."))
      .mockResolvedValueOnce(makeVertexResponse("{ outputs: [broken json"));

    await expect(
      scrubAndExtractWithGemini("Good job.", multiTemplate, PROJECT_ID)
    ).rejects.toThrow("EXTRACTION_PARSE_ERROR");
  });

  it("throws EXTRACTION_INVALID_FORMAT when JSON has no outputs array", async () => {
    mockGenerateContent
      .mockResolvedValueOnce(makeVertexResponse("Scrubbed."))
      .mockResolvedValueOnce(makeVertexResponse(JSON.stringify({ result: "no outputs here" })));

    await expect(
      scrubAndExtractWithGemini("Good job.", multiTemplate, PROJECT_ID)
    ).rejects.toThrow("EXTRACTION_INVALID_FORMAT");
  });

  it("enforces max_outputs limit", async () => {
    const manyOutputs = {
      outputs: Array.from({ length: 10 }, (_, i) => ({
        output_index: i + 1,
        structured_fields: {},
        competency_tags: [],
        narrative_summary: `Encounter ${i + 1}`,
        confidence: {},
      })),
    };

    mockGenerateContent
      .mockResolvedValueOnce(makeVertexResponse("Scrubbed."))
      .mockResolvedValueOnce(makeVertexResponse(JSON.stringify(manyOutputs)));

    const result = await scrubAndExtractWithGemini("Long session.", multiTemplate, PROJECT_ID);

    expect(result.extraction.outputs).toHaveLength(5);
  });

  it("counts LLM redaction tags in totalRedactions", async () => {
    const scrubbed = "Good feedback. [REDACTED-NAME] did well and [REDACTED-NAME] showed improvement.";
    mockGenerateContent
      .mockResolvedValueOnce(makeVertexResponse(scrubbed))
      .mockResolvedValueOnce(makeVertexResponse(goodExtractionJson));

    const result = await scrubAndExtractWithGemini(
      "The resident did well.",
      multiTemplate,
      PROJECT_ID
    );

    expect(result.totalRedactions).toBeGreaterThanOrEqual(2);
  });

  it("includes the scrubbed transcript text in the extraction prompt", async () => {
    const scrubbedText = "The resident performed excellently with no PHI.";
    let capturedExtractPrompt = "";

    mockGenerateContent
      .mockResolvedValueOnce(makeVertexResponse(scrubbedText))
      .mockImplementationOnce((req: { contents: Array<{ parts: Array<{ text?: string }> }> }) => {
        capturedExtractPrompt = req.contents[0].parts[0].text ?? "";
        return Promise.resolve(makeVertexResponse(goodExtractionJson));
      });

    await scrubAndExtractWithGemini("Some raw transcript.", multiTemplate, PROJECT_ID);

    expect(capturedExtractPrompt).toContain(scrubbedText);
  });
});

// ---------------------------------------------------------------------------
// French / Québécois production cutover
// ---------------------------------------------------------------------------

describe("French production cutover — Gemini request structure", () => {
  beforeEach(() => {
    _resetVertexClient();
    mockGenerateContent = vi.fn();
    setMockGenerateContent(mockGenerateContent);
    process.env.GOOGLE_APPLICATION_CREDENTIALS = "/tmp/fake-sa.json";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("transcribeWithGemini sends Quebec French instruction for fr language", async () => {
    vi.stubGlobal("fetch", makeAudioFetchMock(true));
    mockGenerateContent.mockResolvedValue(
      makeVertexResponse("Bon travail avec le patient aujourd'hui.")
    );

    const result = await transcribeWithGemini(AUDIO_URL, "fr", PROJECT_ID);

    const call = mockGenerateContent.mock.calls[0][0];
    const textPart = call.contents[0].parts[1].text as string;
    expect(textPart).toContain("Canadian French");
    expect(textPart).toContain("Quebec");
    expect(result.language).toBe("fr");
  });

  it("scrubAndExtractWithGemini PHI prompt explicitly lists Canadian health card types", async () => {
    let capturedScrubPrompt = "";
    mockGenerateContent
      .mockImplementationOnce((req: { contents: Array<{ parts: Array<{ text?: string }> }> }) => {
        capturedScrubPrompt = req.contents[0].parts[0].text ?? "";
        return Promise.resolve(makeVertexResponse("Texte nettoyé."));
      })
      .mockResolvedValueOnce(makeVertexResponse(goodExtractionJson));

    await scrubAndExtractWithGemini(
      "Le résident a bien travaillé avec le patient.",
      multiTemplate,
      PROJECT_ID
    );

    expect(capturedScrubPrompt).toContain("OHIP");
    expect(capturedScrubPrompt).toContain("RAMQ");
    expect(capturedScrubPrompt).toContain("PHN");
  });

  it("scrubAndExtractWithGemini extraction prompt handles bilingual instruction", async () => {
    let capturedExtractPrompt = "";
    mockGenerateContent
      .mockResolvedValueOnce(makeVertexResponse("Texte propre."))
      .mockImplementationOnce((req: { contents: Array<{ parts: Array<{ text?: string }> }> }) => {
        capturedExtractPrompt = req.contents[0].parts[0].text ?? "";
        return Promise.resolve(makeVertexResponse(goodExtractionJson));
      });

    await scrubAndExtractWithGemini(
      "Le résident a fait un excellent travail.",
      multiTemplate,
      PROJECT_ID
    );

    expect(capturedExtractPrompt).toContain("Canadian French");
    expect(capturedExtractPrompt).toContain("Québécois");
  });
});
