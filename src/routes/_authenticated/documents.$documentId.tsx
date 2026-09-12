import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, CalendarDays, Check, Loader2, Plus, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  getDocument,
  listArticles,
  updateArticleEntities,
  type ArticleRow,
} from "@/lib/articles.functions";
import { formatDate } from "@/lib/constants";

export const Route = createFileRoute("/_authenticated/documents/$documentId")({
  head: () => ({
    meta: [
      { title: "Tag Entities — News Chronicle AI" },
      {
        name: "description",
        content:
          "Review extracted articles from a newspaper and refine the entities, headlines and dates attached to each one.",
      },
      { property: "og:title", content: "Tag Entities — News Chronicle AI" },
      {
        property: "og:description",
        content: "Review and refine entities extracted from an uploaded newspaper.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DocumentDetailPage,
});

function ArticleEditor({ article }: { article: ArticleRow }) {
  const qc = useQueryClient();
  const save = useServerFn(updateArticleEntities);
  const [entities, setEntities] = useState<string[]>(article.entities);
  const [draft, setDraft] = useState("");

  const saveMutation = useMutation({
    mutationFn: (next: string[]) =>
      save({ data: { id: article.id, entities: next } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["articles", article.document_id] }),
  });

  const addEntity = () => {
    const value = draft.trim();
    if (!value || entities.includes(value)) return;
    const next = [...entities, value];
    setEntities(next);
    setDraft("");
    saveMutation.mutate(next);
  };

  const removeEntity = (value: string) => {
    const next = entities.filter((e) => e !== value);
    setEntities(next);
    saveMutation.mutate(next);
  };

  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="size-3.5" />
            {formatDate(article.article_date)}
          </span>
          {article.source && <Badge variant="outline">{article.source}</Badge>}
          {article.original_language && <Badge variant="secondary">{article.original_language}</Badge>}
          {saveMutation.isPending && <Loader2 className="size-3.5 animate-spin" />}
          {saveMutation.isSuccess && !saveMutation.isPending && (
            <Check className="size-3.5 text-primary" />
          )}
        </div>

        {article.headline && (
          <h3 className="text-base font-semibold leading-snug">{article.headline}</h3>
        )}

        <p className="line-clamp-4 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
          {article.original_text}
        </p>

        <div className="flex flex-wrap items-center gap-2">
          {entities.map((entity) => (
            <Badge key={entity} variant="secondary" className="gap-1">
              {entity}
              <button
                type="button"
                aria-label={`Remove ${entity}`}
                onClick={() => removeEntity(entity)}
                className="hover:text-destructive"
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
          <div className="flex items-center gap-1">
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addEntity()}
              placeholder="Add entity"
              className="h-7 w-32 text-xs"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              onClick={addEntity}
              disabled={!draft.trim()}
            >
              <Plus className="size-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DocumentDetailPage() {
  const { documentId } = Route.useParams();
  const loadDoc = useServerFn(getDocument);
  const loadArticles = useServerFn(listArticles);

  const docQuery = useQuery({
    queryKey: ["document", documentId],
    queryFn: () => loadDoc({ data: { id: documentId } }),
  });
  const articlesQuery = useQuery({
    queryKey: ["articles", documentId],
    queryFn: () => loadArticles({ data: { documentId } }),
  });

  const articles = articlesQuery.data ?? [];

  return (
    <div className="p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link to="/">
            <ArrowLeft className="size-4" /> Back to uploads
          </Link>
        </Button>

        <header>
          <h1 className="text-2xl font-semibold tracking-tight">
            {docQuery.data?.name ?? "Document"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Review the extracted articles and refine the entities attached to each one. Changes
            save automatically.
          </p>
        </header>

        {articlesQuery.isLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
            <span className="text-sm">Loading articles…</span>
          </div>
        ) : articles.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <p className="text-sm text-muted-foreground">
                No articles were extracted from this document yet.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {articles.map((article) => (
              <ArticleEditor key={article.id} article={article} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
