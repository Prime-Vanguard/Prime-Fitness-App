import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { safeAuthRedirect } from "@/lib/auth-flow";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    // This offline gate unlocks only local UI; all server writes still use RLS.
    if (!navigator.onLine) {
      const { data: cached } = await supabase.auth.getSession();
      if (cached.session?.user) return { user: cached.session.user };
    }
    const { data } = await supabase.auth.getUser();
    if (!data.user)
      throw redirect({ to: "/auth", search: { redirect: safeAuthRedirect(location.href) } });
    return { user: data.user };
  },
  component: () => <Outlet />,
});
