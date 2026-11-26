import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  testIgnore: "**/pages-hosting.spec.ts",
  timeout: 45000,
  fullyParallel: false,
  forbidOnly: !!process.env["CI"],
  // One CI retry for timing races on slow runners; retried passes are reported as flaky.
  retries: process.env["CI"] ? 1 : 0,
  workers: 1,
  use: { baseURL: "http://127.0.0.1:3173", channel: "chrome", trace: "retain-on-failure" },
  projects: [
    { name: "mobile-chromium", use: { ...devices["Pixel 7"], defaultBrowserType: "chromium" } },
  ],
  ...(process.env["PW_EXTERNAL_SERVER"]
    ? {}
    : {
        webServer: {
          command: "node --env-file-if-exists=.env .output/server/index.mjs",
          url: "http://127.0.0.1:3173",
          env: { PORT: "3173", HOST: "127.0.0.1" },
          reuseExistingServer: false,
          timeout: 30000,
        },
      }),
});
