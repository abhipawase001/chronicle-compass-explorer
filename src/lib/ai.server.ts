type Part =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } }
  | { type: "file"; file: { filename: string; file_data: string } };

export type AiPart = Part;

export class AiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function friendly(status: number, message: string) {
  if (status === 402) return message || "AI credits are exhausted. Add credits to keep analysing.";
  if (status === 429) return "The AI service is busy right now. Try again in a moment.";
  if (status === 403) return message || "AI access is blocked for this workspace.";
  return message || "The AI service could not process this request.";
}

export async function aiJson<T>({
  system,
  parts,
  model = "google/gemini-3.8-flash",
}: {
  system: string;
  parts: Part[];
  model?: string;
}): Promise<T> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new AiError(401, "AI is not configured for this project.");

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": key,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: parts },
      ],
    }),
  });

  if (!res.ok) {
    let message = "";
    try {
      const body = (await res.json()) as { error?: { message?: string }; message?: string };
      message = body.error?.message ?? body.message ?? "";
    } catch {
      message = await res.text().catch(() => "");
    }
    throw new AiError(res.status, friendly(res.status, message));
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const raw = data.choices?.[0]?.message?.content ?? "";
  const cleaned = raw
    .replace(/^\s*```(?:json)?/i, "")
    .replace(/```\s*$/, "")
    .trim();
  const start = cleaned.search(/[[{]/);
  const slice = start >= 0 ? cleaned.slice(start) : cleaned;
  try {
    return JSON.parse(slice) as T;
  } catch {
    throw new AiError(502, "The AI response could not be read. Try again.");
  }
}

export async function aiText({
  system,
  parts,
  model = "google/gemini-3.8-flash",
}: {
  system: string;
  parts: Part[];
  model?: string;
}): Promise<string> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new AiError(401, "AI is not configured for this project.");

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": key,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: parts },
      ],
    }),
  });

  if (!res.ok) {
    let message = "";
    try {
      const body = (await res.json()) as { error?: { message?: string }; message?: string };
      message = body.error?.message ?? body.message ?? "";
    } catch {
      message = await res.text().catch(() => "");
    }
    throw new AiError(res.status, friendly(res.status, message));
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };

  return data.choices?.[0]?.message?.content ?? "";
}

export function toBase64(bytes: ArrayBuffer) {
  const view = new Uint8Array(bytes);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < view.length; i += chunk) {
    binary += String.fromCharCode(...view.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/**
 * Extract entities, dates, and metadata from text using AI
 */
export async function extractMetadata(text: string): Promise<{
  language: string;
  entities: Array<{ name: string; type: string; confidence: number }>;
  dates: Array<{ date: string; context: string }>;
  summary: string;
}> {
  const system = `You are a linguistic expert that extracts metadata from text.
Return ONLY valid JSON with this structure:
{
  "language": "language name",
  "entities": [{"name": "...", "type": "person|place|organization|event|other", "confidence": 0.95}],
  "dates": [{"date": "YYYY-MM-DD", "context": "..."}],
  "summary": "brief summary"
}`;

  try {
    const result = await aiJson<{
      language?: string;
      entities?: Array<{ name: string; type: string; confidence: number }>;
      dates?: Array<{ date: string; context: string }>;
      summary?: string;
    }>({
      system,
      parts: [{ type: "text", text: `Extract metadata:\n\n${text.slice(0, 4000)}` }],
    });

    return {
      language: result.language || "Unknown",
      entities: result.entities?.filter((e) => e.confidence > 0.7) ?? [],
      dates: result.dates ?? [],
      summary: result.summary || "",
    };
  } catch (error) {
    console.error("Metadata extraction failed:", error);
    return {
      language: "Unknown",
      entities: [],
      dates: [],
      summary: "",
    };
  }
}

/**
 * Translate text to target language using AI
 */
export async function translateText(
  text: string,
  targetLanguage: string,
  sourceLanguage?: string
): Promise<string> {
  const system = `You are a professional translator. Translate the provided text to ${targetLanguage}.${
    sourceLanguage ? ` Source language: ${sourceLanguage}` : ""
  }
Preserve meaning and context. Do NOT add explanations or markdown. Return ONLY the translated text.`;

  try {
    return await aiText({
      system,
      parts: [{ type: "text", text: text.slice(0, 8000) }],
    });
  } catch (error) {
    console.error("Translation failed:", error);
    return text; // Fallback to original text
  }
}

/**
 * Generate a summary of text using AI
 */
export async function summarizeText(text: string, maxWords = 100): Promise<string> {
  const system = `You are a professional summarizer. Create a concise summary of the provided text in ${maxWords} words or less.
Do NOT add explanations or markdown. Return ONLY the summary.`;

  try {
    return await aiText({
      system,
      parts: [{ type: "text", text: text.slice(0, 8000) }],
    });
  } catch (error) {
    console.error("Summarization failed:", error);
    return text.slice(0, maxWords * 6); // Fallback to truncation
  }
}
