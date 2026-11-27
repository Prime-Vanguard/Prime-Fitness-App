import { RouteFallback } from "@/components/route-fallback";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { sessionCacheBoundary } from "@/lib/auth-session-cache";
import { watchOfflineReauthentication } from "@/lib/offline-access";
import { safeAuthRedirect } from "@/lib/auth-flow";
import { appPath, stripAppBase } from "@/lib/app-path";
import { setSentryMember } from "@/lib/sentry";

import appCss from "../styles.css?url";
import { PwaRegistration } from "@/components/pwa-registration";
import { supabase } from "@/integrations/supabase/client";
import { Toaster } from "@/components/ui/sonner";
import { I18nProvider } from "@/lib/i18n";

// Root fallbacks remain localized even when the normal provider tree cannot mount.
function NotFoundComponent() {
  return <RouteFallback />;
}
function ErrorComponent({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <RouteFallback
      retry={() => {
        void router.invalidate();
        reset();
      }}
    />
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#0F172A" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "Prime Fitness" },
      { title: "Prime Fitness — Prime Vanguard" },
      {
        name: "description",
        content: "Invite-only training, nutrition and accountability for Prime Vanguard members.",
      },
      { property: "og:title", content: "Prime Fitness — Prime Vanguard" },
      {
        property: "og:description",
        content: "Invite-only training, nutrition and accountability for Prime Vanguard members.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "manifest", href: appPath("manifest.webmanifest") },
      { rel: "apple-touch-icon", href: appPath("apple-touch-icon.png") },
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", type: "image/png", href: appPath("favicon.png") },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  // Arabic is the default locale; I18nProvider updates both after a saved choice loads.
  return (
    <html lang="ar" dir="rtl" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

// Own the shared providers and reset member views when the auth identity changes.
function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  const [sessionView, setSessionView] = useState(0);

  useEffect(() => {
    const boundary = sessionCacheBoundary(queryClient, () => setSessionView((value) => value + 1));
    const refresh = (signedOut: boolean) => {
      if (signedOut && /^\/auth\/?$/.test(stripAppBase(router.state.location.pathname))) return;
      if (signedOut)
        void router.navigate({
          to: "/auth",
          search: { redirect: safeAuthRedirect(router.state.location.href) },
          replace: true,
        });
      else void router.invalidate();
    };
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      // The opaque member id lets one member's repeat errors be grouped; no email or name.
      setSentryMember(session?.user?.id ?? null);
      const reset = boundary(event, session);
      if (!reset && event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED")
        return;
      refresh(event === "SIGNED_OUT");
    });
    // SDK notifications can be delayed in background tabs. Storage changes are
    // another UI invalidation signal, never an authorization decision.
    const key = `sb-${new URL(import.meta.env["VITE_SUPABASE_URL"]).hostname.split(".")[0]}-auth-token`;
    const changed = (event: StorageEvent) => {
      if (event.key !== key && event.key !== null) return;
      try {
        const value = event.newValue ? JSON.parse(event.newValue) : null;
        if (value && typeof value.user?.id !== "string") throw new Error("Invalid session");
        if (boundary(value ? "INITIAL_SESSION" : "SIGNED_OUT", value)) refresh(!value);
      } catch {
        boundary("SIGNED_OUT", null);
        refresh(true);
      }
    };
    window.addEventListener("storage", changed);
    const stopReauthentication = watchOfflineReauthentication(() => {
      if (router.state.matches.some((match) => match.routeId === "/_authenticated")) {
        boundary("SIGNED_OUT", null);
        refresh(true);
      }
    });
    return () => {
      data.subscription.unsubscribe();
      window.removeEventListener("storage", changed);
      stopReauthentication();
    };
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
        <Outlet key={sessionView} />
        {/* Leave mobile header controls reachable while success feedback is visible. */}
        <Toaster
          theme="dark"
          position="top-center"
          mobileOffset={{ top: "calc(env(safe-area-inset-top, 0px) + 5rem)", left: 16, right: 16 }}
        />
        <PwaRegistration />
      </I18nProvider>
    </QueryClientProvider>
  );
}
