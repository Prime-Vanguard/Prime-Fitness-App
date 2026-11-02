import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createTestDatabase } from "./test-database.mjs";
const db = await createTestDatabase();
const ids = Object.fromEntries(
  ["admin", "other", "member", "paused", "program", "exercise", "alternative", "row", "later"].map(
    (k) => [k, randomUUID()],
  ),
);
let checks = 0;
const eq = (a, b) => {
  assert.deepEqual(a, b);
  checks++;
};
const scalar = async (sql, params = []) => Object.values((await db.query(sql, params)).rows[0])[0];
const as = async (key) =>
  db.exec(
    `RESET ROLE; SELECT set_config('request.jwt.claim.sub','${ids[key]}',false); SET ROLE authenticated;`,
  );
const denied = async (
  sql,
  params = [],
  pattern = /changed|Active|reviewed|immutable|policy|permission/i,
) => {
  await assert.rejects(db.query(sql, params), pattern);
  checks++;
};
const snapshot = () => scalar("SELECT private.program_editor_snapshot($1::uuid)", [ids.program]);
const review = (action, expected) =>
  scalar("SELECT public.review_program_draft($1::uuid,$2,$3::jsonb)", [
    ids.program,
    action,
    JSON.stringify(expected),
  ]);
try {
  await db.exec("ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created");
  for (const key of ["admin", "other", "member", "paused"])
    await db.exec(
      `INSERT INTO auth.users(id,email) VALUES ('${ids[key]}','editor-${key}@test.invalid'); INSERT INTO public.profiles(id,email) VALUES ('${ids[key]}','editor-${key}@test.invalid'); INSERT INTO public.user_roles(user_id,role) VALUES ('${ids[key]}','${key === "member" ? "member" : "admin"}')`,
    );
  await db.exec("ALTER TABLE auth.users ENABLE TRIGGER on_auth_user_created");
  await as("admin");
  await db.exec(
    `INSERT INTO public.programs(id,name,weeks,created_by) VALUES ('${ids.program}','Editor program',3,'${ids.admin}'); INSERT INTO public.exercises(id,name_en,muscle,created_by) VALUES ('${ids.exercise}','Press','chest','${ids.admin}'),('${ids.alternative}','Alternative press','chest','${ids.admin}'); INSERT INTO public.program_items(id,program_id,exercise_id,week,day,target_sets,target_reps,position) VALUES ('${ids.row}','${ids.program}','${ids.exercise}',1,1,3,'8-12',0),('${ids.later}','${ids.program}','${ids.alternative}',2,2,4,'6-8',0)`,
  );
  const before = await snapshot();
  await db.exec(`UPDATE public.program_items SET target_sets=5 WHERE id='${ids.later}'`);
  await denied("SELECT public.review_program_draft($1::uuid,'copy',$2::jsonb)", [
    ids.program,
    JSON.stringify(before),
  ]);
  eq(await scalar(`SELECT target_sets FROM public.program_items WHERE id='${ids.later}'`), 5);
  const copyPreview = await snapshot();
  eq((await review("copy", copyPreview)).copied, true);
  eq(
    await scalar(
      `SELECT count(*)::int FROM public.program_items WHERE program_id='${ids.program}'`,
    ),
    3,
  );
  const copiedIds = await scalar(
    `SELECT jsonb_agg(id ORDER BY id) FROM public.program_items WHERE program_id='${ids.program}'`,
  );
  eq((await review("copy", copyPreview)).already_applied, true);
  eq(
    await scalar(
      `SELECT jsonb_agg(id ORDER BY id) FROM public.program_items WHERE program_id='${ids.program}'`,
    ),
    copiedIds,
  );
  const publishPreview = await snapshot(),
    version = (await review("publish", publishPreview)).version_id;
  eq((await review("publish", publishPreview)).version_id, version);
  const frozen = await scalar("SELECT items FROM public.program_versions WHERE id=$1", [version]);
  await db.exec(`UPDATE public.program_items SET target_reps='10-15' WHERE id='${ids.row}'`);
  await denied("SELECT public.review_program_draft($1::uuid,'publish',$2::jsonb)", [
    ids.program,
    JSON.stringify(publishPreview),
  ]);
  eq(await scalar("SELECT items FROM public.program_versions WHERE id=$1", [version]), frozen);
  const second = (await review("publish", await snapshot())).version_id;
  eq(second !== version, true);
  const assignment = await scalar(
    "SELECT public.review_program_assignment($1::uuid,$2::uuid,NULL)",
    [ids.member, version],
  );
  eq(
    await scalar("SELECT public.review_program_assignment($1::uuid,$2::uuid,NULL)", [
      ids.member,
      version,
    ]),
    assignment,
  );
  await as("other");
  const replacement = await scalar("SELECT public.assign_program_version($1::uuid,$2::uuid)", [
    ids.member,
    second,
  ]);
  await as("admin");
  await denied("SELECT public.review_program_assignment($1::uuid,$2::uuid,$3::uuid)", [
    ids.member,
    version,
    assignment,
  ]);
  eq(
    await scalar(
      `SELECT id FROM public.program_assignments WHERE member_id='${ids.member}' AND active`,
    ),
    replacement,
  );
  const exercisePreview = await snapshot();
  await db.exec(`UPDATE public.exercises SET name_en='Renamed press' WHERE id='${ids.exercise}'`);
  await denied("SELECT public.review_program_draft($1::uuid,'publish',$2::jsonb)", [
    ids.program,
    JSON.stringify(exercisePreview),
  ]);
  eq(await scalar("SELECT items FROM public.program_versions WHERE id=$1", [version]), frozen);
  await db.exec(`UPDATE public.profiles SET access_active=false WHERE id='${ids.paused}'`);
  await as("paused");
  await denied("SELECT public.review_program_draft($1::uuid,'publish',$2::jsonb)", [
    ids.program,
    JSON.stringify(await scalar("SELECT private.program_editor_snapshot($1::uuid)", [ids.program])),
  ]);
  await denied("SELECT public.review_program_assignment($1::uuid,$2::uuid,NULL)", [
    ids.member,
    version,
  ]);
  eq(
    (
      await db.query(
        `UPDATE public.program_items SET target_sets=99 WHERE id='${ids.row}' RETURNING id`,
      )
    ).rows.length,
    0,
  );
  await denied(`INSERT INTO public.programs(name,weeks) VALUES ('Paused creation',2)`);
  await as("member");
  await denied("SELECT public.review_program_draft($1::uuid,'copy',$2::jsonb)", [
    ids.program,
    JSON.stringify(copyPreview),
  ]);
  await as("admin");
  await db.exec(`UPDATE public.exercises SET active=false WHERE id='${ids.exercise}'`);
  eq(await scalar("SELECT items FROM public.program_versions WHERE id=$1", [version]), frozen);
  eq(
    await scalar(
      "SELECT count(*)::int FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('review_program_draft','review_program_assignment') AND NOT p.prosecdef",
    ),
    2,
  );
  console.log(
    `${checks} program editor database assertions passed: preview guards, retry-safe copy/publication, frozen history, assignment conflicts and active authorization.`,
  );
} finally {
  await db.close();
}
