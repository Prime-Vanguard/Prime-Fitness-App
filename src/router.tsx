import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { initSentry, reportError } from "./lib/sentry";

// Runs in the browser and during SSR; a no-op unless VITE_SENTRY_DSN is set.
initSentry();

export const getRouter = () => {
  // Each router gets its own cache; the base path also supports GitHub Pages.
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    basepath: import.meta.env.BASE_URL,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    // Errors caught by route boundaries never reach the global handlers.
    defaultOnCatch: (error) => reportError(error, { area: "route" }),
  });

  return router;
};
