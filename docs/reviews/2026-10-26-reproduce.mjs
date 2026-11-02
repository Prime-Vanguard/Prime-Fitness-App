// Review-only reproductions against isolated Postgres/WASM. No remote credentials.
// Historical snapshot: stop before the authorization patch, regardless of later fixes.
// These assertions describe the original vulnerabilities, not current desired behavior.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readdir } from "node:fs/promises";
import { createTestDatabase } from "../../scripts/test-database.mjs";

const patch = (await readdir(new URL("../../supabase/migrations/", import.meta.url))).find((name) =>
  name.endsWith("_authorization_and_coaching_fixes.sql"),
);
if (!patch) throw new Error("Authorization patch migration was not found");
const db = await createTestDatabase(patch);
const ids = Object.fromEntries(
  ["owner", "admin", "a", "b", "coach", "elevated"].map((key) => [key, randomUUID()]),
);
async function as(key) {
  await db.exec(
    `RESET ROLE; SELECT set_config('request.jwt.claim.sub','${ids[key]}',false); SET ROLE authenticated;`,
  );
}
const findings = [];
try {
  await db.exec("ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created");
  for (const key of ["owner", "admin", "a", "b", "coach"]) {
    await db.exec(`INSERT INTO auth.users(id,email) VALUES ('${ids[key]}','${key}@review.invalid');
      INSERT INTO public.profiles(id,email,display_name) VALUES ('${ids[key]}','${key}@review.invalid','Review ${key}');
      INSERT INTO public.user_roles(user_id,role) VALUES ('${ids[key]}','${key === "owner" ? "super_admin" : key === "admin" ? "admin" : key === "coach" ? "coach" : "member"}');`);
  }

  // R1: role restriction exists on INSERT, but not UPDATE.
  await as("admin");
  const invite = randomUUID();
  await db.exec(`INSERT INTO public.invites(id,email,role,invited_by) VALUES ('${invite}','elevated@review.invalid','member','${ids.admin}');
    UPDATE public.invites SET role='super_admin' WHERE id='${invite}';`);
  await db.exec(`RESET ROLE; SELECT set_config('request.jwt.claim.sub','',false);
    ALTER TABLE auth.users ENABLE TRIGGER on_auth_user_created;
    INSERT INTO auth.users(id,email) VALUES ('${ids.elevated}','elevated@review.invalid');`);
  assert.equal(
    (await db.query(`SELECT private.has_role('${ids.elevated}','super_admin') AS elevated`)).rows[0]
      .elevated,
    true,
  );
  findings.push(
    "R1 confirmed: ordinary admin changed a member invitation to super_admin; signup granted that role.",
  );

  // R2: an owned row can point at an unowned parent on UPDATE.
  const own = randomUUID(),
    victim = randomUUID(),
    set = randomUUID();
  await as("a");
  await db.exec(`INSERT INTO public.workout_sessions(id,member_id) VALUES ('${own}','${ids.a}');
    INSERT INTO public.set_logs(id,session_id,member_id,exercise_id,set_number,reps,weight_kg)
    SELECT '${set}','${own}','${ids.a}',id,1,5,20 FROM public.exercises LIMIT 1;`);
  await as("b");
  await db.exec(
    `INSERT INTO public.workout_sessions(id,member_id) VALUES ('${victim}','${ids.b}')`,
  );
  await as("a");
  const moved = await db.query(
    `UPDATE public.set_logs SET session_id='${victim}' WHERE id='${set}' RETURNING id`,
  );
  assert.equal(moved.rows.length, 1);
  await as("b");
  await db.exec(`UPDATE public.workout_sessions SET finished_at=now() WHERE id='${victim}'`);
  assert.equal(
    Number(
      (await db.query(`SELECT xp FROM public.member_xp_totals WHERE member_id='${ids.b}'`)).rows[0]
        .xp,
    ),
    4000,
  );
  findings.push(
    "R2 confirmed: member A moved an owned set into B's workout; B then received 4,000 XP without an owned set.",
  );

  // R3: pause policies cover INSERT only.
  await as("owner");
  await db.exec(`UPDATE public.profiles SET access_active=false WHERE id='${ids.a}'`);
  await as("a");
  const edited = await db.query(
    `UPDATE public.set_logs SET reps=99 WHERE id='${set}' RETURNING id`,
  );
  const sessionEdit = await db.query(
    `UPDATE public.workout_sessions SET notes='Edited while paused' WHERE id='${own}' RETURNING id`,
  );
  assert.equal(edited.rows.length, 1);
  assert.equal(sessionEdit.rows.length, 1);
  findings.push(
    "R3 confirmed: paused member could update an existing set and workout through authenticated policies.",
  );

  // R4: reassigning an inactive coach uses INSERT against a unique historical pair.
  await as("admin");
  await db.exec(`INSERT INTO public.coach_assignments(coach_id,member_id) VALUES ('${ids.coach}','${ids.b}');
    UPDATE public.coach_assignments SET active=false WHERE member_id='${ids.b}';`);
  await assert.rejects(
    db.exec(
      `INSERT INTO public.coach_assignments(coach_id,member_id) VALUES ('${ids.coach}','${ids.b}')`,
    ),
    (e) => e.code === "23505",
  );
  assert.equal(
    (await db.query(`SELECT * FROM public.coach_assignments WHERE member_id='${ids.b}' AND active`))
      .rows.length,
    0,
  );
  findings.push(
    "R4 confirmed: assigning a previously used coach fails with unique violation after deactivation, leaving no active coach.",
  );

  // R5: members cannot resolve an archived exercise even when they have a historical set.
  await as("owner");
  const exercise = (await db.query(`SELECT exercise_id FROM public.set_logs WHERE id='${set}'`))
    .rows[0].exercise_id;
  await db.exec(`UPDATE public.exercises SET active=false WHERE id='${exercise}'`);
  await as("a");
  assert.equal(
    (await db.query(`SELECT * FROM public.set_logs WHERE exercise_id='${exercise}'`)).rows.length,
    1,
  );
  assert.equal(
    (await db.query(`SELECT * FROM public.exercises WHERE id='${exercise}'`)).rows.length,
    0,
  );
  findings.push(
    "R5 confirmed: historical set is readable but its archived exercise metadata is hidden by RLS.",
  );

  // R6: backend accepts physically invalid measurements/log values.
  await as("b");
  await db.exec(`INSERT INTO public.water_logs(member_id,ml) VALUES ('${ids.b}',-250);
    INSERT INTO public.body_measurements(member_id,weight_kg,body_fat_pct) VALUES ('${ids.b}',-80,150);
    INSERT INTO public.food_logs(member_id,name,protein_g) VALUES ('${ids.b}','Invalid macros',-20);`);
  findings.push(
    "R6 confirmed: negative water/protein/weight and body-fat over 100% were accepted by the database.",
  );
  console.log(findings.join("\n"));
} finally {
  await db.close();
}
