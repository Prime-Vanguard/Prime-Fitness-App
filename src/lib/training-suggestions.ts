import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { contextSuggestion, type TrainingContext } from "./training-context";
const input = z.object({ memberId: z.string().uuid(), slot: z.string().min(1).max(100) });

// Postgres authorizes this RPC for the member/current coach through RLS.
// Recommendations are pure calculations and require no privileged app server.
export async function getTrainingSuggestion({ data }: { data: z.input<typeof input> }) {
  const parsed = input.parse(data);
  const auth = await supabase.auth.getUser();
  if (auth.error || !auth.data.user) throw new Error("Sign in to refresh training targets.");
  const result = await supabase.rpc("get_training_context", {
    _member: parsed.memberId,
    _slot: parsed.slot,
  });
  if (result.error) throw new Error(result.error.message);
  if (!result.data) return null;
  const context = result.data as TrainingContext;
  return { context, suggestion: contextSuggestion(context) };
}
