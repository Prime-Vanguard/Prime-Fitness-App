import { defineConfig, loadEnv } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { sentryTanstackStart } from "@sentry/tanstackstart-react/vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { nitro } from "nitro/vite";
import { pwaAssets } from "./scripts/pwa-plugin";

export default defineConfig(({ command, mode }) => {
  const pages = mode === "pages";
  // Keep private backend variables in the development server environment.
  // Vite handles public VITE_* values without exposing server credentials.
  if (command === "serve") {
    const serverEnv = loadEnv(mode, process.cwd(), "SUPABASE_");
    for (const [key, value] of Object.entries(serverEnv)) {
      process.env[key] ??= value;
    }
  }

  // Source maps are uploaded only when a build has a Sentry auth token (CI secret, never VITE_).
  // The plugin uses hidden maps and deletes them after upload, so none are published or served.
  const sentryToken =
    process.env["SENTRY_AUTH_TOKEN"] ||
    loadEnv(mode, process.cwd(), "SENTRY_")["SENTRY_AUTH_TOKEN"];

  return {
    base: pages ? "/Prime-Fitness-App/" : "/",
    server: { port: 3000 },
    resolve: {
      dedupe: ["react", "react-dom", "@tanstack/react-query", "@tanstack/query-core"],
    },
    plugins: [
      pwaAssets(),
      tailwindcss(),
      tsconfigPaths({ projects: ["./tsconfig.json"] }),
      tanstackStart({
        ...(pages ? { spa: { enabled: true } } : {}),
        server: { entry: "server" },
        importProtection: {
          behavior: "error",
          client: { files: ["**/server/**"], specifiers: ["server-only"] },
        },
      }),
      ...(command === "build" && !pages ? [nitro({ preset: "node-server" })] : []),
      react(),
      // Must stay last. Prime Vanguard's Sentry organisation lives in the EU region.
      ...(command === "build" && sentryToken
        ? [
            sentryTanstackStart({
              org: "prime-vanguard",
              project: "prime-fitness-app",
              authToken: sentryToken,
              sentryUrl: "https://de.sentry.io",
              ...(process.env["VITE_SENTRY_RELEASE"]
                ? { release: { name: process.env["VITE_SENTRY_RELEASE"] } }
                : {}),
              autoInstrumentMiddleware: false,
              telemetry: false,
            }),
          ]
        : []),
    ],
  };
});
