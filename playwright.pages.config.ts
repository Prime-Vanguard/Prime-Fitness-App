import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  testMatch: "pages-hosting.spec.ts",
  timeout: 45000,
  forbidOnly: !!process.env["CI"],
  workers: 1,
  use: {
    ...devices["Pixel 7"],
    channel: "chrome",
    baseURL: process.env["PW_PAGES_BASE_URL"] ?? "http://127.0.0.1:3174",
    trace: "retain-on-failure",
  },
  webServer: process.env["PW_EXTERNAL_SERVER"]
    ? undefined
    : {
        command: "node scripts/serve-pages.mjs",
        url: "http://127.0.0.1:3174/Prime-Fitness-App/",
        reuseExistingServer: false,
        timeout: 30000,
      },
});
