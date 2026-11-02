import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";
if (!import.meta.env["VITE_SUPABASE_URL"])
  vi.stubEnv("VITE_SUPABASE_URL", "https://fitness-test.supabase.co");

Object.defineProperty(window, "scrollTo", {
  writable: true,
  value: () => {},
});

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});
