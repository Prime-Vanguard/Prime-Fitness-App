import { describe, expect, it } from "vitest";
import { friendlyDay } from "./dates";

describe("friendlyDay", () => {
  it("names today and yesterday and falls back to the date", () => {
    expect(friendlyDay("2026-11-23", "en", "2026-11-23")).toBe("Today, 23 Nov");
    expect(friendlyDay("2026-11-22", "en", "2026-11-23")).toBe("Yesterday, 22 Nov");
    expect(friendlyDay("2026-11-01", "en", "2026-11-23")).toBe("1 Nov");
    expect(friendlyDay("2026-11-23", "ar", "2026-11-23")).toMatch(/^اليوم، 23 /);
  });
  it("reads timestamps in Cairo time", () => {
    expect(friendlyDay("2026-11-22T23:30:00Z", "en", "2026-11-23")).toBe("Today, 23 Nov");
  });
});
