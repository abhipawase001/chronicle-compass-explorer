import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { aiJson, toBase64, type AiPart } from "./ai.server";

export type DocumentRow = {
  id: string;
  name: string;
  language: string | null;
  published_at: string | null;
  status: string;
  progress: number;
  error: string | null;
  created_at: string;
  article_count: number;
};

export const listDocuments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DocumentRow[]> => {
    const { data, error } = await context.supabase
      .from("documents")
      .select("id, name, language, published_at, status, progress, error, created_at, articles(id)")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((d) => {
      const { articles, ...rest } = d as typeof d & { articles: { id: string }[] };
      return { ...rest, article_count: articles?.length ?? 0 } as DocumentRow;
    });
  });

export const registerDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        name: z.string().min(1),
        storagePath: z.string().min(1),
        mimeType: z.string().min(1),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("documents")
      .insert({
        user_id: context.userId,
        name: data.name,
        storage_path: data.storagePath,
        mime_type: data.mimeType,
        status: "pending",
        progress: 0,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

export const deleteDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: doc } = await context.supabase
      .from("documents")
      .select("storage_path")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (doc?.storage_path) {
      await context.supabase.storage.from("newspapers").remove([doc.storage_path]);
    }
    const { error } = await context.supabase
      .from("documents")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

type Extraction = {
  language?: string;
  published_at?: string | null;
  source?: string | null;
  articles?: {
    headline?: string;
    date?: string | null;
    source?: string | null;
    text?: string;
    entities?: string[];
  }[];
};

const SYSTEM = `You read scanned or digital newspaper pages and return structured data.
Return ONLY valid JSON, no markdown, in this exact shape:
{"language":"<publication language in English, e.g. Hindi>","published_at":"YYYY-MM-DD or null","source":"<newspaper name or null>","articles":[{"headline":"...","date":"YYYY-MM-DD or null","source":"<newspaper name>","text":"<the article text verbatim in its ORIGINAL language>","entities":["Person or organisation or project names mentioned"]}]}
Keep article text in the original language exactly as printed. Split the page into distinct articles. If a date is not printed on an article, use the publication date. Never invent facts.`;

export const processDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: doc, error: docError } = await supabase
      .from("documents")
      .select("id, name, storage_path, mime_type, status")
      .eq("id", data.id)
      .eq("user_id", userId)
      .single();
    if (docError || !doc) throw new Error(docError?.message ?? "Document not found");

    await supabase
      .from("documents")
      .update({ status: "extracting", progress: 15, error: null })
      .eq("id", doc.id);

    try {
      const file = await supabase.storage.from("newspapers").download(doc.storage_path);
      if (file.error || !file.data) throw new Error(file.error?.message ?? "File download failed");

      const base64 = toBase64(await file.data.arrayBuffer());
      const mime = doc.mime_type || "application/pdf";
      const filePart: AiPart = mime.startsWith("image/")
        ? { type: "image_url", image_url: { url: `data:${mime};base64,${base64}` } }
        : { type: "file", file: { filename: doc.name, file_data: `data:${mime};base64,${base64}` } };

      await supabase.from("documents").update({ progress: 45 }).eq("id", doc.id);

      const result = await aiJson<Extraction>({
        system: SYSTEM,
        parts: [
          {
            type: "text",
            text: `Extract every article from this newspaper file named "${doc.name}".`,
          },
          filePart,
        ],
      });

      const articles = (result.articles ?? []).filter((a) => (a.text ?? "").trim().length > 20);

      await supabase.from("articles").delete().eq("document_id", doc.id);
      if (articles.length) {
        const { error: insertError } = await supabase.from("articles").insert(
          articles.map((a) => ({
            document_id: doc.id,
            user_id: userId,
            headline: a.headline ?? null,
            article_date: a.date ?? result.published_at ?? null,
            source: a.source ?? result.source ?? doc.name,
            original_text: (a.text ?? "").trim(),
            original_language: result.language ?? null,
            entities: (a.entities ?? []).filter(Boolean).slice(0, 40),
          })),
        );
        if (insertError) throw new Error(insertError.message);
      }

      await supabase
        .from("documents")
        .update({
          status: "ready",
          progress: 100,
          language: result.language ?? null,
          published_at: result.published_at ?? null,
          error: articles.length ? null : "No readable articles were found in this file.",
        })
        .eq("id", doc.id);

      return { articles: articles.length };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Extraction failed";
      await supabase
        .from("documents")
        .update({ status: "failed", progress: 100, error: message })
        .eq("id", doc.id);
      throw new Error(message);
    }
  });
