import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createTestDatabase } from "./test-database.mjs";
const db = await createTestDatabase();
const ids = Object.fromEntries(
  ["admin", "paused", "member", "fuel", "coach"].map((name) => [name, randomUUID()]),
);
let checks = 0;
const eq = (actual, expected) => {
  assert.deepEqual(actual, expected);
  checks++;
};
const as = async (name) =>
  db.exec(
    `RESET ROLE; SELECT set_config('request.jwt.claim.sub','${ids[name]}',false); SET ROLE authenticated;`,
  );
const invalid = async (sql) => {
  await assert.rejects(db.exec(sql), (error) => ["23514", "P0001", "22P02"].includes(error.code));
  checks++;
};
try {
  await db.exec("ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created");
  for (const [name, id] of Object.entries(ids)) {
    await db.exec(`INSERT INTO auth.users(id,email) VALUES ('${id}','${name}@test.invalid');
      INSERT INTO public.profiles(id,email,access_active) VALUES ('${id}','${name}@test.invalid',${name !== "paused"});
      INSERT INTO public.user_roles(user_id,role) VALUES ('${id}','${name === "admin" || name === "paused" ? "admin" : name === "coach" ? "coach" : "member"}')`);
  }
  // More than the normal REST roster cap and more XP rows than the former 10k client cap.
  await db.exec(`INSERT INTO auth.users(id,email) SELECT gen_random_uuid(),'bulk-'||n||'@test.invalid' FROM generate_series(1,1200) n;
    INSERT INTO public.profiles(id,email) SELECT id,email FROM auth.users WHERE email LIKE 'bulk-%';
    ALTER TABLE public.xp_events DISABLE TRIGGER USER;
    INSERT INTO public.xp_events(member_id,amount,source,source_ref) SELECT '${ids.member}',3,'fixture',n::text FROM generate_series(1,10001) n;
    INSERT INTO public.xp_events(member_id,amount,source,source_ref) VALUES ('${ids.member}',100,'level_curve_transition','fixture');
    ALTER TABLE public.xp_events ENABLE TRIGGER USER;
    INSERT INTO public.pv_ledger(member_id,points,source,approved_by) VALUES
      ('${ids.member}',100,'fixture','${ids.admin}'),('${ids.member}',-40,'redemption','${ids.admin}'),('${ids.member}',40,'refund','${ids.admin}');
    INSERT INTO public.workout_sessions(member_id,started_at,finished_at)
      SELECT '${ids.member}',stamp-interval '1 hour',stamp FROM (
        SELECT now() AS stamp UNION ALL
        SELECT (((now() AT TIME ZONE 'Africa/Cairo')::date-n)::timestamp AT TIME ZONE 'Africa/Cairo')
        FROM unnest(ARRAY[6,7,29,30]) n UNION ALL SELECT now()+interval '1 day'
      ) dates;
    INSERT INTO public.workout_sessions(member_id) VALUES ('${ids.member}');
    INSERT INTO public.food_logs(member_id,log_date,name) VALUES
      ('${ids.fuel}',(now() AT TIME ZONE 'Africa/Cairo')::date,'Today'),
      ('${ids.coach}',(now() AT TIME ZONE 'Africa/Cairo')::date+1,'Future');`);
  const task = randomUUID(),
    reward = randomUUID();
  await db.exec(`INSERT INTO public.pv_tasks(id,title_en,points) VALUES ('${task}','Test',10);
    INSERT INTO public.pv_claims(member_id,task_id,status) VALUES ('${ids.member}','${task}','pending'),('${ids.fuel}','${task}','needs_info');
    INSERT INTO public.rewards(id,title_en,cost_pv) VALUES ('${reward}','Test',10);
    INSERT INTO public.redemptions(member_id,reward_id) VALUES ('${ids.member}','${reward}');`);
  await as("admin");
  const snapshot = (await db.query("SELECT public.get_admin_analytics() AS value")).rows[0].value;
  eq(snapshot.rows.length, 1205);
  eq(snapshot.kpi.members, 1205);
  eq(snapshot.kpi.activeMembers, 1204);
  eq(snapshot.kpi.workouts7, 2);
  eq(snapshot.kpi.workouts30, 4);
  eq(snapshot.kpi.engaged7, 2);
  eq(snapshot.kpi.pendingClaims, 2);
  eq(snapshot.kpi.pendingRedemptions, 1);
  eq(snapshot.kpi.pvIssued, 100);
  const member = snapshot.rows.find((row) => row.id === ids.member);
  eq(member.xp, 30103);
  eq(member.pv, 90);
  eq(member.w7, 2);
  eq(member.w30, 4);
  eq(
    new Date(snapshot.period.to + "T12:00:00Z").getTime() -
      new Date(snapshot.period.from7 + "T12:00:00Z").getTime(),
    6 * 86400000,
  );
  for (const actor of ["member", "fuel", "coach", "paused"]) {
    await as(actor);
    await assert.rejects(db.exec("SELECT public.get_admin_analytics()"), /Only active admins/);
    checks++;
  }
  await db.exec("RESET ROLE; SET ROLE anon");
  await assert.rejects(db.exec("SELECT public.get_admin_analytics()"), /permission/i);
  checks++;
  await as("member");
  for (const column of ["protein_g", "carbs_g", "fat_g"])
    for (const value of ["-1", "10001", "'NaN'::numeric", "'Infinity'::numeric"])
      await invalid(
        `INSERT INTO public.food_logs(member_id,name,${column}) VALUES ('${ids.member}','Invalid',${value})`,
      );
  for (const value of [-1, 0, 10001])
    await invalid(`INSERT INTO public.water_logs(member_id,ml) VALUES ('${ids.member}',${value})`);
  for (const column of ["weight_kg", "waist_cm"])
    for (const value of ["-1", "0", "'NaN'::numeric", "'Infinity'::numeric"])
      await invalid(
        `INSERT INTO public.body_measurements(member_id,${column}) VALUES ('${ids.member}',${value})`,
      );
  for (const value of ["-1", "101", "'NaN'::numeric", "'Infinity'::numeric"])
    await invalid(
      `INSERT INTO public.body_measurements(member_id,body_fat_pct) VALUES ('${ids.member}',${value})`,
    );
  await db.exec(`INSERT INTO public.food_logs(member_id,name,protein_g) VALUES ('${ids.member}','Valid',0.5);
    INSERT INTO public.water_logs(member_id,ml) VALUES ('${ids.member}',250);
    INSERT INTO public.body_measurements(member_id,weight_kg,body_fat_pct) VALUES ('${ids.member}',80.25,0);
    INSERT INTO public.body_measurements(member_id) VALUES ('${ids.member}')`);
  checks++;
  await as("admin");
  for (const [column, value] of [
    ["calories", -1],
    ["calories", 100001],
    ["protein_g", -1],
    ["carbs_g", 10001],
    ["fat_g", -1],
    ["water_ml", 0],
    ["water_ml", 100001],
  ])
    await invalid(
      `INSERT INTO public.nutrition_targets(member_id,${column}) VALUES ('${ids.member}',${value})`,
    );
  await db.exec(
    `INSERT INTO public.nutrition_targets(member_id,calories,protein_g,water_ml) VALUES ('${ids.member}',NULL,0,NULL)`,
  );
  eq(
    (
      await db.query(
        `SELECT calories,protein_g,water_ml FROM public.nutrition_targets WHERE member_id='${ids.member}'`,
      )
    ).rows[0],
    { calories: null, protein_g: 0, water_ml: null },
  );
  await db.exec("RESET ROLE");
  eq(
    (
      await db.query(
        "SELECT prosecdef FROM pg_proc WHERE oid='public.get_admin_analytics()'::regprocedure",
      )
    ).rows[0].prosecdef,
    false,
  );
  eq(
    Number(
      (
        await db.query(
          "SELECT count(*) AS n FROM pg_constraint WHERE conname IN ('food_logs_macros_valid','water_logs_amount_valid','body_measurements_values_valid','nutrition_targets_values_valid') AND convalidated",
        )
      ).rows[0].n,
    ),
    4,
  );
  console.log(
    `${checks} data-integrity assertions passed: complete 1,205-member/10k-event analytics, Cairo boundaries, refunds, role denial and numeric constraints.`,
  );
} finally {
  await db.close();
}
