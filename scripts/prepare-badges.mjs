import { chromium } from "@playwright/test";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

// Export only: resize/encode the approved badge artwork (design/Prime-Fitness-Badges)
// to 128/256/512 WebP. Near-opaque pixels (alpha >= 224) become fully opaque because
// the generated sources are ~1-12% see-through; soft edges and glows are kept.
const codes = [
  "first_workout",
  "first_food",
  "first_body",
  "first_pv",
  "workouts_10",
  "food_30",
  "workouts_50",
  "workouts_100",
];
const out = new URL("../src/assets/badges/", import.meta.url);
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage();
  let total = 0;
  for (const code of codes) {
    const source = await readFile(
      new URL(`../design/Prime-Fitness-Badges/${code}.png`, import.meta.url),
    );
    const results = await page.evaluate(
      async (src) => {
        const image = new Image();
        image.src = src;
        await image.decode();
        const result = [];
        for (const size of [128, 256, 512]) {
          const canvas = document.createElement("canvas");
          canvas.width = canvas.height = size;
          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("Canvas unavailable");
          ctx.imageSmoothingQuality = "high";
          const scale = size / Math.max(image.width, image.height);
          ctx.drawImage(
            image,
            (size - image.width * scale) / 2,
            (size - image.height * scale) / 2,
            image.width * scale,
            image.height * scale,
          );
          const frame = ctx.getImageData(0, 0, size, size);
          const pixels = frame.data;
          for (let i = 3; i < pixels.length; i += 4) if (pixels[i] >= 224) pixels[i] = 255;
          ctx.putImageData(frame, 0, 0);
          const corners = [0, size - 1, size * (size - 1), size * size - 1].map(
            (i) => pixels[i * 4 + 3],
          );
          if (corners.some((alpha) => alpha !== 0))
            throw new Error("Artwork needs transparent corners");
          let visible = 0;
          for (let i = 3; i < pixels.length; i += 4) if (pixels[i] > 128) visible++;
          if (visible < size * size * 0.1 || visible > size * size * 0.95)
            throw new Error("Invalid badge silhouette or background");
          const blob = await new Promise((resolve, reject) =>
            canvas.toBlob(
              (b) => (b ? resolve(b) : reject(new Error("WebP export failed"))),
              "image/webp",
              size === 512 ? 0.9 : 0.88,
            ),
          );
          if (blob.type !== "image/webp") throw new Error("WebP encoding unavailable");
          result.push({ size, bytes: Array.from(new Uint8Array(await blob.arrayBuffer())) });
        }
        return result;
      },
      `data:image/png;base64,${source.toString("base64")}`,
    );
    for (const { size, bytes } of results) {
      await writeFile(new URL(`${code}-${size}.webp`, out), Buffer.from(bytes));
      total += bytes.length;
    }
    console.log(`${code}: transparent exports at 128, 256 and 512px`);
  }
  console.log(`${codes.length * 3} WebP assets: ${(total / 1024).toFixed(1)} KiB total`);
  const html = `<!doctype html><html lang="en"><meta charset="utf-8"><title>Prime Fitness badges</title><style>
  body{margin:0;padding:32px;background:#0f172a;color:#f1f5f9;font-family:Arial,sans-serif}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}.card{background:#1e293b;border-radius:16px;text-align:center;padding:16px}.hero{width:100%;height:220px;object-fit:contain}.small{display:flex;justify-content:center;gap:16px;align-items:center}p{margin:8px 0 0;color:#94a3b8;font-size:12px}
  </style><div class="grid">${codes.map((code) => `<section class="card"><img class="hero" src="../../src/assets/badges/${code}-512.webp" alt=""><div class="small"><img width="44" height="44" src="../../src/assets/badges/${code}-128.webp" alt=""><img width="72" height="72" src="../../src/assets/badges/${code}-256.webp" alt=""></div><p>${code}</p></section>`).join("")}</div></html>`;
  await writeFile(new URL("../design/Prime-Fitness-Badges/preview.html", import.meta.url), html);
  await page.setViewportSize({ width: 1200, height: 900 });
  await page.goto(new URL("../design/Prime-Fitness-Badges/preview.html", import.meta.url).href);
  await page.evaluate(() => Promise.all([...document.images].map((image) => image.decode())));
  await page.screenshot({
    path: fileURLToPath(
      new URL("../design/Prime-Fitness-Badges/production-preview.png", import.meta.url),
    ),
    fullPage: true,
  });
} finally {
  await browser.close();
}
