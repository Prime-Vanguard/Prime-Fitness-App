import { afterEach, expect, it, vi } from "vitest";
import { appPath, stripAppBase } from "./app-path";
import { confirmationUrl, safeAuthRedirect } from "./auth-flow";

afterEach(() => vi.unstubAllEnvs());
it("keeps assets and email callbacks inside a project site", () => {
  vi.stubEnv("BASE_URL", "/Prime-Fitness-App/");
  expect(appPath("/data/exercise-visuals.json")).toBe(
    "/Prime-Fitness-App/data/exercise-visuals.json",
  );
  expect(confirmationUrl("https://prime-vanguard.github.io", "/progress?tab=photos")).toBe(
    "https://prime-vanguard.github.io/Prime-Fitness-App/auth?redirect=%2Fprogress%3Ftab%3Dphotos",
  );
  expect(safeAuthRedirect("/Prime-Fitness-App/progress?tab=photos")).toBe("/progress?tab=photos");
  expect(safeAuthRedirect("/Prime-Fitness-App/auth")).toBe("/today");
  expect(safeAuthRedirect("//evil.example")).toBe("/today");
  expect(stripAppBase("/another-app/train")).toBe("/another-app/train");
});
it("preserves root-hosted behavior", () => {
  vi.stubEnv("BASE_URL", "/");
  expect(appPath("train")).toBe("/train");
  expect(safeAuthRedirect("/progress")).toBe("/progress");
});
