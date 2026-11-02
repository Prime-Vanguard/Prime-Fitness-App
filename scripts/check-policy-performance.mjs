import assert from "node:assert/strict";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { createTestDatabase } from "./test-database.mjs";

const migrations = (await readdir(new URL("../supabase/migrations/", import.meta.url))).filter(
  (name) => name.endsWith("_optimize_rls_and_foreign_keys.sql"),
);
assert.equal(migrations.length, 1);
const migration = migrations[0];
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const actors = [
  { name: "member", id: id(1), role: "member" },
  { name: "other-member", id: id(2), role: "member" },
  { name: "outsider", id: id(3), role: "member" },
  { name: "coach", id: id(4), role: "coach" },
  { name: "pod-leader", id: id(5), role: "pod_leader" },
  { name: "admin", id: id(6), role: "admin" },
  { name: "super-admin", id: id(7), role: "super_admin" },
  { name: "paused-member", id: id(8), role: "member" },
  { name: "anonymous", id: "", role: "anon" },
];
const db = await createTestDatabase(migration);
const quote = (value) => `"${value.replaceAll('"', '""')}"`;
let comparisons = 0;
async function as(actor) {
  await db.exec(
    `RESET ROLE; SELECT set_config('request.jwt.claim.sub','${actor.id}',false); SET ROLE ${actor.role === "anon" ? "anon" : "authenticated"};`,
  );
}
async function snapshotReads(tables) {
  const result = {};
  for (const actor of actors) {
    await as(actor);
    for (const { schema, table } of tables) {
      try {
        const r = await db.query(
          `SELECT coalesce(jsonb_agg(value ORDER BY value::text),'[]'::jsonb) AS items FROM (SELECT to_jsonb(t) AS value FROM ${quote(schema)}.${quote(table)} t) rows`,
        );
        result[`${actor.name}:${schema}.${table}`] = { rows: r.rows[0].items };
      } catch (error) {
        result[`${actor.name}:${schema}.${table}`] = { error: error.code };
      }
    }
  }
  await db.exec("RESET ROLE");
  return result;
}
async function snapshotWrites(cases) {
  const results = {};
  for (const actor of actors) {
    await as(actor);
    for (const [name, sql] of cases) {
      await db.exec("BEGIN");
      try {
        const r = await db.exec(sql.replaceAll("__SELF__", actor.id || id(3)));
        results[`${actor.name}:${name}`] = {
          affected: r.map((item) => item.affectedRows ?? item.rows?.length ?? 0),
        };
      } catch (error) {
        results[`${actor.name}:${name}`] = { error: error.code, message: error.message };
      } finally {
        await db.exec("ROLLBACK");
      }
    }
  }
  await db.exec("RESET ROLE");
  return results;
}
async function policies() {
  return (
    await db.query(
      "SELECT schemaname,tablename,policyname,permissive,roles::text,cmd,qual,with_check FROM pg_policies WHERE schemaname='public' OR (schemaname='storage' AND policyname LIKE 'progress photos%') ORDER BY schemaname,tablename,policyname",
    )
  ).rows;
}
try {
  await db.exec("ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created");
  for (const actor of actors.filter((a) => a.id)) {
    await db.exec(
      `INSERT INTO auth.users(id,email) VALUES ('${actor.id}','${actor.name}@test.invalid'); INSERT INTO public.profiles(id,display_name,onboarding_completed,access_active,pod_feed_opt_in,leaderboard_opt_in) VALUES ('${actor.id}','${actor.name}',true,${actor.name !== "paused-member"},true,true); INSERT INTO public.user_roles(user_id,role) VALUES ('${actor.id}','${actor.role}')`,
    );
  }
  await db.exec(`
    INSERT INTO public.pods(id,name,leader_id) VALUES ('${id(10)}','Pod A','${id(5)}'),('${id(11)}','Pod B','${id(3)}');
    INSERT INTO public.pod_members(pod_id,member_id) VALUES ('${id(10)}','${id(1)}'),('${id(10)}','${id(8)}'),('${id(11)}','${id(2)}');
    INSERT INTO public.coach_assignments(coach_id,member_id,active) VALUES ('${id(4)}','${id(1)}',true),('${id(4)}','${id(2)}',false);
    INSERT INTO public.invites(id,email,invited_by,pod_id,coach_id) VALUES ('${id(15)}','invite@test.invalid','${id(6)}','${id(10)}','${id(4)}');
    INSERT INTO public.programs(id,name,created_by) VALUES ('${id(20)}','Program A','${id(6)}'),('${id(21)}','Program B','${id(6)}');
    INSERT INTO public.program_assignments(program_id,member_id) VALUES ('${id(20)}','${id(1)}'),('${id(21)}','${id(2)}');
    INSERT INTO public.exercises(id,name_en,muscle,active,created_by) VALUES ('${id(30)}','Test Squat','legs',true,'${id(6)}'),('${id(31)}','Hidden exercise','back',false,'${id(6)}');
    INSERT INTO public.program_items(id,program_id,week,day,exercise_id) VALUES ('${id(25)}','${id(20)}',1,1,'${id(30)}'),('${id(26)}','${id(21)}',1,1,'${id(30)}');
    INSERT INTO public.workout_sessions(id,member_id,title) VALUES ('${id(40)}','${id(1)}','Open A'),('${id(41)}','${id(2)}','Open B'),('${id(42)}','${id(8)}','Paused'),('${id(43)}','${id(1)}','Finished');
    INSERT INTO public.set_logs(session_id,member_id,exercise_id,set_number,reps,weight_kg) VALUES ('${id(40)}','${id(1)}','${id(30)}',1,5,100),('${id(41)}','${id(2)}','${id(30)}',1,5,80),('${id(43)}','${id(1)}','${id(30)}',1,5,100);
    UPDATE public.workout_sessions SET finished_at=now() WHERE id='${id(43)}';
    INSERT INTO public.nutrition_targets(member_id,calories,set_by) VALUES ('${id(1)}',2200,'${id(4)}'),('${id(2)}',2000,'${id(6)}');
    INSERT INTO public.food_logs(member_id,name,calories) VALUES ('${id(1)}','Meal A',500),('${id(2)}','Meal B',450);
    INSERT INTO public.food_logs(member_id,name,calories,log_date) VALUES ('${id(3)}','Yesterday',500,(now() AT TIME ZONE 'Africa/Cairo')::date - 1);
    INSERT INTO public.water_logs(member_id,ml) VALUES ('${id(1)}',250),('${id(2)}',500);
    INSERT INTO public.body_measurements(member_id,weight_kg) VALUES ('${id(1)}',80),('${id(2)}',75);
    INSERT INTO public.pv_tasks(id,title_en,points,active) VALUES ('${id(50)}','Task',100,true),('${id(51)}','Hidden task',100,false);
    INSERT INTO public.pv_claims(id,task_id,member_id) VALUES ('${id(55)}','${id(50)}','${id(1)}'),('${id(56)}','${id(50)}','${id(2)}');
    INSERT INTO public.rewards(id,title_en,cost_pv,stock) VALUES ('${id(60)}','Reward',100,5);
    INSERT INTO public.saved_meals(id,member_id,name,kind,items) VALUES ('${id(70)}','${id(1)}','Shake','food','[{"name":"Shake","calories":120,"protein_g":20,"carbs_g":3,"fat_g":1}]');
    INSERT INTO public.progress_photos(id,member_id,path,pose) VALUES ('${id(80)}','${id(1)}','${id(1)}/photo.png','front'),('${id(81)}','${id(2)}','${id(2)}/photo.png','front');
    INSERT INTO storage.objects(bucket_id,name) VALUES ('progress-photos','${id(1)}/photo.png'),('progress-photos','${id(2)}/photo.png');
  `);
  const tables = (
    await db.query(
      "SELECT schemaname AS schema,tablename AS table FROM pg_tables WHERE schemaname='public' UNION ALL SELECT schemaname,viewname FROM pg_views WHERE schemaname='public' UNION ALL SELECT 'storage','objects' ORDER BY 1,2",
    )
  ).rows;
  const cases = [
    [
      "own-workout",
      "INSERT INTO public.workout_sessions(member_id,title) VALUES ('__SELF__','New')",
    ],
    [
      "foreign-workout",
      `INSERT INTO public.workout_sessions(member_id,title) VALUES ('${id(1)}','New')`,
    ],
    [
      "open-set",
      `INSERT INTO public.set_logs(session_id,member_id,exercise_id,set_number,reps) VALUES ('${id(40)}','${id(1)}','${id(30)}',2,5)`,
    ],
    [
      "finished-set",
      `INSERT INTO public.set_logs(session_id,member_id,exercise_id,set_number,reps) VALUES ('${id(43)}','${id(1)}','${id(30)}',2,5)`,
    ],
    [
      "own-food",
      "INSERT INTO public.food_logs(member_id,name,calories) VALUES ('__SELF__','Food',500)",
    ],
    [
      "foreign-food",
      `INSERT INTO public.food_logs(member_id,name,calories) VALUES ('${id(1)}','Food',500)`,
    ],
    [
      "grant-member-role",
      `INSERT INTO public.user_roles(user_id,role) VALUES ('${id(3)}','coach')`,
    ],
    ["grant-admin-role", `INSERT INTO public.user_roles(user_id,role) VALUES ('${id(3)}','admin')`],
    ["revoke-role", `DELETE FROM public.user_roles WHERE user_id='${id(3)}' AND role='member'`],
    ["own-profile", "UPDATE public.profiles SET display_name='Changed' WHERE id='__SELF__'"],
    ["foreign-profile", `UPDATE public.profiles SET display_name='Changed' WHERE id='${id(1)}'`],
    ["pause-member", `UPDATE public.profiles SET access_active=false WHERE id='${id(1)}'`],
    ["create-pod", "INSERT INTO public.pods(name,leader_id) VALUES ('New Pod','__SELF__')"],
    ["update-pod", `UPDATE public.pods SET name='Changed' WHERE id='${id(10)}'`],
    ["delete-pod", `DELETE FROM public.pods WHERE id='${id(10)}'`],
    [
      "add-pod-member",
      `INSERT INTO public.pod_members(pod_id,member_id) VALUES ('${id(10)}','${id(3)}')`,
    ],
    [
      "remove-pod-member",
      `DELETE FROM public.pod_members WHERE pod_id='${id(10)}' AND member_id='${id(1)}'`,
    ],
    [
      "assign-coach",
      `INSERT INTO public.coach_assignments(coach_id,member_id) VALUES ('${id(4)}','${id(3)}')`,
    ],
    ["change-coach", `UPDATE public.coach_assignments SET active=false WHERE member_id='${id(1)}'`],
    ["remove-coach", `DELETE FROM public.coach_assignments WHERE member_id='${id(1)}'`],
    [
      "coach-active-target",
      `UPDATE public.nutrition_targets SET calories=2300 WHERE member_id='${id(1)}'`,
    ],
    [
      "coach-inactive-target",
      `UPDATE public.nutrition_targets SET calories=2300 WHERE member_id='${id(2)}'`,
    ],
    [
      "new-target",
      `INSERT INTO public.nutrition_targets(member_id,calories) VALUES ('${id(3)}',2000)`,
    ],
    ["delete-target", `DELETE FROM public.nutrition_targets WHERE member_id='${id(1)}'`],
    ["new-program", "INSERT INTO public.programs(name) VALUES ('New program')"],
    ["update-program", `UPDATE public.programs SET name='Changed' WHERE id='${id(20)}'`],
    ["delete-program", `DELETE FROM public.programs WHERE id='${id(20)}'`],
    [
      "new-program-item",
      `INSERT INTO public.program_items(program_id,week,day,exercise_id) VALUES ('${id(20)}',1,2,'${id(30)}')`,
    ],
    ["update-program-item", `UPDATE public.program_items SET target_sets=5 WHERE id='${id(25)}'`],
    ["delete-program-item", `DELETE FROM public.program_items WHERE id='${id(25)}'`],
    [
      "new-assignment",
      `INSERT INTO public.program_assignments(program_id,member_id) VALUES ('${id(20)}','${id(3)}')`,
    ],
    [
      "update-assignment",
      `UPDATE public.program_assignments SET active=false WHERE member_id='${id(1)}'`,
    ],
    ["delete-assignment", `DELETE FROM public.program_assignments WHERE member_id='${id(1)}'`],
    ["new-task", "INSERT INTO public.pv_tasks(title_en,points) VALUES ('New task',50)"],
    ["update-task", `UPDATE public.pv_tasks SET points=200 WHERE id='${id(50)}'`],
    ["delete-task", `DELETE FROM public.pv_tasks WHERE id='${id(51)}'`],
    [
      "own-claim",
      `INSERT INTO public.pv_claims(member_id,task_id) VALUES ('__SELF__','${id(50)}')`,
    ],
    ["approve-claim", `UPDATE public.pv_claims SET status='approved' WHERE id='${id(55)}'`],
    [
      "direct-xp",
      "INSERT INTO public.xp_events(member_id,amount,source,source_ref) VALUES ('__SELF__',999,'fake','fake')",
    ],
    [
      "own-favorite",
      "INSERT INTO public.saved_meals(member_id,name,kind,items) VALUES ('__SELF__','Food','food','[{}]')",
    ],
    [
      "favorite-reassign",
      `UPDATE public.saved_meals SET member_id='${id(2)}' WHERE id='${id(70)}'`,
    ],
    [
      "shield",
      "INSERT INTO public.streak_shields(member_id,shield_date) VALUES ('__SELF__',(now() AT TIME ZONE 'Africa/Cairo')::date)",
    ],
    [
      "own-photo",
      "INSERT INTO storage.objects(bucket_id,name) VALUES ('progress-photos','__SELF__/new.png')",
    ],
    [
      "foreign-photo",
      `INSERT INTO storage.objects(bucket_id,name) VALUES ('progress-photos','${id(1)}/new.png')`,
    ],
  ];
  const originalPolicies = await policies();
  const beforeReads = await snapshotReads(tables);
  const beforeWrites = await snapshotWrites(cases);
  const explainBefore = (
    await (async () => {
      await as(actors[0]);
      const r = await db.query("EXPLAIN (FORMAT JSON) SELECT id FROM public.food_logs");
      await db.exec("RESET ROLE");
      return r;
    })()
  ).rows;
  await db.exec(
    await readFile(new URL(`../supabase/migrations/${migration}`, import.meta.url), "utf8"),
  );
  const afterReads = await snapshotReads(tables);
  const afterWrites = await snapshotWrites(cases);
  for (const key of Object.keys(beforeReads)) {
    assert.deepEqual(afterReads[key], beforeReads[key], `Read access changed: ${key}`);
    comparisons++;
  }
  for (const key of Object.keys(beforeWrites)) {
    assert.deepEqual(afterWrites[key], beforeWrites[key], `Write access changed: ${key}`);
    comparisons++;
  }
  // Ensure these are substantive positive and negative cases, not all-denied tests.
  assert.equal(beforeWrites["coach:coach-active-target"].affected[0], 1);
  assert.equal(beforeWrites["coach:coach-inactive-target"].affected[0], 0);
  assert.equal(beforeWrites["member:own-workout"].affected[0], 1);
  assert.equal(beforeWrites["paused-member:own-workout"].error, "42501");
  assert.equal(beforeWrites["admin:grant-admin-role"].error, "42501");
  assert.equal(beforeWrites["super-admin:grant-admin-role"].affected[0], 1);
  assert.ok(beforeWrites["member:direct-xp"].error);
  assert.ok(beforeWrites["member:favorite-reassign"].error);
  assert.equal(beforeWrites["member:own-photo"].affected[0], 1);
  await as(actors[0]);
  const explainAfter = (await db.query("EXPLAIN (FORMAT JSON) SELECT id FROM public.food_logs"))
    .rows;
  assert.match(JSON.stringify(explainAfter), /InitPlan/);
  await db.exec("RESET ROLE");
  const overlaps = await db.query(
    "SELECT tablename FROM pg_policies p CROSS JOIN LATERAL unnest(p.roles) role CROSS JOIN LATERAL unnest(CASE WHEN p.cmd='ALL' THEN ARRAY['SELECT','INSERT','UPDATE','DELETE'] ELSE ARRAY[p.cmd] END) action WHERE p.schemaname='public' AND p.permissive='PERMISSIVE' GROUP BY tablename,role,action HAVING count(*)>1",
  );
  assert.equal(overlaps.rows.length, 0);
  const missing = await db.query(
    "SELECT c.conname FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE c.contype='f' AND n.nspname='public' AND NOT EXISTS (SELECT 1 FROM pg_index i WHERE i.indrelid=c.conrelid AND i.indisvalid AND i.indisready AND i.indpred IS NULL AND c.conkey <@ (i.indkey::smallint[])[0:cardinality(c.conkey)-1])",
  );
  assert.deepEqual(missing.rows, []);
  const afterPolicies = await policies();
  const restrict = (rows) =>
    rows
      .filter((p) => p.permissive === "RESTRICTIVE")
      .map((p) => `${p.schemaname}.${p.tablename}:${p.policyname}:${p.cmd}`);
  assert.deepEqual(restrict(afterPolicies), restrict(originalPolicies));
  await db.exec(
    await readFile(new URL("../docs/performance/rollback.sql", import.meta.url), "utf8"),
  );
  assert.deepEqual(
    await policies(),
    originalPolicies,
    "Rollback must restore original policies exactly",
  );
  const report = {
    checkedAt: new Date().toISOString(),
    migration,
    roleCount: actors.length,
    tablesAndViews: tables.length,
    writeCases: cases.length,
    accessComparisons: comparisons,
    restrictivePolicyCount: restrict(originalPolicies).length,
    foreignKeysCovered: true,
    multiplePermissivePolicies: 0,
    rollbackRestoredPolicies: true,
    explainBefore,
    explainAfter,
  };
  await writeFile(
    new URL("../docs/performance/local-verification.json", import.meta.url),
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(
    `${comparisons} before/after access comparisons passed across ${actors.length} roles, ${tables.length} tables/views and ${cases.length} write cases. Foreign-key coverage, InitPlans, restrictive policies and rollback verified.`,
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await db.close();
}
