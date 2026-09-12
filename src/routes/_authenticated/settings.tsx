import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DEFAULT_PREFERENCES,
  getPreferences,
  savePreferences,
  type Preferences,
} from "@/lib/preferences.functions";
import { DATE_FORMATS, LANGUAGES } from "@/lib/constants";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — News Chronicle AI" },
      {
        name: "description",
        content:
          "Configure your account, default report language, date format and ingestion preferences in News Chronicle AI.",
      },
      { property: "og:title", content: "Settings — News Chronicle AI" },
      {
        property: "og:description",
        content: "Account, default report language, date format and ingestion preferences.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const qc = useQueryClient();
  const load = useServerFn(getPreferences);
  const save = useServerFn(savePreferences);
  const { user } = useAuth();

  const prefsQuery = useQuery({ queryKey: ["preferences"], queryFn: () => load() });
  const [form, setForm] = useState<Preferences>(DEFAULT_PREFERENCES);

  useEffect(() => {
    if (prefsQuery.data) setForm(prefsQuery.data);
  }, [prefsQuery.data]);

  const saveMutation = useMutation({
    mutationFn: (data: Preferences) => save({ data }),
    onSuccess: (data) => {
      qc.setQueryData(["preferences"], data);
    },
  });

  const set = <K extends keyof Preferences>(key: K, value: Preferences[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Saved to your account — they follow you to every session.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>You are signed in, so your newspapers are saved.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm">{user?.email ?? "Signed in"}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reports</CardTitle>
          <CardDescription>Defaults applied to every generated timeline.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="default-language">Default report language</Label>
            <Select
              value={form.default_language}
              onValueChange={(v) => set("default_language", v)}
            >
              <SelectTrigger id="default-language" className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((l) => (
                  <SelectItem key={l} value={l}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="date-format">Date format</Label>
            <Select value={form.date_format} onValueChange={(v) => set("date_format", v)}>
              <SelectTrigger id="date-format" className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DATE_FORMATS.map((d) => (
                  <SelectItem key={d.value} value={d.value}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="keep-original">Always keep original text</Label>
              <p className="text-xs text-muted-foreground">
                Show the native-language snippet alongside each translation.
              </p>
            </div>
            <Switch
              id="keep-original"
              checked={form.keep_original}
              onCheckedChange={(v) => set("keep_original", v)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ingestion</CardTitle>
          <CardDescription>How newspapers are processed after upload.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="auto-extract">Auto-start extraction</Label>
              <p className="text-xs text-muted-foreground">
                Begin reading each file as soon as it lands.
              </p>
            </div>
            <Switch
              id="auto-extract"
              checked={form.auto_extract}
              onCheckedChange={(v) => set("auto_extract", v)}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="detect-language">Detect language automatically</Label>
              <p className="text-xs text-muted-foreground">
                Tag each document with its detected publication language.
              </p>
            </div>
            <Switch
              id="detect-language"
              checked={form.detect_language}
              onCheckedChange={(v) => set("detect_language", v)}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending}>
          {saveMutation.isPending && <Loader2 className="size-4 animate-spin" />}
          Save preferences
        </Button>
        {saveMutation.isSuccess && !saveMutation.isPending && (
          <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
            <Check className="size-4" /> Saved
          </span>
        )}
      </div>
    </div>
  );
}
