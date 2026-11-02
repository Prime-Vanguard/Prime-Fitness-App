import { beforeEach, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: vi.fn(), storage: { from: vi.fn() } },
}));
import { supabase } from "@/integrations/supabase/client";
import { loadPhotoPage, signHistoryPhotos } from "./photo-history";
beforeEach(() => vi.resetAllMocks());
it("overfetches metadata by one for paging and never signs the hidden lookahead", async () => {
  const rows = Array.from({ length: 31 }, (_, i) => ({ id: String(i), path: `owner/${i}.jpg` }));
  const query = {
    retry: vi.fn().mockReturnThis(),
    abortSignal: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockResolvedValue({ data: rows, error: null }),
  };
  vi.mocked(supabase.from).mockReturnValue(query as never);
  const page = await loadPhotoPage("owner", {
    page: 1,
    pose: "front",
    from: "2026-01-01",
    to: "2026-10-28",
  });
  expect(query.range).toHaveBeenCalledWith(30, 60);
  expect(query.order).toHaveBeenCalledWith("id", { ascending: false });
  expect(page.photos).toHaveLength(30);
  expect(page.hasOlder).toBe(true);
  expect(supabase.storage.from).not.toHaveBeenCalled();
});
it("maps signed URLs by path rather than response position and preserves missing-file errors", async () => {
  const sign = vi
    .fn()
    .mockResolvedValue({ data: [{ path: "owner/b.jpg", signedUrl: "url-b" }], error: null });
  vi.mocked(supabase.storage.from).mockReturnValue({ createSignedUrls: sign } as never);
  const photos = await signHistoryPhotos([
    { id: "a", path: "owner/a.jpg" },
    { id: "b", path: "owner/b.jpg" },
  ] as never);
  expect(photos.map((p) => p.url)).toEqual([null, "url-b"]);
  expect(sign).toHaveBeenCalledWith(["owner/a.jpg", "owner/b.jpg"], 3600);
});
it("surfaces signing failures for persistent retry UI", async () => {
  vi.mocked(supabase.storage.from).mockReturnValue({
    createSignedUrls: vi.fn().mockResolvedValue({ data: null, error: new Error("Signing failed") }),
  } as never);
  await expect(signHistoryPhotos([{ path: "owner/a.jpg" }] as never)).rejects.toThrow(
    "Signing failed",
  );
});
