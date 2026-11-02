import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { createTestDatabase } from "./test-database.mjs";

const migration = (await readdir(new URL("../supabase/migrations/", import.meta.url))).find(
  (name) => name.endsWith("_million_xp_progression.sql"),
);
const db = await createTestDatabase(migration);
let checks = 0;
const eq = (actual, expected) => {
  assert.deepEqual(actual, expected);
  checks++;
};
const scalar = async (sql) => Object.values((await db.query(sql)).rows[0])[0];
const total = async (id) =>
  Number(
    await scalar(`SELECT coalesce(sum(amount),0) FROM public.xp_events WHERE member_id='${id}'`),
  );
const denied = async (sql) => {
  await assert.rejects(db.exec(sql), /permission|policy|not allowed|cannot update view/i);
  checks++;
};
const member = randomUUID();
async function as(id) {
  await db.exec(
    `RESET ROLE; SELECT set_config('request.jwt.claim.sub','${id}',false); SET ROLE authenticated;`,
  );
}
async function workout(day, reps = 5, finish = true, id = randomUUID()) {
  await db.exec(`INSERT INTO public.workout_sessions(id,member_id,title,started_at)
    VALUES ('${id}','${member}','Progression test',('${day}'::date::timestamp AT TIME ZONE 'Africa/Cairo'));
    INSERT INTO public.set_logs(session_id,member_id,exercise_id,set_number,reps,weight_kg)
    SELECT '${id}','${member}',id,1,${reps},20 FROM public.exercises LIMIT 1;`);
  if (finish)
    await db.exec(`UPDATE public.workout_sessions SET finished_at=now() WHERE id='${id}'`);
  return id;
}
async function food(day, calories = 500) {
  await db.exec(
    `INSERT INTO public.food_logs(member_id,log_date,name,calories) VALUES ('${member}','${day}','Meal',${calories})`,
  );
}
async function body(day, weight = 80) {
  await db.exec(
    `INSERT INTO public.body_measurements(member_id,measured_on,weight_kg) VALUES ('${member}','${day}',${weight})`,
  );
}
try {
  await db.exec("ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created");
  const legacy = [0, 75, 100, 5000, 85381, 98504, 2000000];
  const oldMembers = [];
  for (const xp of legacy) {
    const id = randomUUID();
    oldMembers.push(id);
    await db.exec(`INSERT INTO auth.users(id) VALUES ('${id}'); INSERT INTO public.profiles(id) VALUES ('${id}');
      INSERT INTO public.xp_events(member_id,amount,source,source_ref) VALUES ('${id}',${xp},'legacy','original')`);
  }
  const oldLevels = await db.query(`SELECT e.member_id,max(t.level) AS level FROM public.xp_events e
    JOIN public.level_thresholds t ON t.xp_required <= e.amount GROUP BY e.member_id ORDER BY e.member_id`);
  await db.exec(`INSERT INTO public.xp_events(member_id,amount,source,source_ref) VALUES
    ('${oldMembers[6]}',50,'workout','${randomUUID()}'),
    ('${oldMembers[6]}',10,'nutrition_day',current_date::text),
    ('${oldMembers[6]}',10,'body_check',current_date::text)`);
  await db.exec(
    `INSERT INTO auth.users(id) VALUES ('${member}'); INSERT INTO public.profiles(id) VALUES ('${member}');`,
  );
  const original = (await db.query("SELECT * FROM public.xp_events ORDER BY id")).rows;
  const originalBoard = (
    await db.query("SELECT * FROM public.leaderboard_weekly ORDER BY member_id,week_start")
  ).rows;
  await db.exec(
    await readFile(new URL(`../supabase/migrations/${migration}`, import.meta.url), "utf8"),
  );
  const followup = (await readdir(new URL("../supabase/migrations/", import.meta.url))).find(
    (name) => name.endsWith("_exclude_level_transition_from_leaderboards.sql"),
  );
  await db.exec(
    await readFile(new URL(`../supabase/migrations/${followup}`, import.meta.url), "utf8"),
  );
  eq(
    (await db.query("SELECT * FROM public.leaderboard_weekly ORDER BY member_id,week_start")).rows,
    originalBoard,
  );
  eq(
    (
      await db.query(
        "SELECT * FROM public.xp_events WHERE source!='level_curve_transition' ORDER BY id",
      )
    ).rows,
    original,
  );
  eq(
    Number(
      await scalar(
        `SELECT count(*) FROM private.xp_activity_credits WHERE member_id='${oldMembers[6]}'`,
      ),
    ),
    3,
  );
  const newLevels = (
    await db.query(`SELECT e.member_id,max(t.level) AS level FROM
    (SELECT member_id,sum(amount) AS amount FROM public.xp_events GROUP BY member_id) e
    JOIN public.level_thresholds t ON t.xp_required <= e.amount GROUP BY e.member_id ORDER BY e.member_id`)
  ).rows;
  eq(newLevels, oldLevels.rows);
  eq(await total(oldMembers[0]), 0);
  eq(await total(oldMembers[1]), 75);
  await db.exec(`INSERT INTO public.xp_events(member_id,amount,source,source_ref)
    VALUES ('${oldMembers[6]}',123,'level_curve_transition','future-check')`);
  eq(
    (await db.query("SELECT * FROM public.leaderboard_weekly ORDER BY member_id,week_start")).rows,
    originalBoard,
  );
  const thresholds = (await db.query("SELECT * FROM public.level_thresholds ORDER BY level")).rows;
  eq(thresholds.length, 100);
  eq(new Set(thresholds.map((t) => t.xp_required)).size, 100);
  eq(thresholds[0].xp_required, 0);
  eq(thresholds[90].xp_required, 842400);
  eq(thresholds[99].xp_required, 1000000);
  eq(
    thresholds.every(
      (t, i) => !t.provisional && (!i || t.xp_required > thresholds[i - 1].xp_required),
    ),
    true,
  );
  const rules = (await db.query("SELECT * FROM public.xp_rules")).rows[0];
  eq(
    [rules.workout_xp, rules.nutrition_day_xp, rules.body_week_xp, rules.workout_weekly_cap],
    [3500, 650, 600, 5],
  );
  const weekly = 4 * rules.workout_xp + 7 * rules.nutrition_day_xp + rules.body_week_xp;
  eq(weekly, 19150);
  // Includes 17k in earned fitness milestones; PV task approval is optional.
  eq(Math.ceil((1000000 - 17000) / weekly), 52);

  const today = await scalar("SELECT (now() AT TIME ZONE 'Africa/Cairo')::date::text");
  const date = async (offset) => scalar(`SELECT ('${today}'::date + ${offset})::text`);
  await as(member);
  const session = await workout(today);
  eq(await total(member), 4000);
  await db.exec(`UPDATE public.workout_sessions SET finished_at=NULL WHERE id='${session}';
    UPDATE public.workout_sessions SET finished_at=now() WHERE id='${session}'`);
  await workout(today);
  eq(await total(member), 4000);
  await db.exec(`DELETE FROM public.workout_sessions WHERE id='${session}'`);
  await workout(today);
  eq(await total(member), 4000);
  await food(today, 0);
  await body(today, 0);
  eq(await total(member), 4000);
  await food(today);
  eq(await total(member), 4900);
  await food(today);
  await db.exec(`DELETE FROM public.food_logs WHERE member_id='${member}'`);
  await food(today);
  eq(await total(member), 4900);
  await body(today);
  eq(await total(member), 5750);
  const backup = (await db.query("SELECT public.export_personal_data() AS data")).rows[0].data;
  await db.exec(`DELETE FROM public.workout_sessions WHERE member_id='${member}';
    DELETE FROM public.food_logs WHERE member_id='${member}';
    DELETE FROM public.body_measurements WHERE member_id='${member}'`);
  await db.query("SELECT public.restore_personal_data($1::jsonb,false)", [JSON.stringify(backup)]);
  await db.query("SELECT public.restore_personal_data($1::jsonb,false)", [JSON.stringify(backup)]);
  eq(await total(member), 5750);
  await db.exec(`DELETE FROM public.body_measurements WHERE member_id='${member}'`);
  await body(today);
  eq(await total(member), 5750);
  await food(await date(1));
  await body(await date(1));
  await workout(await date(1));
  await food(await date(-8));
  await body(await date(-8));
  await workout(await date(-8));
  eq(await total(member), 5750);
  await denied(
    `INSERT INTO public.xp_events(member_id,amount,source,source_ref) VALUES ('${member}',1000000,'hack','1')`,
  );
  await denied(`SELECT public.award_xp('${member}',1000000,'hack','1')`);
  await denied(`SELECT private.claim_activity_xp('${member}','workout','${today}','hack')`);
  await denied("SELECT * FROM private.xp_activity_credits");
  await denied("DELETE FROM private.xp_activity_credits");
  await denied("UPDATE public.xp_rules SET workout_xp=1000000");

  // Expand the test-only window to exercise full past calendar weeks on any run date.
  await db.exec(`RESET ROLE; CREATE OR REPLACE VIEW public.xp_rules WITH(security_invoker=true) AS SELECT
    'million-xp-v1'::text AS policy_version,1000000::integer AS level_100_xp,
    3500::integer AS workout_xp,5::integer AS workout_weekly_cap,650::integer AS nutrition_day_xp,
    600::integer AS body_week_xp,400::integer AS offline_grace_days,'2020-01-01'::date AS effective_from;`);
  const monday = await scalar(`SELECT (date_trunc('week','${today}'::date)::date - 14)::text`);
  const days = [];
  for (let i = 0; i < 7; i++) days.push(await scalar(`SELECT ('${monday}'::date + ${i})::text`));
  await as(member);
  let before = await total(member);
  await workout(days[0], 0);
  eq(await total(member), before);
  for (const day of days) await workout(day);
  eq(await total(member), before + 5 * 3500);
  before = await total(member);
  await body(days[0]);
  await body(days[6]);
  eq(await total(member), before + 600);
  await body(await scalar(`SELECT ('${monday}'::date + 7)::text`));
  eq(await total(member), before + 1200);

  // Milestones count durable credits and award exactly once, including after source deletion.
  await db.exec(`RESET ROLE; INSERT INTO private.xp_activity_credits
    SELECT '${member}','workout','2021-01-01'::date+n FROM generate_series(0,2) n;
    INSERT INTO private.xp_activity_credits
    SELECT '${member}','nutrition_day','2022-01-01'::date+n FROM generate_series(0,27) n;`);
  await as(member);
  before = await total(member);
  const nextWeek = await scalar(`SELECT ('${monday}'::date + 7)::text`);
  await workout(nextWeek);
  eq(await total(member), before + 3500 + 1500);
  await workout(nextWeek);
  eq(await total(member), before + 5000);
  before = await total(member);
  await food(nextWeek);
  eq(await total(member), before + 650 + 3000);
  await food(nextWeek);
  eq(await total(member), before + 3650);

  const pausedSession = await workout(
    await scalar(`SELECT ('${monday}'::date + 8)::text`),
    5,
    false,
  );
  await db.exec(`RESET ROLE; INSERT INTO public.user_roles(user_id,role) VALUES ('${oldMembers[0]}','super_admin');
    SELECT set_config('request.jwt.claim.sub','${oldMembers[0]}',false);
    UPDATE public.profiles SET access_active=false WHERE id='${member}'`);
  await as(member);
  before = await total(member);
  await db.exec(`UPDATE public.workout_sessions SET finished_at=now() WHERE id='${pausedSession}'`);
  eq(await total(member), before);
  await denied(
    `INSERT INTO public.food_logs(member_id,name,calories) VALUES ('${member}','Paused',100)`,
  );
  await db.exec("RESET ROLE");
  eq(
    await scalar(
      `SELECT relrowsecurity FROM pg_class WHERE oid='private.xp_activity_credits'::regclass`,
    ),
    true,
  );
  eq(
    Number(
      await scalar(`SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.prosecdef AND has_function_privilege('authenticated',p.oid,'EXECUTE')`),
    ),
    0,
  );
  console.log(
    `${checks} progression assertions passed: migration, caps, retries, milestones, privacy, paused access and 52-week pacing.`,
  );
} finally {
  await db.close();
}
