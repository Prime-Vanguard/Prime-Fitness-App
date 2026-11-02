// Deterministic app-icon sizes from the existing brand logo, without redrawing it.
import { chromium } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage();
  const source = `data:image/png;base64,${(await readFile(new URL("../src/assets/logo.png", import.meta.url))).toString("base64")}`;
  for (const [size, name] of [
    [192, "icon-192.png"],
    [512, "icon-512.png"],
    [180, "apple-touch-icon.png"],
  ]) {
    const result = await page.evaluate(
      async ({ source, size }) => {
        const image = new Image();
        image.src = source;
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#0F172A";
        ctx.fillRect(0, 0, size, size);
        const margin = size * 0.1;
        ctx.drawImage(image, margin, margin, size - margin * 2, size - margin * 2);
        return canvas.toDataURL("image/png").split(",")[1];
      },
      { source, size },
    );
    await writeFile(new URL(`../public/${name}`, import.meta.url), Buffer.from(result, "base64"));
  }
} finally {
  await browser.close();
}
