import { expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: vi.fn() } }));
import { filterRoster, rosterSearch, rosterRouteSearch, loadRosterSummaries } from "./coach-roster";
it("validates roster URLs without requiring search parameters on existing links", () => {
  expect(rosterRouteSearch({})).toEqual({ q: undefined, scope: undefined, page: undefined });
  expect(rosterSearch({ page: -1, scope: "admin", q: 42 })).toEqual({
    q: "",
    scope: "all",
    page: 1,
  });
  expect(rosterSearch({ q: "a".repeat(200) }).q).toHaveLength(150);
});
it("combines normalized Arabic search and relationships before paging", () => {
  const rows = [
    { id: "b", display_name: "أحمد", email: "ahmed@test.invalid", coached: true, pod: false },
    { id: "a", display_name: null, email: "member@test.invalid", coached: false, pod: true },
  ];
  expect(filterRoster(rows, "احمد", "coached").map((row) => row.id)).toEqual(["b"]);
  expect(filterRoster(rows, "member@", "coached")).toEqual([]);
  expect(filterRoster(rows, "member@", "pod").map((row) => row.id)).toEqual(["a"]);
});
it("refuses unbounded roster-summary requests before making network reads", async () => {
  await expect(
    loadRosterSummaries(
      Array.from({ length: 21 }, (_, i) => String(i)),
      "2026-10-30",
      new AbortController().signal,
    ),
  ).rejects.toThrow("single displayed page");
});
