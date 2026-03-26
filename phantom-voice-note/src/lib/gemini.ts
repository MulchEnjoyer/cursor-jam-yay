type GeminiTranscriptResponse = {
  transcriptText: string;
  quote?: string;
  topics?: string[];
  keyTakeaways?: string[];
  actionItems?: string[];
};

type GeminiGenerateContentResponse = {
  error?: {
    message?: string;
  };
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
};

function extractJson<T = unknown>(text: string): T | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;

  const candidate = text.slice(start, end + 1);
  try {
    return JSON.parse(candidate) as T;
  } catch {
    return null;
  }
}

export async function transcribeAndSummarizeWithGeminiFlash(audioUrl: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const model = process.env.GEMINI_MODEL || "gemini-1.5-flash";
  const mimeType = process.env.GEMINI_AUDIO_MIME_TYPE || "audio/webm";

  const prompt = [
    "Transcribe the audio. If timestamps are present, keep them as part of the transcriptText.",
    "Then produce insights in strict JSON with this shape:",
    "{",
    '  "transcriptText": string,',
    '  "quote": string,',
    '  "topics": string[],',
    '  "keyTakeaways": string[],',
    '  "actionItems": string[]',
    "}",
    "Return ONLY the JSON object (no markdown, no extra commentary).",
  ].join("\n");

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
    apiKey,
  )}`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            {
              fileData: {
                mimeType,
                fileUri: audioUrl,
              },
            },
            { text: prompt },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.2,
      },
    }),
  });

  const data = (await res.json()) as GeminiGenerateContentResponse;
  if (!res.ok) {
    throw new Error(data?.error?.message || `Gemini request failed (${res.status})`);
  }

  const text: string | undefined =
    data?.candidates?.[0]?.content?.parts
      ?.map((p) => p?.text)
      ?.filter((t): t is string => Boolean(t))
      ?.join("") || data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error("Gemini returned no text.");
  }

  const parsed = extractJson<GeminiTranscriptResponse>(text);
  if (!parsed?.transcriptText) {
    throw new Error("Gemini did not return the expected JSON shape.");
  }

  return {
    transcriptText: parsed.transcriptText,
    insights: {
      quote: parsed.quote ?? null,
      topics: parsed.topics ?? [],
      keyTakeaways: parsed.keyTakeaways ?? [],
      actionItems: parsed.actionItems ?? [],
    },
  };
}

