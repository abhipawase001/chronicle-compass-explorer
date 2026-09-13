import { requireChronicleAuth } from "./auth-token-middleware";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { aiJson } from "./ai.server";

export type TimelineItem = {
  id: string;
  date: string | null;
  source: string;
  headline: string | null;
  translatedSummary: string;
  originalText: string;
  originalLanguage: string;
};

const SYSTEM = `You are an analyst building a chronological dossier about one entity from newspaper articles.
You receive a JSON array of articles (id, date, source, headline, language, text) and a target output language.
Return ONLY valid JSON: {"items":[{"id":"<article id>","summary":"<1-2 sentence factual summary written in the TARGET LANGUAGE>"}]}
Include ONLY articles that genuinely mention or concern the queried entity (accept spelling and transliteration variants of the same name). Never invent facts, never add articles that are not in the input. Omit anything unrelated.`;

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

export const searchTimeline = createServerFn({ method: "POST" })
  .middleware([requireChronicleAuth])
  .inputValidator((input: unknown) =>
    z.object({ query: z.string().min(1), language: z.string().min(1) }).parse(input),
  )
  .handler(async ({ data, context }): Promise<TimelineItem[]> => {
    const { supabase, userId } = context;
    const term = data.query.trim();

    const { data: all, error } = await supabase
      .from("articles")
      .select("id, article_date, source, headline, original_text, original_language, entities")
      .eq("user_id", userId)
      .order("article_date", { ascending: true })
      .limit(500);
    if (error) throw new Error(error.message);

    const rows = all ?? [];
    if (!rows.length) return [];

    // Score rows locally so the AI only sees the most likely matches.
    const needle = norm(term);
    const words = needle.split(" ").filter((w) => w.length > 2);
    const scored = rows
      .map((r) => {
        const headline = norm(r.headline ?? "");
        const entities = norm((r.entities ?? []).join(" "));
        const text = norm(r.original_text ?? "");
        let score = 0;
        if (entities.includes(needle)) score += 6;
        if (headline.includes(needle)) score += 5;
        if (text.includes(needle)) score += 4;
        for (const w of words) {
          if (entities.includes(w)) score += 2;
          if (headline.includes(w)) score += 1.5;
          if (text.includes(w)) score += 1;
        }
        return { row: r, score };
      })
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score);

    // Nothing matched locally: the entity simply is not in the library.
    if (!scored.length) return [];

    const candidates = scored.slice(0, 30).map((s) => s.row);

    const result = await aiJson<{ items?: { id: string; summary: string }[] }>({
      system: SYSTEM,
      parts: [
        {
          type: "text",
          text: `Entity / query: ${term}\nTarget output language: ${data.language}\n\nArticles:\n${JSON.stringify(
            candidates.map((c) => ({
              id: c.id,
              date: c.article_date,
              source: c.source,
              headline: c.headline,
              language: c.original_language,
              text: (c.original_text ?? "").slice(0, 1800),
            })),
          )}`,
        },
      ],
    });

    const byId = new Map(candidates.map((c) => [c.id as string, c]));
    return (result.items ?? [])
      .filter((i) => byId.has(i.id))
      .map((i) => {
        const row = byId.get(i.id)!;
        return {
          id: row.id as string,
          date: row.article_date as string | null,
          source: (row.source as string) ?? "Unknown source",
          headline: (row.headline as string) ?? null,
          translatedSummary: i.summary,
          originalText: row.original_text as string,
          originalLanguage: (row.original_language as string) ?? "Unknown",
        };
      })
      .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
  });

