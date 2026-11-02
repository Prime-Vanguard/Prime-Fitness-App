// Deliberately downloads JSON and legal text only; never images/ or videos/.
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
const repository = "hasaneyldrm/exercises-dataset";
const revision = "7455efae41b330c265e7cd4b78dfa848e7ce5ebd";
const base = `https://raw.githubusercontent.com/${repository}/${revision}`;
async function get(path) {
  const response = await fetch(`${base}/${path}`, { signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response.text();
}
const [raw, license, notice] = await Promise.all(
  ["data/exercises.json", "LICENSE", "NOTICE.md"].map(get),
);
if (
  !license.startsWith("MIT License") ||
  !license.includes("MEDIA EXCEPTION") ||
  !notice.includes("MIT License")
)
  throw new Error("License changed; review before vendoring.");
const seen = new Set(),
  previews = [];
const exercises = JSON.parse(raw).map((row) => {
  if (!/^\d{4}$/.test(row.id) || seen.has(row.id))
    throw new Error("Invalid or duplicate source ID");
  seen.add(row.id);
  const text = (key) => {
    if (typeof row[key] !== "string" || !row[key].trim())
      throw new Error(`Missing ${key}: ${row.id}`);
    return row[key].trim();
  };
  const steps = row.instruction_steps?.en;
  if (
    !/^images\/[\w-]+\.(jpg|jpeg|png)$/.test(row.image) ||
    !/^videos\/[\w-]+\.gif$/.test(row.gif_url)
  )
    throw new Error(`Invalid media reference: ${row.id}`);
  previews.push({ id: row.id, image: row.image, gif: row.gif_url });
  if (
    !Array.isArray(steps) ||
    !steps.length ||
    steps.some((s) => typeof s !== "string" || !s.trim())
  )
    throw new Error(`Missing English steps: ${row.id}`);
  if (
    !Array.isArray(row.secondary_muscles) ||
    row.secondary_muscles.some((s) => typeof s !== "string")
  )
    throw new Error(`Invalid secondary muscles: ${row.id}`);
  // Explicit allowlist: media paths, media IDs and Gym Visual attribution never enter the app.
  return {
    id: row.id,
    name: text("name"),
    body_part: text("body_part"),
    equipment: text("equipment"),
    target: text("target"),
    secondary_muscles: row.secondary_muscles,
    steps_en: steps.map((s) => s.trim()),
  };
});
const output = {
  repository,
  revision,
  license: "MIT",
  source_sha256: createHash("sha256").update(raw).digest("hex"),
  exercises,
};
await Promise.all([
  mkdir("public/data", { recursive: true }),
  mkdir("public/legal", { recursive: true }),
]);
await Promise.all([
  writeFile("public/data/exercise-reference.json", JSON.stringify(output) + "\n"),
  writeFile(
    "public/data/exercise-media-preview.json",
    JSON.stringify({ revision, previews }) + "\n",
  ),
  writeFile("public/legal/exercise-dataset-LICENSE.txt", license),
  writeFile("public/legal/exercise-dataset-NOTICE.md", notice),
]);
console.log(
  `Vendored ${exercises.length} text references and separate media-preview paths at ${revision}; no image/GIF files downloaded.`,
);
await import("./build-exercise-visuals.mjs");
