import assert from "node:assert/strict";
import { createTestDatabase } from "./test-database.mjs";
const db = await createTestDatabase();
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const scalar = async (sql, args = []) => Object.values((await db.query(sql, args)).rows[0])[0];
const as = (n) =>
  db.exec(
    `RESET ROLE;SELECT set_config('request.jwt.claim.sub','${id(n)}',false);SET ROLE authenticated`,
  );
let checks = 0;
const eq = (a, b) => {
  assert.deepEqual(a, b);
  checks++;
};
const denied = async (sql, args = []) => {
  await assert.rejects(db.query(sql, args));
  checks++;
};
try {
  await db.exec("ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created");
  for (let n = 1; n <= 5; n++)
    await db.exec(
      `INSERT INTO auth.users(id,email) VALUES('${id(n)}','expansion-${n}@test.invalid');INSERT INTO public.profiles(id) VALUES('${id(n)}');INSERT INTO public.user_roles(user_id,role) VALUES('${id(n)}','${n === 1 ? "admin" : n === 4 ? "coach" : "member"}')`,
    );
  await as(1);
  eq((await scalar("SELECT public.get_training_features()")).cardio, true);
  await as(2);
  eq((await scalar("SELECT public.get_training_features()")).cardio, false);
  await denied("SELECT public.food_scan_allowance()");
  await as(1);
  await db.exec("UPDATE public.training_rollout SET enabled=true");
  const day = await scalar("SELECT (now() AT TIME ZONE 'Africa/Cairo')::date::text");
  const data = {
    activity: "run",
    log_date: day,
    duration_seconds: 600,
    distance_m: 1000,
    notes: "",
  };
  const save = (n, expected, value, mutation) =>
    scalar("SELECT public.save_cardio_log($1,$2,$3::jsonb,$4)", [
      id(n),
      expected,
      value == null ? null : JSON.stringify(value),
      id(mutation),
    ]);
  const social = (op, data = {}) =>
    scalar("SELECT public.social_action($1,$2::jsonb)", [op, JSON.stringify(data)]);
  await as(2);
  await db.query("SELECT public.food_scan_allowance()");
  checks++;
  const result = await save(20, 0, data, 30);
  eq(await scalar("SELECT count(*)::int FROM public.xp_events WHERE member_id=$1", [id(2)]), 0);
  eq(result.status, "applied");
  eq(result.revision, 1);
  eq(await save(20, 0, data, 30), result);
  await denied("SELECT public.save_cardio_log($1,0,$2::jsonb,$3)", [
    id(20),
    JSON.stringify({ ...data, duration_seconds: 700 }),
    id(30),
  ]);
  eq((await save(20, 0, data, 31)).status, "conflict");
  await save(
    23,
    0,
    {
      ...data,
      activity: "hiit",
      duration_seconds: 130,
      intervals: { work: 30, rest: 60, rounds: 2, prepare: 10 },
    },
    35,
  );
  await as(4);
  eq(await scalar("SELECT count(*)::int FROM public.cardio_logs"), 0);
  await as(1);
  await db.exec(
    `INSERT INTO public.coach_assignments(coach_id,member_id) VALUES('${id(4)}','${id(2)}')`,
  );
  await as(4);
  eq(await scalar("SELECT count(*)::int FROM public.cardio_logs"), 2);
  await as(1);
  await db.exec(
    `DELETE FROM public.coach_assignments WHERE coach_id='${id(4)}' AND member_id='${id(2)}'`,
  );
  await as(4);
  eq(await scalar("SELECT count(*)::int FROM public.cardio_logs"), 0);
  await as(2);
  await denied(
    "INSERT INTO public.cardio_logs(id,member_id,activity,log_date,duration_seconds) VALUES($1,$2,'run',current_date,600)",
    [id(21), id(2)],
  );
  await denied("SELECT public.save_cardio_log($1,0,$2::jsonb,$3)", [
    id(22),
    JSON.stringify({
      ...data,
      activity: "hiit",
      intervals: { work: null, rest: 0, rounds: 2, prepare: 0 },
    }),
    id(32),
  ]);
  await denied("SELECT public.save_cardio_log($1,0,$2::jsonb,$3)", [
    id(22),
    JSON.stringify({
      ...data,
      activity: "hiit",
      intervals: { work: 30, rest: 30, rounds: 2, prepare: 10 },
    }),
    id(32),
  ]);
  await as(3);
  eq(await scalar("SELECT count(*)::int FROM public.cardio_logs"), 0);
  await denied("SELECT public.save_cardio_log($1,1,$2::jsonb,$3)", [
    id(20),
    JSON.stringify(data),
    id(33),
  ]);
  let s = await social("state");
  eq(s.account.discoverable, false);
  eq(s.account.sharing, false);
  const code3 = s.account.code;
  await social("preferences", { discoverable: true, sharing: true });
  await as(2);
  s = await social("preferences", { discoverable: true, sharing: true });
  const code2 = s.account.code;
  eq((await social("lookup", { code: code3 })).member_id, id(3));
  await social("request", { member_id: id(3) });
  await denied("SELECT public.social_action($1,$2::jsonb)", [
    "accept",
    JSON.stringify({ member_id: id(3) }),
  ]);
  await as(3);
  s = await social("accept", { member_id: id(2) });
  eq(s.friends[0].status, "accepted");
  await as(2);
  s = await social("create_challenge", {
    id: id(40),
    title: "Together",
    metric: "cardio_minutes",
    goal: 10,
    starts_on: day,
    ends_on: day,
  });
  eq(s.challenges[0].progress, 11);
  await social("invite", { id: id(40), member_id: id(3) });
  await as(3);
  await social("join", { id: id(40) });
  s = await social("refresh_challenge", { id: id(40) });
  eq(s.challenges[0].status, "completed");
  await social("block", { member_id: id(2) });
  eq(await social("lookup", { code: code2 }), null);
  eq((await social("state")).friends.length, 0);
  await denied("SELECT * FROM public.social_accounts");
  await as(5);
  await social("preferences", { discoverable: true });
  for (let n = 0; n < 20; n++) await social("lookup", { code: code3 });
  await denied("SELECT public.social_action($1,$2::jsonb)", [
    "lookup",
    JSON.stringify({ code: code3 }),
  ]);
  await social("cancel_creation", { id: id(90) });
  await social("preferences", { sharing: true });
  await social("request", { member_id: id(3) });
  await as(3);
  await social("decline", { member_id: id(5) });
  await as(5);
  await denied("SELECT public.social_action($1,$2::jsonb)", [
    "remove",
    JSON.stringify({ member_id: id(3) }),
  ]);
  await social("block", { member_id: id(3) });
  await social("unblock", { member_id: id(3) });
  await denied("SELECT public.social_action($1,$2::jsonb)", [
    "request",
    JSON.stringify({ member_id: id(3) }),
  ]);
  await as(3);
  s = await social("request", { member_id: id(5) });
  eq(s.friends.find((f) => f.member_id === id(5)).incoming, false);
  await as(5);
  s = await social("accept", { member_id: id(3) });
  eq(s.friends.find((f) => f.member_id === id(3)).status, "accepted");
  await denied("SELECT public.social_action($1,$2::jsonb)", [
    "create_challenge",
    JSON.stringify({
      id: id(90),
      title: "Cancelled request",
      metric: "cardio_minutes",
      goal: 1,
      starts_on: day,
      ends_on: day,
    }),
  ]);
  await as(1);
  await db.exec(`UPDATE public.profiles SET access_active=false WHERE id='${id(2)}'`);
  await as(2);
  await denied("SELECT public.social_action('state')");
  await denied("SELECT public.save_cardio_log($1,1,$2::jsonb,$3)", [
    id(20),
    JSON.stringify(data),
    id(34),
  ]);
  await db.exec("RESET ROLE;SET ROLE anon");
  await denied("SELECT public.social_action('state')");
  await db.exec("RESET ROLE");
  eq(
    await scalar(
      "SELECT count(*)::int FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('save_cardio_log','social_action','get_cardio_history','food_scan_allowance') AND p.prosecdef",
    ),
    0,
  );
  console.log(`Experience expansion: ${checks} checks passed`);
} finally {
  await db.close();
}
