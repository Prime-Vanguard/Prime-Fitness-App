import { defineConfig, devices } from "@playwright/test";
import base from "./playwright.config";

// Opt-in compatibility runs reuse the same synthetic fixtures and production server.
// Keep the normal Chrome/CI suite unchanged; browser packages can live in artifacts.
export default defineConfig({
  ...base,
  // These tests mock every API read. Block service workers so their network fetches
  // cannot bypass interception; installed-PWA/offline acceptance is a separate suite.
  use: { baseURL: "http://127.0.0.1:3173", trace: "retain-on-failure", serviceWorkers: "block" },
  projects: [
    { name: "desktop-firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "desktop-webkit", use: { ...devices["Desktop Safari"] } },
  ],
});
