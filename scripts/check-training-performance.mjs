import assert from "node:assert/strict";
import { createTestDatabase } from "./test-database.mjs";
const db = await createTestDatabase();
try {
  await db.exec(`ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created;
 CREATE TEMP TABLE actors AS SELECT gen_random_uuid() id,n FROM generate_series(1,201)n;
 INSERT INTO auth.users(id,email) SELECT id,'benchmark-'||n||'@test.invalid' FROM actors;
 INSERT INTO public.profiles(id) SELECT id FROM actors;
 INSERT INTO public.user_roles(user_id,role) SELECT id,CASE WHEN n=1 THEN 'admin'::public.app_role ELSE 'member'::public.app_role END FROM actors;
 INSERT INTO public.exercises(id,name_en,muscle) VALUES('00000000-0000-4000-8000-000000000900','Benchmark lift','quads');
 CREATE TEMP TABLE sessions AS SELECT gen_random_uuid() id,a.id member_id,s.n FROM generate_series(1,20000)s(n) JOIN actors a ON a.n=2+(s.n%200);
 ALTER TABLE public.workout_sessions DISABLE TRIGGER USER;
 INSERT INTO public.workout_sessions(id,member_id,started_at,finished_at) SELECT id,member_id,now()-(n%60)*interval '1 day'-interval '45 minutes',now()-(n%60)*interval '1 day' FROM sessions;
 ALTER TABLE public.workout_sessions ENABLE TRIGGER USER;
 INSERT INTO public.workout_exercises(session_id,member_id,exercise_id,snapshot) SELECT id,member_id,'00000000-0000-4000-8000-000000000900','{"name_en":"Benchmark lift","muscle":"quads","logging_mode":"weighted_reps","load_convention":"external_total"}' FROM sessions;
 ALTER TABLE public.set_logs DISABLE TRIGGER USER;
 INSERT INTO public.set_logs(session_id,member_id,exercise_id,workout_exercise_id,set_number,reps,weight_kg,created_at) SELECT s.id,s.member_id,'00000000-0000-4000-8000-000000000900',w.id,segment.n,10,40,now()-(s.n%60)*interval '1 day' FROM sessions s JOIN public.workout_exercises w ON w.session_id=s.id CROSS JOIN generate_series(1,3)segment(n);
 ALTER TABLE public.set_logs ENABLE TRIGGER USER;
 ALTER TABLE public.food_logs DISABLE TRIGGER USER;
 INSERT INTO public.food_logs(member_id,name,meal,calories,log_date) SELECT a.id,'Benchmark meal','lunch',100,current_date-(g.n%14) FROM generate_series(1,100000)g(n) JOIN actors a ON a.n=2+(g.n%200);
 ALTER TABLE public.food_logs ENABLE TRIGGER USER;
 ALTER TABLE public.xp_events DISABLE TRIGGER USER;
 INSERT INTO public.xp_events(member_id,amount,source,source_ref) SELECT a.id,1,'benchmark',g.n::text FROM generate_series(1,100000)g(n) JOIN actors a ON a.n=2+(g.n%200);
 ALTER TABLE public.xp_events ENABLE TRIGGER USER;
 INSERT INTO public.wellness_checkins(member_id,log_date,sleep_hours,energy) SELECT a.id,current_date-g,7,3 FROM actors a CROSS JOIN generate_series(0,6)g WHERE a.n>1;
 ANALYZE public.workout_sessions;ANALYZE public.set_logs;ANALYZE public.workout_exercises;ANALYZE public.food_logs;ANALYZE public.xp_events;ANALYZE public.wellness_checkins;`);
  const actors = (await db.query("SELECT id,n FROM actors ORDER BY n LIMIT 2")).rows;
  async function as(id) {
    await db.exec(
      `RESET ROLE;SELECT set_config('request.jwt.claim.sub','${id}',false);SET ROLE authenticated`,
    );
  }
  const timings = [];
  async function benchmark(name, sql) {
    await db.query(sql);
    const result = await db.query(`EXPLAIN(ANALYZE,BUFFERS,FORMAT JSON) ${sql}`);
    const plan = result.rows[0]["QUERY PLAN"][0];
    timings.push({
      query: name,
      execution_ms: Math.round(plan["Execution Time"] * 100) / 100,
      rows: plan.Plan["Actual Rows"],
    });
  }
  await as(actors[1].id);
  await benchmark(
    "member completed-workout page",
    `SELECT id,title,started_at FROM public.workout_sessions WHERE member_id=(SELECT auth.uid()) AND finished_at IS NOT NULL ORDER BY started_at DESC,id DESC LIMIT 20`,
  );
  await benchmark(
    "member recent sets with immutable metadata",
    `SELECT s.id,s.reps,s.weight_kg,w.snapshot FROM public.set_logs s JOIN public.workout_sessions x ON x.id=s.session_id LEFT JOIN public.workout_exercises w ON w.id=s.workout_exercise_id WHERE s.member_id=(SELECT auth.uid()) AND x.finished_at>=now()-interval '7 days' ORDER BY s.created_at DESC LIMIT 100`,
  );
  await benchmark(
    "member seven-day wellness",
    `SELECT id,log_date,sleep_hours,energy FROM public.wellness_checkins WHERE member_id=(SELECT auth.uid()) AND log_date>=current_date-6 ORDER BY log_date`,
  );
  await as(actors[0].id);
  await benchmark("complete organization analytics", "SELECT public.get_admin_analytics()");
  const snapshot = (await db.query("SELECT public.get_admin_analytics() data")).rows[0].data;
  assert.equal(snapshot.rows.length, 201);
  assert.equal(snapshot.rows.find((r) => r.id === actors[1].id).xp, 500);
  assert.equal(snapshot.kpi.members, 201);
  assert.ok(snapshot.kpi.workouts30 > 9000);
  console.log(
    JSON.stringify(
      {
        engine: "isolated PGlite; warm-query diagnostics, not production latency guarantees",
        fixtures: {
          members: 201,
          sessions: 20000,
          sets: 60000,
          food_entries: 100000,
          xp_events: 100000,
          wellness_entries: 1400,
        },
        timings,
      },
      null,
      2,
    ),
  );
} finally {
  await db.close();
}
