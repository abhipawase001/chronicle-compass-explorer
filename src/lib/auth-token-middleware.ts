import { createClient } from "@supabase/supabase-js";
import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import { supabase as browserSupabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

const AUTH_HEADER = "x-chronicle-access-token";

function createBackendFetch(apiKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );
    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }
    if (headers.get("Authorization") === `Bearer ${apiKey}`) {
      headers.delete("Authorization");
    }
    headers.set("apikey", apiKey);
    return fetch(input, { ...init, headers });
  };
}

export const attachChronicleAuth = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    const { data } = await browserSupabase.auth.getSession();
    const token = data.session?.access_token;
    return next({ headers: token ? { [AUTH_HEADER]: token } : {} });
  },
);

export const requireChronicleAuth = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const request = getRequest();
    const customToken = request?.headers.get(AUTH_HEADER)?.trim();
    const authorization = request?.headers.get("authorization")?.trim();
    const bearerToken = authorization?.startsWith("Bearer ")
      ? authorization.slice("Bearer ".length).trim()
      : undefined;
    const token = customToken || bearerToken;

    if (!token) throw new Error("Unauthorized: Please sign in again");

    const backendUrl = process.env["SUPABASE_URL"];
    const publishableKey = process.env["SUPABASE_PUBLISHABLE_KEY"];
    if (!backendUrl || !publishableKey) {
      throw new Error("Authentication is not configured on this deployment");
    }

    const supabase = createClient<Database>(backendUrl, publishableKey, {
      global: {
        fetch: createBackendFetch(publishableKey),
        headers: { Authorization: `Bearer ${token}` },
      },
      auth: {
        storage: undefined,
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) throw new Error("Unauthorized: Please sign out and sign in again");

    return next({
      context: {
        supabase,
        userId: data.user.id,
        claims: data.user.app_metadata,
      },
    });
  },
);