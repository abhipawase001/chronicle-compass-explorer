import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Newspaper, Loader2 } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — News Chronicle AI" },
      {
        name: "description",
        content:
          "Sign in to News Chronicle AI to keep your uploaded newspapers, entity tags and report preferences across sessions.",
      },
      { property: "og:title", content: "Sign in — News Chronicle AI" },
      {
        property: "og:description",
        content: "Access your saved newspapers, entity tags and timeline preferences.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

const ACCESS_PASSWORD = "Chiu@2005";
const INTERNAL_SUFFIX = "#nc-2005-store";

function AuthPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/" });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) navigate({ to: "/" });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  const run = async () => {
    const name = username.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "");
    if (!name) {
      setError("Please enter a username.");
      return;
    }
    if (password !== ACCESS_PASSWORD) {
      setError("Incorrect password.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const email = `${name}@chronicle.local`;
      const secret = `${ACCESS_PASSWORD}${INTERNAL_SUFFIX}`;

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: secret,
      });

      if (signInError) {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password: secret,
          options: { emailRedirectTo: window.location.origin },
        });
        if (signUpError) throw signUpError;

        const { error: retryError } = await supabase.auth.signInWithPassword({
          email,
          password: secret,
        });
        if (retryError) throw retryError;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2 text-center">
          <span className="mx-auto flex size-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Newspaper className="size-5" />
          </span>
          <CardTitle>News Chronicle AI</CardTitle>
          <CardDescription>
            Pick any username and enter the shared access password to continue.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              type="text"
              autoComplete="username"
              placeholder="e.g. abhishek"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && run()}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && run()}
            />
          </div>
          <Button className="w-full" onClick={run} disabled={busy || !username || !password}>
            {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
            Sign in
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

