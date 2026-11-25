import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { isAuthError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { safeAuthRedirect } from "@/lib/auth-flow";
import {
  withConnectionTimeout,
  readOfflineIdentity,
  saveOfflineIdentity,
  isTransientConnectionError,
  clearReauthentication,
  requireOfflineReauthentication,
  reauthenticationMemberId,
} from "@/lib/offline-access";
import { clearQueuedSyncDelay } from "@/lib/queued-sync-retry";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const signIn = () =>
      redirect({ to: "/auth", search: { redirect: safeAuthRedirect(location.href) } });
    const cachedIdentity = readOfflineIdentity();
    if (!navigator.onLine) {
      if (cachedIdentity) return { user: cachedIdentity };
      throw signIn();
    }
    try {
      const { data, error } = await withConnectionTimeout(supabase.auth.getUser());
      if (data.user) {
        if (reauthenticationMemberId() === data.user.id) clearQueuedSyncDelay(data.user.id);
        clearReauthentication();
        saveOfflineIdentity(data.user);
        return { user: data.user };
      }
      if (error) throw error;
    } catch (error) {
      // A network indicator can be true behind a captive portal or broken Wi-Fi.
      const retainedIdentity = readOfflineIdentity();
      if (retainedIdentity && isTransientConnectionError(error)) return { user: retainedIdentity };
      // Any other answer from the auth server (expired, missing or deleted session)
      // means this device must sign in again; only unexpected failures surface.
      if (!isAuthError(error)) throw error;
    }
    if (cachedIdentity) requireOfflineReauthentication(cachedIdentity.id);
    throw signIn();
  },
  component: () => <Outlet />,
});
