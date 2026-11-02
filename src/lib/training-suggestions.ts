import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { attachSupabaseAuth } from "./auth-attacher";
import { contextSuggestion, type TrainingContext } from "./training-context";
export const getTrainingSuggestion = createServerFn({ method: "GET" })
  .middleware([attachSupabaseAuth])
  .validator(z.object({ memberId: z.string().uuid(), slot: z.string().min(1).max(100) }))
  .handler(async ({ data }) => {
    const { getRequestHeader } = await import("@tanstack/react-start/server");
    const { createClient } = await import("@supabase/supabase-js");
    const authorization = getRequestHeader("authorization");
    if (!authorization?.startsWith("Bearer "))
      throw new Error("Sign in to refresh training targets.");
    const url = process.env["SUPABASE_URL"] ?? import.meta.env["VITE_SUPABASE_URL"],
      key =
        process.env["SUPABASE_PUBLISHABLE_KEY"] ?? import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
    const client = createClient(url, key, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const auth = await client.auth.getUser(authorization.slice(7));
    if (auth.error || !auth.data.user) throw new Error("Sign in to refresh training targets.");
    const result = await client.rpc("get_training_context", {
      _member: data.memberId,
      _slot: data.slot,
    });
    if (result.error) throw new Error(result.error.message);
    if (!result.data) return null;
    const context = result.data as TrainingContext;
    return { context, suggestion: contextSuggestion(context) };
  });
