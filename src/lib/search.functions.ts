import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
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
You receive a JSON array of articles (id, date, source, language, text) and a target output language.
Return ONLY valid JSON: {"items":[{"id":"<article id>","summary":"<1-2 sentence factual summary written in the TARGET LANGUAGE>"}]}
Include ONLY articles that genuinely mention or concern the queried entity. Never invent facts, never add articles that are not in the input.`;

export const searchTimeline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
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
      .limit(300);
    if (error) throw new Error(error.message);

    const rows = all ?? [];
    if (!rows.length) return [];

    const lower = term.toLowerCase();
    const prefiltered = rows.filter(
      (r) =>
        r.original_text?.toLowerCase().includes(lower) ||
        r.headline?.toLowerCase().includes(lower) ||
        (r.entities ?? []).some((e: string) => e.toLowerCase().includes(lower)),
    );

    const candidates = (prefiltered.length ? prefiltered : rows).slice(0, 40);

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
              language: c.original_language,
              text: (c.original_text ?? "").slice(0, 4000),
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
