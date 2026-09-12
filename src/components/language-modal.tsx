import { useEffect, useState } from "react";
import { Languages, Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LANGUAGES } from "@/lib/constants";

export function LanguageModal({
  open,
  onOpenChange,
  query,
  defaultLanguage = "English",
  busy = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  query: string;
  defaultLanguage?: string;
  busy?: boolean;
  onConfirm: (language: string) => void;
}) {
  const [language, setLanguage] = useState<string>(defaultLanguage);

  useEffect(() => {
    setLanguage(defaultLanguage);
  }, [defaultLanguage]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <span className="mb-2 flex size-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            <Languages className="size-5" />
          </span>
          <DialogTitle>Select Output Language</DialogTitle>
          <DialogDescription>
            In which language would you like your chronological report?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm">
            <span className="text-muted-foreground">Query</span>
            <p className="truncate font-medium">{query || "—"}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="output-language">Report language</Label>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger id="output-language" className="w-full">
                <SelectValue placeholder="Choose a language" />
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
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => onConfirm(language)} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            Generate Timeline
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
