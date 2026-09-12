import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type Preferences = {
  default_language: string;
  date_format: string;
  keep_original: boolean;
  auto_extract: boolean;
  detect_language: boolean;
};

export const DEFAULT_PREFERENCES: Preferences = {
  default_language: "English",
  date_format: "dd MMM yyyy",
  keep_original: true,
  auto_extract: true,
  detect_language: true,
};

const PreferencesSchema = z.object({
  default_language: z.string().min(1),
  date_format: z.string().min(1),
  keep_original: z.boolean(),
  auto_extract: z.boolean(),
  detect_language: z.boolean(),
});

export const getPreferences = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Preferences> => {
    const { data, error } = await context.supabase
      .from("user_preferences")
      .select("default_language, date_format, keep_original, auto_extract, detect_language")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ?? DEFAULT_PREFERENCES;
  });

export const savePreferences = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => PreferencesSchema.parse(input))
  .handler(async ({ data, context }): Promise<Preferences> => {
    const { error } = await context.supabase
      .from("user_preferences")
      .upsert({ user_id: context.userId, ...data }, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return data;
  });
