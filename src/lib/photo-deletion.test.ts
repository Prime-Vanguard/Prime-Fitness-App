import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: vi.fn(), storage: { from: vi.fn() } },
}));
import { supabase } from "@/integrations/supabase/client";
import { deleteProgressPhoto } from "./photo-deletion";
const photo = { id: "photo-id", member_id: "member-id", path: "member-id/photo.jpg" };
beforeEach(() => vi.resetAllMocks());
function backend(storageError: unknown, metadataError: unknown = null) {
  const calls: string[] = [];
  const upsert = vi.fn(async () => {
    calls.push("queue");
    return { error: null };
  });
  const remove = vi.fn(async () => {
    calls.push("storage");
    return { error: storageError };
  });
  const eq = vi.fn().mockReturnThis();
  const query = { eq, error: metadataError };
  eq.mockReturnValue(query);
  const del = vi.fn(() => {
    calls.push("metadata");
    return query;
  });
  vi.mocked(supabase.from).mockImplementation(
    (table: string) =>
      ({ upsert, ...(table === "progress_photos" ? { delete: del } : {}) }) as never,
  );
  vi.mocked(supabase.storage.from).mockReturnValue({ remove } as never);
  return { calls, del, remove, upsert };
}
describe("retryable photo removal", () => {
  it("keeps metadata when Storage removal fails", async () => {
    const failure = { message: "Offline" };
    const state = backend(failure);
    await expect(deleteProgressPhoto(photo)).rejects.toBe(failure);
    expect(state.calls).toEqual(["queue", "storage"]);
    expect(state.del).not.toHaveBeenCalled();
  });
  it("surfaces metadata failures after Storage deletion so the queue can be retried", async () => {
    const failure = { message: "Metadata offline" };
    const state = backend(null, failure);
    await expect(deleteProgressPhoto(photo)).rejects.toBe(failure);
    expect(state.calls).toEqual(["queue", "storage", "metadata"]);
  });
  it("removes in order, using a stable queue identity, including when the file is already absent", async () => {
    const state = backend(null);
    await deleteProgressPhoto(photo);
    expect(state.calls).toEqual(["queue", "storage", "metadata"]);
    expect(state.upsert).toHaveBeenCalledWith(
      { photo_id: photo.id, member_id: photo.member_id, path: photo.path },
      { onConflict: "photo_id", ignoreDuplicates: true },
    );
  });
});
