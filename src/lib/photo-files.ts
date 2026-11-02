// Backup bytes are opaque image data, never HTML or inline SVG markup.
export const isImageMime = (mime: string) => /^image\/[a-z0-9.+-]+$/i.test(mime);
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

export async function normalizePhoto(file: File): Promise<Blob> {
  if (!isImageMime(file.type) || /svg/i.test(file.type))
    throw new Error("Choose a bitmap photo such as JPEG, PNG or WebP.");
  if (file.size > MAX_PHOTO_BYTES) throw new Error("Choose a photo smaller than 10 MB.");
  let image: ImageBitmap;
  try {
    image = await createImageBitmap(file);
  } catch {
    throw new Error("This photo format cannot be decoded here. Convert it to JPEG or PNG first.");
  }
  try {
    if (!image.width || !image.height || image.width * image.height > 64000000)
      throw new Error("This image is too large to process. Choose a smaller photo.");
    const scale = Math.min(1, 2048 / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Photo processing is unavailable in this browser.");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (result) => (result ? resolve(result) : reject(new Error("Photo conversion failed."))),
        "image/jpeg",
        0.88,
      ),
    );
    if (blob.size > MAX_PHOTO_BYTES) throw new Error("Converted photo exceeds 10 MB.");
    return blob;
  } finally {
    image.close();
  }
}
