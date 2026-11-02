import { chromium } from "@playwright/test";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

// Export only: resize/encode the approved transparent artwork without redrawing
// it or changing colors/backgrounds. Sources and edit prompts remain in design/.
const ranks = ["recruit", "seeker", "forged", "guardian", "vanguard", "prime-legend"];
const out = new URL("../src/assets/ranks/", import.meta.url);
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage();
  let total = 0;
  for (const rank of ranks) {
    const source = await readFile(
      new URL(`../design/rank-emblems/source/${rank}.png`, import.meta.url),
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
          const pixels = ctx.getImageData(0, 0, size, size).data;
          const corners = [0, size - 1, size * (size - 1), size * size - 1].map(
            (i) => pixels[i * 4 + 3],
          );
          if (corners.some((alpha) => alpha !== 0))
            throw new Error("Artwork needs transparent corners");
          let visible = 0;
          for (let i = 3; i < pixels.length; i += 4) if (pixels[i] > 128) visible++;
          if (visible < size * size * 0.1 || visible > size * size * 0.95)
            throw new Error("Invalid emblem silhouette or background");
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
      await writeFile(new URL(`${rank}-${size}.webp`, out), Buffer.from(bytes));
      total += bytes.length;
    }
    console.log(`${rank}: transparent exports at 128, 256 and 512px`);
  }
  console.log(`18 WebP assets: ${(total / 1024).toFixed(1)} KiB total`);
  const names = ["Recruit", "Seeker", "Forged", "Guardian", "Vanguard", "Prime Legend"];
  const html = `<!doctype html><html lang="en"><meta charset="utf-8"><title>Prime Vanguard rank emblems</title><style>
  *{box-sizing:border-box}body{margin:0;padding:36px;background:#0f172a;color:#f1f5f9;font-family:Arial,sans-serif}h1{text-align:center;color:#d4af37;letter-spacing:4px;margin:0}header p{text-align:center;color:#94a3b8}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:28px}.card{background:linear-gradient(140deg,#1e293b,#101a2b);border:1px solid #d4af3740;border-radius:20px;text-align:center;padding:20px}.hero{width:100%;height:275px;object-fit:contain}.small{display:flex;align-items:center;justify-content:center;gap:20px}.small img{object-fit:contain}h2{color:#e3c875;letter-spacing:2px;font-size:20px}.sizes{color:#94a3b8;font-size:12px}footer{text-align:center;margin-top:24px;color:#94a3b8;font-size:13px}
  </style><header><h1>PRIME VANGUARD</h1><p>Approved base emblems · transparent production exports</p></header><div class="grid">${ranks.map((rank, i) => `<section class="card"><img class="hero" src="../../src/assets/ranks/${rank}-512.webp" alt="${names[i]}"><h2>${names[i].toUpperCase()}</h2><div class="small"><img width="40" height="40" src="../../src/assets/ranks/${rank}-128.webp" alt=""><img width="64" height="64" src="../../src/assets/ranks/${rank}-256.webp" alt=""></div><p class="sizes">40px / 64px display previews</p></section>`).join("")}</div><footer>128px · 256px · 512px assets · Rank names and level thresholds preserved</footer></html>`;
  await writeFile(new URL("../design/rank-emblems/preview.html", import.meta.url), html);
  await page.setViewportSize({ width: 1250, height: 1100 });
  await page.goto(new URL("../design/rank-emblems/preview.html", import.meta.url).href);
  await page.evaluate(() => Promise.all([...document.images].map((image) => image.decode())));
  await page.screenshot({
    path: fileURLToPath(new URL("../design/rank-emblems/production-preview.png", import.meta.url)),
    fullPage: true,
  });
} finally {
  await browser.close();
}
