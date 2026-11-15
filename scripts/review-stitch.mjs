// Build an offline review artifact from sanitized, matched-frame Playwright captures.
// Do not assign a pixel-parity score: record counts, text and missing assets differ.
import { readFile, writeFile, readdir, mkdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";

const output = resolve("artifacts/stitch-comparison");
const sources = resolve("design/stitch_prime_fitness_tracker_app");
const cases = JSON.parse(await readFile(join(output, "after/manifest.json"), "utf8"));
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char],
  );
const dimensions = (buffer) => ({
  width: buffer.readUInt32BE(16),
  height: buffer.readUInt32BE(20),
});
const png = async (path) => {
  const bytes = await readFile(path);
  return { ...dimensions(bytes), uri: `data:image/png;base64,${bytes.toString("base64")}` };
};
const panels = [];
for (const entry of cases) {
  const source = await png(join(sources, entry.reference, "screen.png"));
  // Member refinement uses the corrected scheduled-program baseline; retain the
  // original checkpoint separately instead of claiming a different-state delta.
  const before = await png(join(output, entry.baselineStage ?? "before", `${entry.key}.png`));
  const after = await png(join(output, "after", `${entry.key}.png`));
  if (
    [before, after].some(
      (image) =>
        image.width !== source.width ||
        Math.abs(image.height - source.height) > (entry.rasterHeightTolerance ?? 0),
    )
  )
    throw new Error(`${entry.key}: capture dimensions do not match the reference PNG.`);
  panels.push({ ...entry, source, before, after });
}
const inventory = [];
for (const entry of await readdir(sources, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  try {
    const bytes = await readFile(join(sources, entry.name, "screen.png"));
    inventory.push({
      reference: entry.name,
      ...dimensions(bytes),
      status: cases.some((item) => item.reference === entry.name)
        ? "Compared; acceptance open"
        : "Pending controlled comparison",
    });
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}
await mkdir(output, { recursive: true });
await writeFile(join(output, "inventory.json"), JSON.stringify(inventory, null, 2));
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Prime Fitness — Stitch comparison</title>
<style>body{margin:0;background:#0b1326;color:#f1f5f9;font:15px/1.5 system-ui,sans-serif}main{max-width:1500px;margin:auto;padding:24px}h1,h2{line-height:1.2}a{color:#d4af37}section{padding:24px 0;border-top:1px solid #334155}.note{color:#94a3b8}label{display:inline-flex;align-items:center;gap:12px;margin:12px 16px 12px 0}button,select{min-height:44px;padding:8px;background:#223047;color:inherit;border:1px solid #334155;border-radius:8px}.triptych{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}figure{margin:0;min-width:0;background:#0f172a}figcaption{padding:12px;color:#d4af37}img{display:block;width:100%;height:auto}.overlay{position:relative;max-width:900px;background:#0f172a}.overlay img+img{position:absolute;inset:0;opacity:.5}.overlay[hidden]{display:none}input{min-height:44px}@media(max-width:700px){main{padding:16px}.triptych{grid-template-columns:1fr}}</style>
<main><h1>Stitch / baseline / updated application</h1><p>${panels.length} controlled frames. Synthetic data only. No screen is marked visually accepted.</p><p class="note">Original PNGs are the reference. Roster export scale is inferred from its fixed sidebar anchor; review-queue export scale is inferred from its sidebar and toolbar anchors. Content, unsupported mockup features and missing media affect comparisons. This report is not a global pixel-diff pass.</p>
${panels.map((entry) => `<section data-review="${escape(entry.key)}"><h2>${escape(entry.key)}</h2><p>${escape(entry.reference)} · ${entry.source.width} × ${entry.source.height} output pixels · CSS ${entry.width} × ${entry.height} at ${entry.scale} DPR</p><p class="note">${escape(entry.calibration)}</p><div class="triptych">${["source", "before", "after"].map((stage) => `<figure><figcaption>${stage === "source" ? "Stitch reference" : stage === "before" ? (entry.baselineComparable === false ? "Earlier capture - different state" : "Application baseline") : "Updated application"}</figcaption><img alt="${escape(entry.key)} ${stage}" src="${entry[stage].uri}"></figure>`).join("")}</div><label><input type="checkbox" data-toggle>Show reference overlay</label><label>Updated-screen opacity<input type="range" min="0" max="1" step=".05" value=".5" data-opacity></label><div class="overlay" style="max-width:${Math.min(900, entry.source.width)}px" hidden><img alt="Reference layer" src="${entry.source.uri}"><img alt="Updated layer" src="${entry.after.uri}"></div></section>`).join("")}
<h2>Remaining exports</h2><p>${inventory.length} PNG references inventoried; ${panels.length} compared in this checkpoint. Other routes/states remain pending.</p></main>
<script>document.querySelectorAll('section').forEach(section=>{const overlay=section.querySelector('.overlay');section.querySelector('[data-toggle]').addEventListener('change',e=>overlay.hidden=!e.target.checked);section.querySelector('[data-opacity]').addEventListener('input',e=>overlay.lastElementChild.style.opacity=e.target.value)})</script></html>`;
await writeFile(join(output, "review.html"), html);

// Contact sheets are inspection aids; the HTML preserves full-resolution images and overlays.
const browser = await chromium.launch({ channel: "chrome" });
try {
  const page = await browser.newPage({
    viewport: { width: 1500, height: 1000 },
    deviceScaleFactor: 1,
  });
  await page.goto(pathToFileURL(join(output, "review.html")).href);
  await page.evaluate(() => Promise.all([...document.images].map((image) => image.decode())));
  for (const entry of cases) {
    const panel = page.locator(`[data-review="${entry.key}"]`);
    await panel.screenshot({ path: join(output, `${entry.key}-comparison.png`) });
    await panel.locator("[data-toggle]").check();
    await panel.locator(".overlay").screenshot({ path: join(output, `${entry.key}-overlay.png`) });
    await panel.locator("[data-toggle]").uncheck();
  }
} finally {
  await browser.close();
}
console.log(
  `Created ${panels.length} matched-frame comparisons and ${inventory.length}-reference inventory: artifacts/stitch-comparison/review.html`,
);
