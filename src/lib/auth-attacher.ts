import { createMiddleware } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";

// Adds the signed-in user's token to every server function call.
export const attachSupabaseAuth = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return next({ headers: token ? { Authorization: `Bearer ${token}` } : {} });
  },
);
