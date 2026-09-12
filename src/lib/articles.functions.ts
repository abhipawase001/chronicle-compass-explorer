import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type ArticleRow = {
  id: string;
  document_id: string;
  headline: string | null;
  article_date: string | null;
  source: string | null;
  original_text: string;
  original_language: string | null;
  entities: string[];
};

export const listArticles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ documentId: z.string().uuid().optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }): Promise<ArticleRow[]> => {
    let query = context.supabase
      .from("articles")
      .select(
        "id, document_id, headline, article_date, source, original_text, original_language, entities",
      )
      .eq("user_id", context.userId)
      .order("article_date", { ascending: true });

    if (data.documentId) query = query.eq("document_id", data.documentId);

    const { data: rows, error } = await query.limit(500);
    if (error) throw new Error(error.message);
    return (rows ?? []) as ArticleRow[];
  });

export const updateArticleEntities = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        entities: z.array(z.string().min(1)).max(80),
        headline: z.string().nullable().optional(),
        articleDate: z.string().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const patch = {
      entities: data.entities,
      ...(data.headline !== undefined ? { headline: data.headline } : {}),
      ...(data.articleDate !== undefined ? { article_date: data.articleDate || null } : {}),
    };

    const { error } = await context.supabase
      .from("articles")
      .update(patch)
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("documents")
      .select("id, name, language, published_at, status, progress, error")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .single();
    if (error) throw new Error(error.message);
    return row;
  });
