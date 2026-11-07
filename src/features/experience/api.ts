import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
type FeatureMethod = "social_action" | "save_cardio_log" | "get_cardio_history";
// One typed RPC boundary; validate backend JSON before it enters feature state.
export async function featureCall<N extends FeatureMethod, T>(
  name: N,
  args: Database["public"]["Functions"][N]["Args"],
  parse: (data: unknown) => T,
): Promise<T> {
  const { data, error } = await supabase.rpc(name, args).abortSignal(AbortSignal.timeout(15000));
  if (error) throw new Error(error.message);
  return parse(data);
}
