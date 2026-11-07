import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { createTestDatabase } from "./test-database.mjs";
const db = await createTestDatabase();
try {
  await db.exec(`ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created;
 CREATE TEMP TABLE actors AS SELECT gen_random_uuid() id,n FROM generate_series(1,31)n;
 INSERT INTO auth.users(id,email) SELECT id,'experience-benchmark-'||n||'@test.invalid' FROM actors;
 INSERT INTO public.profiles(id) SELECT id FROM actors;
 INSERT INTO public.user_roles(user_id,role) SELECT id,CASE WHEN n=1 THEN 'admin'::public.app_role ELSE 'member'::public.app_role END FROM actors;
 UPDATE public.training_rollout SET enabled=true;
 INSERT INTO public.cardio_logs(id,member_id,activity,log_date,duration_seconds,distance_m)
 SELECT gen_random_uuid(),a.id,'run',current_date-(g.n%90),600,1000 FROM generate_series(1,10000)g(n) JOIN actors a ON a.n=2+(g.n%30);
 UPDATE public.social_accounts SET sharing=true;
 INSERT INTO public.friend_challenges(id,owner_id,title,metric,goal,starts_on,ends_on) SELECT gen_random_uuid(),a.id,'Fixture challenge','cardio_minutes',10000,current_date-30,current_date FROM actors a CROSS JOIN generate_series(1,20)g WHERE a.n=1;
 INSERT INTO public.challenge_members SELECT c.id,a.id,'accepted' FROM public.friend_challenges c CROSS JOIN actors a WHERE a.n BETWEEN 1 AND 10;
 ANALYZE public.cardio_logs;ANALYZE public.challenge_members;ANALYZE public.friend_challenges;`);
  const actor = (await db.query("SELECT id FROM actors WHERE n=2")).rows[0].id;
  await db.exec(
    `SELECT set_config('request.jwt.claim.sub','${actor}',false);SET ROLE authenticated`,
  );
  const history = (
    await db.query("SELECT public.get_cardio_history(current_date-89,current_date) data")
  ).rows[0].data;
  assert.ok(history.length > 300);
  const timings = [];
  for (const [name, sql] of [
    [
      "member indexed cardio date page",
      `SELECT id,log_date,duration_seconds FROM public.cardio_logs WHERE member_id=(SELECT auth.uid()) AND log_date>=current_date-89 ORDER BY log_date DESC,id LIMIT 100`,
    ],
    [
      "member ninety-day history JSON",
      "SELECT public.get_cardio_history(current_date-89,current_date)",
    ],
    ["twenty shared challenge states", "SELECT public.social_action('state')"],
  ]) {
    await db.query(sql);
    const plan = (await db.query(`EXPLAIN(ANALYZE,BUFFERS,FORMAT JSON) ${sql}`)).rows[0][
      "QUERY PLAN"
    ][0];
    if (name === "member indexed cardio date page")
      assert.match(JSON.stringify(plan), /cardio_logs_member_date_idx/);
    timings.push({
      query: name,
      execution_ms: Math.round(plan["Execution Time"] * 100) / 100,
      rows: plan.Plan["Actual Rows"],
    });
  }
  const report = {
    date: "2026-11-07",
    engine:
      "Isolated PGlite warm-query diagnostics, not hosted latency or concurrent-load guarantees",
    fixtures: { members: 31, cardio_logs: 10000, challenges: 20, participants_per_challenge: 10 },
    timings,
  };
  if (process.argv.includes("--write-report"))
    await writeFile(
      new URL("../docs/performance/experience-expansion-local.json", import.meta.url),
      JSON.stringify(report, null, 2) + "\n",
    );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await db.close();
}
