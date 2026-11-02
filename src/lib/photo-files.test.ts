import { afterEach, expect, it, vi } from "vitest";
import { normalizePhoto, MAX_PHOTO_BYTES } from "./photo-files";
afterEach(() => vi.unstubAllGlobals());
it.each(["text/html", "image/svg+xml"])(
  "rejects unsafe or non-photo input %s before decoding",
  async (type) => {
    const decode = vi.fn();
    vi.stubGlobal("createImageBitmap", decode);
    await expect(normalizePhoto(new File(["content"], "input", { type }))).rejects.toThrow(
      "bitmap photo",
    );
    expect(decode).not.toHaveBeenCalled();
  },
);
it("rejects oversized files before decoding", async () => {
  const decode = vi.fn();
  vi.stubGlobal("createImageBitmap", decode);
  const file = new File(["photo"], "photo.jpg", { type: "image/jpeg" });
  Object.defineProperty(file, "size", { value: MAX_PHOTO_BYTES + 1 });
  await expect(normalizePhoto(file)).rejects.toThrow("10 MB");
  expect(decode).not.toHaveBeenCalled();
});
it("explains unsupported legacy formats without uploading undecodable bytes", async () => {
  vi.stubGlobal("createImageBitmap", vi.fn().mockRejectedValue(new Error("Unsupported format")));
  await expect(
    normalizePhoto(new File(["undecodable"], "photo.heic", { type: "image/heic" })),
  ).rejects.toThrow("Convert it to JPEG or PNG");
});
it("releases a decoded image when dimensions are invalid", async () => {
  const close = vi.fn();
  vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue({ width: 0, height: 0, close }));
  await expect(
    normalizePhoto(new File(["photo"], "photo.jpg", { type: "image/jpeg" })),
  ).rejects.toThrow("too large");
  expect(close).toHaveBeenCalledOnce();
});
