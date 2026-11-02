import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import assert from "node:assert/strict";

// Isolated Postgres/WASM: no remote credentials, no writes to the live project.
const db = new PGlite();
let checks = 0;
const a = "00000000-0000-4000-8000-000000000001";
const b = "00000000-0000-4000-8000-000000000002";
const outsider = "00000000-0000-4000-8000-000000000003";
const pod = "00000000-0000-4000-8000-000000000010";
const session = "00000000-0000-4000-8000-000000000020";
const eq = (actual, expected) => {
  assert.deepEqual(actual, expected);
  checks++;
};
async function as(user) {
  await db.exec(
    `RESET ROLE; SELECT set_config('request.jwt.claim.sub','${user}',false); SET ROLE authenticated;`,
  );
}
async function count(table) {
  return Number((await db.query(`SELECT count(*) AS n FROM ${table}`)).rows[0].n);
}
async function denied(
  sql,
  pattern = /policy|permission|Not allowed|monthly|activity|streak|Shields/,
) {
  await assert.rejects(db.exec(sql), pattern);
  checks++;
}
try {
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth; CREATE SCHEMA storage;
    GRANT USAGE ON SCHEMA auth,storage,public TO authenticated,anon,service_role;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    CREATE TABLE auth.users(id uuid PRIMARY KEY, email text, raw_user_meta_data jsonb DEFAULT '{}',raw_app_meta_data jsonb DEFAULT '{}');
    CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean DEFAULT false,file_size_limit bigint,allowed_mime_types text[]);
    CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bucket_id text,name text);
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    CREATE FUNCTION storage.foldername(text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$ SELECT string_to_array($1,'/') $$;
    CREATE FUNCTION public.rls_auto_enable() RETURNS event_trigger LANGUAGE plpgsql AS $$ BEGIN END $$;
  `);
  const files = (await readdir(new URL("../supabase/migrations/", import.meta.url)))
    .filter((name) => name.endsWith(".sql"))
    .sort();
  for (const file of files) {
    try {
      await db.exec(
        await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), "utf8"),
      );
    } catch (error) {
      throw new Error(`Migration ${file}: ${error.message}`, { cause: error });
    }
  }
  await db.exec(`
    ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created;
    INSERT INTO auth.users(id,email) VALUES ('${a}','a@test.invalid'),('${b}','b@test.invalid'),('${outsider}','c@test.invalid');
    INSERT INTO public.profiles(id,display_name,onboarding_completed,pod_feed_opt_in,leaderboard_opt_in) VALUES ('${a}','Member A',true,true,true),('${b}','Member B',true,true,true),('${outsider}','Outsider',true,true,true);
    INSERT INTO public.pods(id,name,leader_id) VALUES ('${pod}','Test Pod','${a}');
    INSERT INTO public.pod_members(pod_id,member_id) VALUES ('${pod}','${b}');
  `);
  await as(a);
  await db.exec(
    `INSERT INTO public.saved_meals(member_id,name,kind,items) VALUES ('${a}','Shake','food','[{"name":"Whey","calories":120,"protein_g":24,"carbs_g":3,"fat_g":1}]')`,
  );
  eq(await count("public.saved_meals"), 1);
  await denied(
    `INSERT INTO public.saved_meals(member_id,name,kind,items) VALUES ('${b}','Spoof','food','[{}]')`,
  );
  await as(b);
  eq(await count("public.saved_meals"), 0);
  await db.exec(`UPDATE public.saved_meals SET member_id='${b}' WHERE member_id='${a}'`);
  eq(await count("public.saved_meals"), 0);
  await as(a);
  eq(await count("public.pods"), 1); // Regression: no recursive pod policy.
  await db.exec(
    `INSERT INTO public.workout_sessions(id,member_id,title) VALUES ('${session}','${a}','Leg Day')`,
  );
  const exercise = (await db.query("SELECT id FROM public.exercises LIMIT 1")).rows[0].id;
  await db.exec(
    `INSERT INTO public.set_logs(session_id,member_id,exercise_id,set_number,reps,weight_kg) VALUES ('${session}','${a}','${exercise}',1,5,100); UPDATE public.workout_sessions SET finished_at=now() WHERE id='${session}'`,
  );
  eq(await count("public.pod_activity"), 1);
  eq(Number((await db.query("SELECT xp FROM public.member_xp_totals")).rows[0].xp), 4000); // 3500 workout + 500 first-workout badge.
  await db.exec(`UPDATE public.workout_sessions SET notes='Changed note' WHERE id='${session}'`);
  eq(await count("public.pod_activity"), 1);
  await denied(
    `INSERT INTO public.pod_activity(pod_id,member_id,display_name,title,xp,event_id) VALUES ('${pod}','${a}','fake','fake',500,1)`,
  );
  await as(b);
  eq(await count("public.pod_activity"), 1);
  eq(await count("public.pod_leaderboard"), 1);
  await as(outsider);
  eq(await count("public.pod_activity"), 0);
  eq(await count("public.pod_leaderboard"), 0);
  await as(a);
  await db.exec(`UPDATE public.profiles SET pod_feed_opt_in=false WHERE id='${a}'`);
  await as(b);
  eq(await count("public.pod_activity"), 0);
  await db.exec(`RESET ROLE; DELETE FROM public.pod_members WHERE member_id='${b}';`);
  await as(b);
  eq(await count("public.pod_leaderboard"), 0);

  // Two monthly shields are enforced in the database, not by the UI counter.
  // Seed historical consumption as the owner to test month-cap behavior.
  const day = (await db.query("SELECT (now() AT TIME ZONE 'Africa/Cairo')::date::text AS day"))
    .rows[0].day;
  // Pick a permitted day with a preceding day in the same month, including Nov 1/2.
  const protectedDay = (
    await db.query(
      `SELECT (CASE WHEN extract(day FROM '${day}'::date)=2 THEN '${day}'::date ELSE '${day}'::date-1 END)::text AS day`,
    )
  ).rows[0].day;
  const monthBoundary = day.slice(0, 7) !== protectedDay.slice(0, 7);
  const cappedDay = monthBoundary ? protectedDay : day;
  await db.exec(`RESET ROLE; ALTER TABLE public.streak_shields DISABLE TRIGGER validate_streak_shield;
    INSERT INTO public.streak_shields(member_id,shield_date) VALUES ('${b}', date_trunc('month', '${protectedDay}'::date)::date - interval '1 month'),('${b}', '${protectedDay}'::date - 1);
    ALTER TABLE public.streak_shields ENABLE TRIGGER validate_streak_shield;`);
  await as(b);
  await db.exec(
    `INSERT INTO public.streak_shields(member_id,shield_date) VALUES ('${b}', '${protectedDay}')`,
  );
  eq(await count("public.streak_shields"), 3);
  await denied(
    `INSERT INTO public.streak_shields(member_id,shield_date) VALUES ('${b}','${cappedDay}')`,
    /monthly/,
  );
  if (monthBoundary) {
    await db.exec(
      `INSERT INTO public.streak_shields(member_id,shield_date) VALUES ('${b}','${day}')`,
    );
    eq(await count("public.streak_shields"), 4);
  }
  await denied(
    `INSERT INTO public.streak_shields(member_id,shield_date) VALUES ('${b}','${day}'::date + 1)`,
  );
  await denied(`DELETE FROM public.streak_shields WHERE member_id='${b}'`);
  await denied(`INSERT INTO public.streak_shields(member_id,shield_date) VALUES ('${a}','${day}')`);
  await as(outsider);
  eq(await count("public.streak_shields"), 0);
  await denied(
    `INSERT INTO public.streak_shields(member_id,shield_date) VALUES ('${outsider}','${day}')`,
    /existing streak/,
  );

  await db.exec(
    `RESET ROLE; INSERT INTO public.user_roles(user_id,role) VALUES ('${a}','super_admin'); SELECT set_config('request.jwt.claim.sub','${a}',false); UPDATE public.profiles SET access_active=false WHERE id='${b}'`,
  );
  await as(b);
  await denied(
    `INSERT INTO public.saved_meals(member_id,name,kind,items) VALUES ('${b}','Paused','food','[{}]')`,
  );
  const flags = await db.query(
    "SELECT relname,relrowsecurity FROM pg_class WHERE relname IN ('saved_meals','streak_shields','pod_activity')",
  );
  eq(
    flags.rows.every((r) => r.relrowsecurity),
    true,
  );
  console.log(
    `All ${files.length} migrations applied in isolated Postgres; ${checks} access, XP, privacy, and shield assertions passed.`,
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await db.close();
}
