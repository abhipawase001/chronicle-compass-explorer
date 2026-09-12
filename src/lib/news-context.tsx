import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

import type { TimelineItem } from "@/lib/search.functions";

type NewsContextValue = {
  query: string;
  setQuery: (q: string) => void;
  language: string;
  setLanguage: (l: string) => void;
  results: TimelineItem[];
  setResults: (items: TimelineItem[]) => void;
};

const NewsContext = createContext<NewsContextValue | null>(null);

export function NewsProvider({ children }: { children: ReactNode }) {
  const [query, setQuery] = useState("");
  const [language, setLanguage] = useState("English");
  const [results, setResults] = useState<TimelineItem[]>([]);

  const value = useMemo(
    () => ({ query, setQuery, language, setLanguage, results, setResults }),
    [query, language, results],
  );

  return <NewsContext.Provider value={value}>{children}</NewsContext.Provider>;
}

export function useNews() {
  const ctx = useContext(NewsContext);
  if (!ctx) throw new Error("useNews must be used inside NewsProvider");
  return ctx;
}
