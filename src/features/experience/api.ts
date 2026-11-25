import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { SyncRequestError } from "@/lib/queued-sync-access";
type FeatureMethod = "social_action" | "save_cardio_log" | "get_cardio_history";
// One typed RPC boundary; validate backend JSON before it enters feature state.
export async function featureCall<N extends FeatureMethod, T>(
  name: N,
  args: Database["public"]["Functions"][N]["Args"],
  parse: (data: unknown) => T,
  authorization?: string,
): Promise<T> {
  const request = supabase.rpc(name, args);
  if (authorization) request.setHeader("Authorization", authorization);
  const { data, error, status } = await request.abortSignal(AbortSignal.timeout(15000));
  if (error) throw new SyncRequestError(error, status);
  return parse(data);
}
