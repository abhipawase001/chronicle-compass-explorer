import { useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertCircle, CalendarDays, FileText, Tags, Trash2, UploadCloud } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import {
  deleteDocument as deleteDocumentFn,
  listDocuments,
  processDocument,
  registerDocument,
} from "@/lib/documents.functions";
import { formatDate } from "@/lib/constants";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Ingestion Engine — News Chronicle AI" },
      {
        name: "description",
        content:
          "Upload multilingual newspaper PDFs and scans, track extraction status, and prepare documents for entity timelines.",
      },
      { property: "og:title", content: "Ingestion Engine — News Chronicle AI" },
      {
        property: "og:description",
        content: "Upload newspapers and track extraction status across languages.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: UploadsPage,
});

const statusStyles: Record<string, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-muted text-muted-foreground" },
  extracting: { label: "Extracting", className: "bg-chart-4/20 text-foreground" },
  ready: { label: "Ready", className: "bg-primary/10 text-primary" },
  failed: { label: "Failed", className: "bg-destructive/10 text-destructive" },
};

function UploadsPage() {
  const qc = useQueryClient();
  const list = useServerFn(listDocuments);
  const register = useServerFn(registerDocument);
  const process = useServerFn(processDocument);
  const remove = useServerFn(deleteDocumentFn);

  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const docsQuery = useQuery({
    queryKey: ["documents"],
    queryFn: () => list(),
    refetchInterval: (q) =>
      (q.state.data ?? []).some((d) => d.status === "pending" || d.status === "extracting")
        ? 3000
        : false,
  });

  const uploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      const { data: session } = await supabase.auth.getUser();
      const uid = session.user?.id;
      if (!uid) throw new Error("You need to be signed in to upload.");

      for (const file of files) {
        const path = `${uid}/${crypto.randomUUID()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
        const up = await supabase.storage.from("newspapers").upload(path, file, {
          contentType: file.type || "application/pdf",
        });
        if (up.error) throw new Error(up.error.message);

        const { id } = await register({
          data: { name: file.name, storagePath: path, mimeType: file.type || "application/pdf" },
        });
        await qc.invalidateQueries({ queryKey: ["documents"] });
        await process({ data: { id } }).catch(() => undefined);
        await qc.invalidateQueries({ queryKey: ["documents"] });
      }
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Upload failed"),
    onSuccess: () => setError(null),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["documents"] }),
  });

  const handleFiles = (list: FileList | null) => {
    if (!list?.length) return;
    const valid = Array.from(list).filter(
      (f) => f.type === "application/pdf" || f.type.startsWith("image/"),
    );
    if (!valid.length) {
      setError("Please choose PDF or image files only.");
      return;
    }
    uploadMutation.mutate(valid);
  };

  const docs = docsQuery.data ?? [];
  const busy = uploadMutation.isPending;

  return (
    <div className="p-6">
      <div className="mx-auto max-w-5xl space-y-8">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">Ingestion Engine</h1>
          <p className="text-sm text-muted-foreground">
            Drop newspaper PDFs or page scans — text, dates and entities are extracted for you.
          </p>
        </header>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            handleFiles(e.dataTransfer.files);
          }}
          className={cn(
            "flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-14 text-center transition-colors",
            dragging ? "border-primary bg-accent" : "border-border bg-card",
            busy && "opacity-60",
          )}
        >
          <span className="flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <UploadCloud className="size-6" />
          </span>
          <p className="text-base font-medium">Drag & drop newspapers here</p>
          <p className="text-sm text-muted-foreground">PDF, JPG or PNG</p>
          <Button variant="outline" onClick={() => inputRef.current?.click()} disabled={busy}>
            {busy ? "Reading your newspaper…" : "Browse files"}
          </Button>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".pdf,image/*"
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold tracking-tight">
            Uploaded Newspapers ({docs.length})
          </h2>

          {docsQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : docs.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
                <FileText className="size-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  No documents yet. Upload a newspaper to get started.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {docs.map((doc) => {
                const s = statusStyles[doc.status] ?? statusStyles['pending']!;
                return (
                  <Card
                    key={doc.id}
                    className={doc.status === "failed" ? "border-destructive/50" : ""}
                  >
                    <CardContent className="space-y-3 p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 flex-1 items-start gap-3">
                          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
                            <FileText className="size-4 text-muted-foreground" />
                          </span>
                          <p className="line-clamp-2 break-words text-sm font-medium leading-snug">
                            {doc.name}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteMutation.mutate(doc.id)}
                          className="shrink-0 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {doc.language && <Badge variant="outline">{doc.language}</Badge>}
                        <Badge className={cn("border-transparent", s.className)}>{s.label}</Badge>
                        {doc.article_count ? (
                          <Badge variant="secondary">{doc.article_count} articles</Badge>
                        ) : null}
                      </div>

                      <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                        <CalendarDays className="size-3.5" />
                        {formatDate(doc.published_at ?? doc.created_at)}
                      </p>

                      {(doc.status === "pending" || doc.status === "extracting") && (
                        <div className="space-y-1">
                          <Progress value={doc.progress} />
                          <p className="text-xs text-muted-foreground">{doc.progress}% extracted</p>
                        </div>
                      )}

                      {doc.error && (
                        <div className="rounded-md bg-destructive/10 p-2">
                          <p className="text-xs text-destructive">{doc.error}</p>
                        </div>
                      )}

                      {doc.status === "ready" && (
                        <Button asChild variant="outline" size="sm" className="w-full">
                          <Link to="/documents/$documentId" params={{ documentId: doc.id }}>
                            <Tags className="size-4" /> Tag entities
                          </Link>
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
