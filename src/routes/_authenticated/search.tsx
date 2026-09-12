import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarDays, ChevronDown, Loader2, Newspaper, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { LanguageModal } from "@/components/language-modal";
import { searchTimeline, type TimelineItem } from "@/lib/search.functions";
import { getPreferences } from "@/lib/preferences.functions";
import { formatDate } from "@/lib/constants";
import { useNews } from "@/lib/news-context";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/search")({
  head: () => ({
    meta: [
      { title: "Search Engine — News Chronicle AI" },
      {
        name: "description",
        content:
          "Search for a name or entity across your uploaded newspapers and view a chronological, translated timeline of mentions.",
      },
      { property: "og:title", content: "Search Engine — News Chronicle AI" },
      {
        property: "og:description",
        content: "Build a chronological timeline of entity mentions across multilingual newspapers.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SearchPage,
});

function TimelineCard({ item }: { item: TimelineItem }) {
  const [open, setOpen] = useState(false);
  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="size-3.5" />
            {formatDate(item.date)}
          </span>
          <Badge variant="outline">{item.source}</Badge>
          <Badge variant="secondary">{item.originalLanguage}</Badge>
        </div>
        {item.headline && <h3 className="text-base font-semibold leading-snug">{item.headline}</h3>}
        <p className="text-sm leading-relaxed">{item.translatedSummary}</p>
        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
            <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} />
            {open ? "Hide original text" : "Show original text"}
          </CollapsibleTrigger>
          <CollapsibleContent>
            <p className="mt-2 whitespace-pre-wrap rounded-md bg-muted/50 p-3 text-xs leading-relaxed text-muted-foreground">
              {item.originalText}
            </p>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}

function SearchPage() {
  const search = useServerFn(searchTimeline);
  const loadPrefs = useServerFn(getPreferences);
  const { query, setQuery, language, setLanguage, results, setResults } = useNews();
  const [modalOpen, setModalOpen] = useState(false);

  const prefsQuery = useQuery({ queryKey: ["preferences"], queryFn: () => loadPrefs() });

  const searchMutation = useMutation({
    mutationFn: (lang: string) => search({ data: { query, language: lang } }),
    onSuccess: (items, lang) => {
      setResults(items);
      setLanguage(lang);
    },
  });

  const startSearch = () => {
    if (!query.trim()) return;
    setModalOpen(true);
  };

  return (
    <div className="p-6">
      <div className="mx-auto max-w-3xl space-y-8">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">Search Engine</h1>
          <p className="text-sm text-muted-foreground">
            Search for a person, organisation or topic across your newspapers and get a
            chronological timeline in the language you choose.
          </p>
        </header>

        <div className="flex gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && startSearch()}
            placeholder="e.g. a politician, a company, a place…"
            className="h-11"
          />
          <Button className="h-11" onClick={startSearch} disabled={!query.trim()}>
            <Search className="size-4" /> Search
          </Button>
        </div>

        {searchMutation.isError && (
          <p className="text-sm text-destructive">
            {searchMutation.error instanceof Error
              ? searchMutation.error.message
              : "Search failed. Please try again."}
          </p>
        )}

        {searchMutation.isPending ? (
          <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
            <span className="text-sm">Building your timeline in {language}…</span>
          </div>
        ) : searchMutation.isSuccess && results.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
              <Newspaper className="size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No mentions of “{query}” found in your uploaded newspapers.
              </p>
            </CardContent>
          </Card>
        ) : results.length > 0 ? (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold tracking-tight">
              Timeline for “{query}” ({results.length})
            </h2>
            <div className="relative space-y-4 before:absolute before:bottom-2 before:left-[7px] before:top-2 before:w-px before:bg-border">
              {results.map((item) => (
                <div key={item.id} className="relative pl-7">
                  <span className="absolute left-0 top-5 size-[15px] rounded-full border-2 border-primary bg-background" />
                  <TimelineCard item={item} />
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>

      <LanguageModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        query={query}
        defaultLanguage={prefsQuery.data?.default_language ?? "English"}
        busy={searchMutation.isPending}
        onConfirm={(lang) => {
          setModalOpen(false);
          setLanguage(lang);
          searchMutation.mutate(lang);
        }}
      />
    </div>
  );
}
