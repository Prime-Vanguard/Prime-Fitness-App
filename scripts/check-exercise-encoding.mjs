import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { createTestDatabase } from "./test-database.mjs";
import { asciiJson, catalogueId } from "./lib/exercise-catalogue.mjs";
const arabic = JSON.parse(await readFile("public/data/exercise-arabic.json", "utf8"));
const corrupt = (s) => new TextDecoder("windows-1252").decode(Buffer.from(s, "utf8"));
const text = (s) => `('${asciiJson(s).replaceAll("'", "''")}'::jsonb #>> '{}')`;
for (const file of (await readdir("supabase/catalogue")).filter((f) => f.endsWith(".sql"))) {
  const raw = await readFile(`supabase/catalogue/${file}`);
  assert.ok(
    raw.every((byte) => byte < 128),
    `SQL must survive code-page changes: ${file}`,
  );
}
assert.equal(JSON.parse(asciiJson({ text: "العربية © · 45°" })).text, "العربية © · 45°");
const db = await createTestDatabase();
try {
  await db.exec(await readFile("supabase/catalogue/catalogue-01.sql", "utf8"));
  const id = catalogueId("0001"),
    good = arabic.exercises.find((e) => e.id === "0001");
  await db.exec(
    `UPDATE public.exercises SET name_ar=${text(corrupt(good.name_ar))},guidance=jsonb_set(jsonb_set(guidance,'{steps_ar}',to_jsonb(${text(corrupt(good.steps_ar.join("\n")))})),'{catalogue_media,attribution}',to_jsonb(${text(corrupt("© Gym Visual · gymvisual.com"))})) WHERE id='${id}'`,
  );
  const humanId = catalogueId("0002");
  await db.exec(
    `UPDATE public.exercises SET name_ar=${text("اسم المدرب")},guidance=jsonb_set(guidance,'{steps_ar}',to_jsonb(${text("شرح المدرب")})) WHERE id='${humanId}'`,
  );
  const sql = await readFile("artifacts/catalogue-encoding-repair/repair-01.sql", "utf8");
  const checked = sql.replace(
    /COMMIT;\s*$/,
    () => `DO $$ BEGIN
 IF (SELECT name_ar FROM public.exercises WHERE id='${id}') IS DISTINCT FROM ${text(good.name_ar)} THEN RAISE EXCEPTION 'Arabic name repair failed'; END IF;
 IF (SELECT guidance->>'steps_ar' FROM public.exercises WHERE id='${id}') IS DISTINCT FROM ${text(good.steps_ar.join("\n"))} THEN RAISE EXCEPTION 'Arabic instruction repair failed'; END IF;
 IF (SELECT guidance->'catalogue_media'->>'attribution' FROM public.exercises WHERE id='${id}') IS DISTINCT FROM ${text("© Gym Visual · gymvisual.com")} THEN RAISE EXCEPTION 'Attribution repair failed'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.exercises WHERE id='${humanId}' AND name_ar=${text("اسم المدرب")} AND guidance->>'steps_ar'=${text("شرح المدرب")}) THEN RAISE EXCEPTION 'Human edit changed'; END IF;
 END $$; COMMIT;`,
  );
  await db.exec(checked);
  await db.exec(checked);
  console.log(
    "Encoding checks passed: ASCII transport, Arabic/punctuation roundtrip, exact repair, replay and human-edit preservation.",
  );
} finally {
  await db.close();
}
