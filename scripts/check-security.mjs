import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createTestDatabase } from "./test-database.mjs";

const db = await createTestDatabase();
const ids = Object.fromEntries(
  ["owner", "admin", "a", "b", "coach", "coach2", "invited", "privileged"].map((k) => [
    k,
    randomUUID(),
  ]),
);
let checks = 0;
const eq = (actual, expected) => {
  assert.deepEqual(actual, expected);
  checks++;
};
const denied = async (sql) => {
  await assert.rejects(
    db.exec(sql),
    /permission|policy|immutable|Only|only|Admins|paused|pending|own account|active coach|injected/i,
  );
  checks++;
};
const scalar = async (sql) => Object.values((await db.query(sql)).rows[0])[0];
async function as(key) {
  await db.exec(
    `RESET ROLE; SELECT set_config('request.jwt.claim.sub','${ids[key]}',false); SET ROLE authenticated;`,
  );
}
async function signup(key, email) {
  await db.exec(
    `RESET ROLE; SELECT set_config('request.jwt.claim.sub','',false); INSERT INTO auth.users(id,email) VALUES ('${ids[key]}','${email}')`,
  );
}
async function activeCoach() {
  return (
    await db.query(
      `SELECT coach_id FROM public.coach_assignments WHERE member_id='${ids.b}' AND active`,
    )
  ).rows.map((r) => r.coach_id);
}
try {
  await db.exec("ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created");
  for (const key of ["owner", "admin", "a", "b", "coach", "coach2"]) {
    await db.exec(`INSERT INTO auth.users(id,email) VALUES ('${ids[key]}','${key}@test.invalid');
      INSERT INTO public.profiles(id,email,display_name) VALUES ('${ids[key]}','${key}@test.invalid','Security test');
      INSERT INTO public.user_roles(user_id,role) VALUES ('${ids[key]}','${key === "owner" ? "super_admin" : key === "admin" ? "admin" : key.startsWith("coach") ? "coach" : "member"}')`);
  }
  await db.exec("ALTER TABLE auth.users ENABLE TRIGGER on_auth_user_created");
  const invite = randomUUID(),
    revoked = randomUUID(),
    privileged = randomUUID();
  await as("admin");
  await db.exec(
    `INSERT INTO public.invites(id,email,invited_by) VALUES ('${invite}','invited@test.invalid','${ids.admin}'),('${revoked}','revoked@test.invalid','${ids.admin}')`,
  );
  for (const change of [
    "role='super_admin'",
    "role='admin'",
    "email='other@test.invalid'",
    "accepted_at=now()",
    "expires_at=now()+interval '1 year'",
    `pod_id='${randomUUID()}'`,
  ]) {
    await denied(`UPDATE public.invites SET ${change} WHERE id='${invite}'`);
  }
  await db.exec(`UPDATE public.invites SET revoked_at=now() WHERE id='${revoked}'`);
  eq(await scalar(`SELECT revoked_at IS NOT NULL FROM public.invites WHERE id='${revoked}'`), true);
  await denied(`UPDATE public.invites SET revoked_at=NULL WHERE id='${revoked}'`);
  await denied(`INSERT INTO public.invites(email,role) VALUES ('bad@test.invalid','super_admin')`);
  await as("owner");
  await db.exec(
    `INSERT INTO public.invites(id,email,role) VALUES ('${privileged}','privileged@test.invalid','admin')`,
  );
  await as("admin");
  await denied(`UPDATE public.invites SET revoked_at=now() WHERE id='${privileged}'`);
  await denied(`UPDATE public.profiles SET access_active=false WHERE id='${ids.owner}'`);
  await denied(`UPDATE public.profiles SET access_active=false WHERE id='${ids.admin}'`);
  await as("owner");
  await denied(`UPDATE public.profiles SET access_active=false WHERE id='${ids.owner}'`);
  await signup("invited", "invited@test.invalid");
  eq(await scalar(`SELECT private.has_role('${ids.invited}','member')`), true);
  eq(await scalar(`SELECT private.has_role('${ids.invited}','super_admin')`), false);
  eq(await scalar(`SELECT accepted_at IS NOT NULL FROM public.invites WHERE id='${invite}'`), true);
  await signup("privileged", "privileged@test.invalid");
  eq(await scalar(`SELECT private.has_role('${ids.privileged}','admin')`), true);
  await as("owner");
  await denied(`UPDATE public.invites SET revoked_at=now() WHERE id='${invite}'`);
  await as("a");
  await denied(`INSERT INTO public.invites(email) VALUES ('outsider@test.invalid')`);

  const own = randomUUID(),
    victim = randomUUID(),
    set = randomUUID();
  await db.exec(`INSERT INTO public.workout_sessions(id,member_id) VALUES ('${own}','${ids.a}');
    INSERT INTO public.set_logs(id,member_id,session_id,exercise_id,set_number,reps,weight_kg)
    SELECT '${set}','${ids.a}','${own}',id,1,5,20 FROM public.exercises LIMIT 1`);
  await as("b");
  await db.exec(
    `INSERT INTO public.workout_sessions(id,member_id) VALUES ('${victim}','${ids.b}')`,
  );
  await as("a");
  await denied(`UPDATE public.set_logs SET session_id='${victim}' WHERE id='${set}'`);
  eq(await scalar(`SELECT session_id FROM public.set_logs WHERE id='${set}'`), own);
  await db.exec(`UPDATE public.set_logs SET reps=6 WHERE id='${set}'`);
  eq(await scalar(`SELECT reps FROM public.set_logs WHERE id='${set}'`), 6);
  await db.exec("RESET ROLE");
  await assert.rejects(
    db.exec(`UPDATE public.set_logs SET session_id='${victim}' WHERE id='${set}'`),
    (e) => e.code === "23503",
  );
  checks++;
  await as("b");
  await db.exec(`UPDATE public.workout_sessions SET finished_at=now() WHERE id='${victim}'`);
  eq(Number(await scalar(`SELECT count(*) FROM public.xp_events WHERE member_id='${ids.b}'`)), 0);
  await as("a");
  await db.exec(`INSERT INTO public.food_logs(member_id,name,calories) VALUES ('${ids.a}','Meal',500);
    INSERT INTO public.body_measurements(member_id,weight_kg) VALUES ('${ids.a}',80)`);
  await as("owner");
  await db.exec(`UPDATE public.profiles SET access_active=false WHERE id='${ids.a}'`);
  await as("a");
  for (const sql of [
    `UPDATE public.set_logs SET reps=99 WHERE id='${set}' RETURNING id`,
    `UPDATE public.workout_sessions SET notes='paused' WHERE id='${own}' RETURNING id`,
    `UPDATE public.food_logs SET calories=999 WHERE member_id='${ids.a}' RETURNING id`,
    `UPDATE public.body_measurements SET weight_kg=99 WHERE member_id='${ids.a}' RETURNING id`,
  ])
    eq((await db.query(sql)).rows.length, 0);
  await denied(
    `INSERT INTO public.food_logs(member_id,name,calories) VALUES ('${ids.a}','Paused',1)`,
  );
  // Export remains available; the training-depth plan also blocks ordinary log deletion while paused.
  eq(typeof (await scalar("SELECT public.export_personal_data()")), "object");
  await db.exec(`DELETE FROM public.food_logs WHERE member_id='${ids.a}'`);
  eq(Number(await scalar(`SELECT count(*) FROM public.food_logs WHERE member_id='${ids.a}'`)), 1);
  await as("owner");
  await db.exec(`UPDATE public.profiles SET access_active=true WHERE id='${ids.a}'`);
  await as("a");
  await db.exec(`UPDATE public.workout_sessions SET finished_at=now() WHERE id='${own}'`);
  eq(
    Number(
      await scalar(
        `SELECT sum(amount) FROM public.xp_events WHERE member_id='${ids.a}' AND source='workout'`,
      ),
    ),
    3500,
  );
  const backup = await scalar("SELECT public.export_personal_data()");
  const previousXp = Number(
    await scalar(`SELECT sum(amount) FROM public.xp_events WHERE member_id='${ids.a}'`),
  );
  await db.exec(
    `UPDATE public.workout_sessions SET finished_at=NULL WHERE id='${own}'; DELETE FROM public.workout_sessions WHERE id='${own}'`,
  );
  await db.query("SELECT public.restore_personal_data($1::jsonb,false)", [JSON.stringify(backup)]);
  await db.query("SELECT public.restore_personal_data($1::jsonb,false)", [JSON.stringify(backup)]);
  eq(Number(await scalar(`SELECT count(*) FROM public.set_logs WHERE session_id='${own}'`)), 1);
  eq(
    Number(await scalar(`SELECT sum(amount) FROM public.xp_events WHERE member_id='${ids.a}'`)),
    previousXp,
  );

  await as("admin");
  await db.exec(`SELECT public.set_member_coach('${ids.b}','${ids.coach}')`);
  eq(await activeCoach(), [ids.coach]);
  await db.exec(
    `SELECT public.set_member_coach('${ids.b}','${ids.coach2}'); SELECT public.set_member_coach('${ids.b}','${ids.coach}')`,
  );
  eq(await activeCoach(), [ids.coach]);
  await db.exec(`SELECT public.set_member_coach('${ids.b}','${ids.coach}')`);
  eq(await activeCoach(), [ids.coach]);
  await denied(`SELECT public.set_member_coach('${ids.b}','${ids.a}')`);
  eq(await activeCoach(), [ids.coach]);
  await db.exec(`RESET ROLE; CREATE FUNCTION public.inject_coach_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.coach_id='${ids.coach2}' THEN RAISE EXCEPTION 'injected failure'; END IF; RETURN NEW; END $$;
    CREATE TRIGGER inject_coach_failure BEFORE INSERT ON public.coach_assignments FOR EACH ROW EXECUTE FUNCTION public.inject_coach_failure()`);
  await as("admin");
  await denied(`SELECT public.set_member_coach('${ids.b}','${ids.coach2}')`);
  eq(await activeCoach(), [ids.coach]);
  await db.exec(`SELECT public.set_member_coach('${ids.b}',NULL)`);
  eq(await activeCoach(), []);
  await as("a");
  await denied(`SELECT public.set_member_coach('${ids.b}','${ids.coach}')`);
  await as("owner");
  await db.exec(`UPDATE public.profiles SET access_active=false WHERE id='${ids.admin}'`);
  await as("admin");
  await denied(`SELECT public.set_member_coach('${ids.b}','${ids.coach}')`);
  await db.exec("RESET ROLE; SET ROLE anon");
  await denied(`SELECT public.set_member_coach('${ids.b}','${ids.coach}')`);
  await db.exec("RESET ROLE");
  eq(
    Number(
      await scalar(
        `SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prosecdef AND has_function_privilege('authenticated',p.oid,'EXECUTE')`,
      ),
    ),
    0,
  );
  eq(
    await scalar(
      `SELECT convalidated FROM pg_constraint WHERE conname='set_logs_session_member_fkey'`,
    ),
    true,
  );
  eq(
    await scalar(
      `SELECT EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='set_logs_session_member_idx' AND indexdef LIKE '%(session_id, member_id)%')`,
    ),
    true,
  );
  eq(
    Number(
      await scalar(
        `SELECT count(*) FROM pg_constraint WHERE contype='f' AND conrelid='public.set_logs'::regclass AND confrelid='public.workout_sessions'::regclass`,
      ),
    ),
    1,
  );
  console.log(
    `${checks} security assertions passed: invitation lifecycle, owner protection, set ownership, pause enforcement and atomic coaching.`,
  );
} finally {
  await db.close();
}
