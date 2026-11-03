import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { sessionCacheBoundary } from "@/lib/auth-session-cache";
import { safeAuthRedirect } from "@/lib/auth-flow";
import { appPath, stripAppBase } from "@/lib/app-path";

import appCss from "../styles.css?url";
import { PwaRegistration } from "@/components/pwa-registration";
import { supabase } from "@/integrations/supabase/client";
import { Toaster } from "@/components/ui/sonner";
import { I18nProvider } from "@/lib/i18n";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href={appPath("")}
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
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
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Manrope:wght@600;700;800&family=Tajawal:wght@400;500;700;800&display=swap",
      },
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
  return (
    <html lang="en" className="dark">
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
    return () => {
      data.subscription.unsubscribe();
      window.removeEventListener("storage", changed);
    };
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
        <Outlet key={sessionView} />
        <Toaster theme="dark" position="top-center" />
        <PwaRegistration />
      </I18nProvider>
    </QueryClientProvider>
  );
}
