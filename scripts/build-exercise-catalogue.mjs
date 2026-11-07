import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { catalogueRow, catalogueChunkSql } from "./lib/exercise-catalogue.mjs";
const reference = JSON.parse(await readFile("public/data/exercise-reference.json", "utf8"));
const arabic = JSON.parse(await readFile("public/data/exercise-arabic.json", "utf8"));
const visuals = JSON.parse(await readFile("public/data/exercise-visuals.json", "utf8"));
if (reference.revision !== arabic.revision || reference.revision !== visuals.revision)
  throw new Error("Catalogue revision mismatch");
if (
  reference.exercises.length !== 1324 ||
  arabic.exercises.length !== 1324 ||
  visuals.exercises.length !== 1324
)
  throw new Error("Catalogue coverage changed");
const a = new Map(arabic.exercises.map((r) => [r.id, r])),
  v = new Map(visuals.exercises.map((r) => [r.id, r]));
if (a.size !== 1324 || v.size !== 1324) throw new Error("Duplicate source IDs");
const rows = reference.exercises.map((r) =>
  catalogueRow(r, a.get(r.id), reference.revision, arabic.translation, v.get(r.id)),
);
const dir = "supabase/catalogue";
await mkdir(dir, { recursive: true });
const count = Math.ceil(rows.length / 50);
const expected = Array.from(
  { length: count },
  (_, n) => `catalogue-${String(n + 1).padStart(2, "0")}.sql`,
);
if ((await readdir(dir)).some((f) => f.endsWith(".sql") && !expected.includes(f)))
  throw new Error("Stale catalogue chunks require review");
for (let i = 0; i < count; i++)
  await writeFile(`${dir}/${expected[i]}`, catalogueChunkSql(rows.slice(i * 50, (i + 1) * 50)));
const report = {
  revision: reference.revision,
  exercises: rows.length,
  cardio: rows.filter((r) => r.guidance.catalogue_kind === "cardio").length,
  chunks: count,
  utf8_json_bytes: Buffer.byteLength(JSON.stringify(rows)),
  arabic_status: arabic.translation.status,
  media_storage_bytes: 0,
};
await writeFile(`${dir}/manifest.json`, JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
