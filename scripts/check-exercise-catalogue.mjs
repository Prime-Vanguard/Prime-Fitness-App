import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { createTestDatabase } from "./test-database.mjs";
import { catalogueRow } from "./lib/exercise-catalogue.mjs";
const ref = JSON.parse(await readFile("public/data/exercise-reference.json", "utf8"));
const arabic = JSON.parse(await readFile("public/data/exercise-arabic.json", "utf8"));
assert.equal(new Set(arabic.exercises.map((e) => e.id)).size, 1324);
for (const source of ref.exercises) {
  const translated = arabic.exercises.find((e) => e.id === source.id);
  assert.equal(translated.steps_ar.length, source.steps_en.length);
  source.steps_en.forEach((s, i) => {
    assert.match(translated.steps_ar[i], /[\u0600-\u06ff]/);
    const numbers = (s) => (s.match(/\d+(?:\.\d+)?/g) || []).sort();
    assert.deepEqual(
      numbers(s),
      numbers(translated.steps_ar[i]),
      `Numeric preservation: ${source.id}/${i}`,
    );
  });
}
assert.throws(() => catalogueRow(ref.exercises[0], undefined, ref.revision, {}, {}));
const db = await createTestDatabase();
const query = async (sql) => (await db.query(sql)).rows;
try {
  const original = await query(
    "SELECT id,name_en,name_ar,muscle,equipment,logging_mode,load_convention,active FROM public.exercises ORDER BY id",
  );
  assert.equal(original.length, 12);
  const chunks = (await readdir("supabase/catalogue")).filter((f) => f.endsWith(".sql")).sort();
  for (const file of chunks) await db.exec(await readFile(`supabase/catalogue/${file}`, "utf8"));
  const localized = await query(
    "SELECT guidance->'text_source'->>'exercise_id' source_id,name_ar,guidance->>'steps_ar' steps_ar FROM public.exercises WHERE guidance->'text_source'->>'repository'='hasaneyldrm/exercises-dataset'",
  );
  for (const row of localized) {
    assert.match(row.name_ar, /[\u0600-\u06ff]/);
    assert.doesNotMatch(row.name_ar, /[\u00d8\u00d9\ufffd]/);
    assert.equal(
      row.steps_ar,
      arabic.exercises.find((e) => e.id === row.source_id).steps_ar.join("\n"),
      `Stored Arabic: ${row.source_id}`,
    );
  }
  assert.deepEqual(
    await query(
      `SELECT id,name_en,name_ar,muscle,equipment,logging_mode,load_convention,active FROM public.exercises WHERE id IN (${original.map((e) => `'${e.id}'`).join(",")}) ORDER BY id`,
    ),
    original,
  );
  const stats = (
    await query(
      "SELECT count(*)::int total,count(*) FILTER (WHERE guidance->'text_source'->>'repository'='hasaneyldrm/exercises-dataset')::int sourced FROM public.exercises",
    )
  )[0];
  assert.equal(stats.sourced, 1324);
  assert.equal(stats.total, 1327);
  await db.exec(
    "UPDATE public.exercises SET active=false,name_ar='اسم راجعه المدرب',guidance=jsonb_set(guidance,'{steps_ar}','\"تعليمات راجعها المدرب\"') WHERE name_en='3/4 sit-up'",
  );
  for (const file of chunks) await db.exec(await readFile(`supabase/catalogue/${file}`, "utf8"));
  assert.equal((await query("SELECT count(*)::int n FROM public.exercises"))[0].n, 1327);
  assert.deepEqual(
    (
      await query(
        "SELECT active,name_ar,guidance->>'steps_ar' steps FROM public.exercises WHERE name_en='3/4 sit-up'",
      )
    )[0],
    { active: false, name_ar: "اسم راجعه المدرب", steps: "تعليمات راجعها المدرب" },
  );
  const cardio = (
    await query(
      "SELECT id FROM public.exercises WHERE guidance->>'catalogue_kind'='cardio' LIMIT 1",
    )
  )[0].id;
  await db.exec(
    "ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created; INSERT INTO auth.users(id,email) VALUES('00000000-0000-4000-8000-000000001111','catalogue@test.invalid'); INSERT INTO public.profiles(id,access_active) VALUES('00000000-0000-4000-8000-000000001111',true); INSERT INTO public.workout_sessions(id,member_id) VALUES('00000000-0000-4000-8000-000000001112','00000000-0000-4000-8000-000000001111')",
  );
  await assert.rejects(
    db.exec(
      `INSERT INTO public.set_logs(session_id,member_id,exercise_id,set_number,duration_seconds,logging_mode) VALUES('00000000-0000-4000-8000-000000001112','00000000-0000-4000-8000-000000001111','${cardio}',1,60,'timed')`,
    ),
    /cardio logger/,
  );
  await db.exec(
    "SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000001111',false); SET ROLE authenticated",
  );
  assert.equal(
    (await query("SELECT count(*)::int n FROM public.exercises WHERE active"))[0].n,
    1326,
  );
  await db.exec(`UPDATE public.exercises SET active=false WHERE id='${cardio}'`);
  assert.equal(
    (await query(`SELECT active FROM public.exercises WHERE id='${cardio}'`))[0].active,
    true,
  );
  console.log(
    "Catalogue checks passed: all 1324 references, 7710 Arabic steps/numbers, preserved starter IDs/metadata, repeat imports, coach edits/archives, member reads and cardio strength-log rejection.",
  );
} finally {
  await db.close();
}
