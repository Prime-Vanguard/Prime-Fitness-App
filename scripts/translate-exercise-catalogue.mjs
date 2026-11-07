// One-time public-text preparation, never invoked by builds or member requests.
// This public endpoint has no stability guarantee; checkpoints make failures resumable.
// These translations remain drafts until human review.
import { readFile, writeFile, mkdir } from "node:fs/promises";
const reference = JSON.parse(await readFile("public/data/exercise-reference.json", "utf8"));
await mkdir("artifacts/catalogue-translator", { recursive: true });
const checkpoint = "artifacts/catalogue-translator/google-drafts.json";
let translated = {};
try {
  translated = JSON.parse(await readFile(checkpoint, "utf8"));
} catch (e) {
  if (e.code !== "ENOENT") throw e;
}
const texts = [...new Set(reference.exercises.flatMap((e) => [e.name, ...e.steps_en]))];
const pending = texts.filter((t) => !translated[t]);
async function request(batch) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const params = new URLSearchParams({
      client: "gtx",
      sl: "en",
      tl: "ar",
      dt: "t",
      q: batch.join("\n"),
    });
    const response = await fetch(`https://translate.googleapis.com/translate_a/single?${params}`, {
      signal: AbortSignal.timeout(45000),
    });
    if (response.status === 429 || response.status >= 500) {
      await new Promise((r) => setTimeout(r, 5000 * (attempt + 1)));
      continue;
    }
    if (!response.ok) throw new Error(`Translation HTTP ${response.status}`);
    const data = await response.json();
    const lines = data[0]
      .map((part) => part[0] ?? "")
      .join("")
      .split("\n")
      .map((t) => t.trim());
    if (lines.length !== batch.length || lines.some((t) => !t)) {
      if (batch.length === 1) throw new Error("Translation line alignment failed");
      const middle = Math.ceil(batch.length / 2);
      return [...(await request(batch.slice(0, middle))), ...(await request(batch.slice(middle)))];
    }
    return lines;
  }
  throw new Error("Translation service unavailable; rerun to resume the checkpoint");
}
console.log(`Preparing ${pending.length}/${texts.length} public-text Arabic drafts`);
for (let i = 0; i < pending.length;) {
  const batch = [];
  let chars = 0;
  while (i < pending.length && chars + pending[i].length < 3000) {
    const t = pending[i++];
    batch.push(t);
    chars += t.length + 1;
  }
  if (!batch.length) batch.push(pending[i++]);
  const result = await request(batch);
  batch.forEach((t, n) => (translated[t] = result[n]));
  await writeFile(checkpoint, JSON.stringify(translated));
  console.log(`Translated ${Object.keys(translated).length}/${texts.length}`);
  await new Promise((r) => setTimeout(r, 350));
}
const exercises = reference.exercises.map((e) => ({
  id: e.id,
  name_ar: translated[e.name],
  steps_ar: e.steps_en.map((t) => translated[t]),
}));
const corrections = JSON.parse(
  await readFile("scripts/data/exercise-arabic-corrections.json", "utf8"),
);
for (const row of exercises) {
  const correction = corrections[row.id];
  if (correction?.name_ar) row.name_ar = correction.name_ar;
  for (const [index, value] of Object.entries(correction?.steps ?? {}))
    row.steps_ar[Number(index)] = value;
}
await writeFile(
  "public/data/exercise-arabic.json",
  JSON.stringify({
    revision: reference.revision,
    translation: {
      provider: "Google Translate public-text preparation",
      language: "ar",
      status: "machine_draft",
      prepared_on: "2026-11-07",
    },
    exercises,
  }) + "\n",
);
console.log(`Prepared ${exercises.length} Arabic exercise drafts`);
