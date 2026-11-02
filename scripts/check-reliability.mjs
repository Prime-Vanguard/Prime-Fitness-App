import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { createTestDatabase } from "./test-database.mjs";

const dir = new URL("../supabase/migrations/", import.meta.url);
const migration = (await readdir(dir)).find((f) => f.endsWith("_reliability_fixes.sql"));
const db = await createTestDatabase(migration);
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const admin = id(1),
  member = id(2),
  outsider = id(3),
  program = id(10),
  exercise = id(20),
  session = id(30),
  set = id(31);
let checks = 0;
const eq = (a, b) => {
  assert.deepEqual(a, b);
  checks++;
};
const value = async (sql, params = []) => (await db.query(sql, params)).rows[0];
const as = async (uid) =>
  db.exec(
    `RESET ROLE; SELECT set_config('request.jwt.claim.sub','${uid}',false); SET ROLE authenticated;`,
  );
const denied = async (
  sql,
  pattern = /policy|permission|Only admins|invalid|Invalid|Backup|violates|Conflicting|immutable/,
) => {
  await assert.rejects(db.exec(sql), pattern);
  checks++;
};
try {
  await db.exec(`ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created;
    INSERT INTO auth.users(id,email) VALUES('${admin}','admin@test.invalid'),('${member}','member@test.invalid'),('${outsider}','other@test.invalid');
    INSERT INTO public.profiles(id,display_name,access_active) VALUES('${admin}','Admin',true),('${member}','Member',true),('${outsider}','Other',true);
    INSERT INTO public.user_roles(user_id,role) VALUES('${admin}','admin');
    INSERT INTO public.exercises(id,name_en,muscle,equipment) VALUES('${exercise}','Original bench','chest','barbell');
    INSERT INTO public.programs(id,name,weeks,created_by) VALUES('${program}','Original routine',2,'${admin}');
    INSERT INTO public.program_items(program_id,week,day,exercise_id,target_sets) VALUES('${program}',1,1,'${exercise}',3),('${program}',2,1,'${exercise}',5);
    INSERT INTO public.program_assignments(program_id,member_id,assigned_by) VALUES('${program}','${member}','${admin}');`);
  await db.exec(await readFile(new URL(migration, dir), "utf8"));
  const version = (
    await value(
      `SELECT program_version_id AS id FROM public.program_assignments WHERE member_id='${member}'`,
    )
  ).id;
  eq(
    (
      await value(
        `SELECT items->0->>'name_en' AS name FROM public.program_versions WHERE id='${version}'`,
      )
    ).name,
    "Original bench",
  );
  await as(admin);
  await db.exec(
    `UPDATE public.program_items SET target_sets=9 WHERE program_id='${program}' AND week=1; UPDATE public.exercises SET name_en='Changed bench' WHERE id='${exercise}'; UPDATE public.programs SET name='Changed routine' WHERE id='${program}';`,
  );
  eq(
    await value(
      `SELECT items->0->>'target_sets' AS sets,name FROM public.program_versions WHERE id='${version}'`,
    ),
    { sets: "3", name: "Original routine" },
  );
  const v2 = (await value(`SELECT public.publish_program('${program}') AS id`)).id;
  eq((await value(`SELECT public.publish_program('${program}') AS id`)).id, v2);
  await denied(`UPDATE public.program_versions SET name='Tampered' WHERE id='${version}'`);
  await denied(`SELECT public.assign_program_version('${member}','${id(999)}')`, /no rows/);
  eq(
    (
      await value(
        `SELECT program_version_id AS id FROM public.program_assignments WHERE member_id='${member}' AND active`,
      )
    ).id,
    version,
  );
  await db.exec(
    `RESET ROLE; CREATE FUNCTION public.fail_week_copy() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.week=2 THEN RAISE EXCEPTION 'simulated copy failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER fail_week_copy BEFORE INSERT ON public.program_items FOR EACH ROW EXECUTE FUNCTION public.fail_week_copy();`,
  );
  await as(admin);
  await denied(`SELECT public.copy_program_week_one('${program}')`, /simulated copy failure/);
  eq(
    (
      await value(
        `SELECT target_sets FROM public.program_items WHERE program_id='${program}' AND week=2`,
      )
    ).target_sets,
    5,
  );
  await db.exec(`RESET ROLE; DROP TRIGGER fail_week_copy ON public.program_items;`);
  await as(admin);
  await db.exec(`SELECT public.copy_program_week_one('${program}')`);
  eq(
    (
      await value(
        `SELECT target_sets FROM public.program_items WHERE program_id='${program}' AND week=2`,
      )
    ).target_sets,
    9,
  );
  // Force an insert failure after deactivation to prove transaction rollback.
  await db.exec(
    `RESET ROLE; CREATE FUNCTION public.fail_assignment() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'simulated assignment failure'; END $$; CREATE TRIGGER fail_assignment BEFORE INSERT ON public.program_assignments FOR EACH ROW EXECUTE FUNCTION public.fail_assignment();`,
  );
  await as(admin);
  await denied(
    `SELECT public.assign_program_version('${member}','${v2}')`,
    /simulated assignment failure/,
  );
  eq(
    (
      await value(
        `SELECT program_version_id AS id FROM public.program_assignments WHERE member_id='${member}' AND active`,
      )
    ).id,
    version,
  );
  await db.exec(`RESET ROLE; DROP TRIGGER fail_assignment ON public.program_assignments;`);
  await as(admin);
  const assignment = (
    await value(`SELECT public.assign_program_version('${member}','${v2}') AS id`)
  ).id;
  eq(
    (await value(`SELECT public.assign_program_version('${member}','${v2}') AS id`)).id,
    assignment,
  );
  eq(
    Number(
      (
        await value(
          `SELECT count(*) AS n FROM public.program_assignments WHERE member_id='${member}' AND active`,
        )
      ).n,
    ),
    1,
  );
  await as(member);
  await denied(`SELECT public.publish_program('${program}')`);
  await denied(`SELECT public.assign_program_version('${outsider}','${v2}')`);
  eq(Number((await value(`SELECT count(*) AS n FROM public.program_versions`)).n), 2);
  await as(outsider);
  eq(Number((await value(`SELECT count(*) AS n FROM public.program_versions`)).n), 0);
  await as(member);
  await db.exec(`INSERT INTO public.workout_sessions(id,member_id,title,started_at) VALUES('${session}','${member}','Test','2026-10-01T10:00:00Z');
    INSERT INTO public.set_logs(id,session_id,member_id,exercise_id,set_number,reps,weight_kg) VALUES('${set}','${session}','${member}','${exercise}',1,5,100);
    UPDATE public.workout_sessions SET finished_at='2026-10-01T11:00:00Z' WHERE id='${session}';
    INSERT INTO public.food_logs(member_id,name,calories) SELECT '${member}','Meal '||n,500 FROM generate_series(1,1105) n;
    INSERT INTO public.water_logs(member_id,ml) VALUES('${member}',250);
    INSERT INTO public.body_measurements(member_id,weight_kg,waist_cm) VALUES('${member}',80,85);
    INSERT INTO public.saved_meals(member_id,name,kind,items) VALUES('${member}','Shake','food','[{"name":"Whey","calories":100,"protein_g":20,"carbs_g":0,"fat_g":0}]');`);
  const backup = (await value(`SELECT public.export_personal_data() AS data`)).data;
  eq(backup.food_logs.length, 1105);
  eq(backup.workout_sessions.length, 1);
  eq(backup.set_logs.length, 1);
  eq(backup.profile.id, member);
  const rewardCount = Number(
    (await value(`SELECT count(*) AS n FROM public.xp_events WHERE member_id='${member}'`)).n,
  );
  // Simulate lost personal rows while preserving historical awards.
  await db.exec(
    `DELETE FROM public.set_logs WHERE id='${set}'; DELETE FROM public.food_logs WHERE member_id='${member}'; DELETE FROM public.water_logs WHERE member_id='${member}'; DELETE FROM public.saved_meals WHERE member_id='${member}';`,
  );
  const restore = async (data) =>
    db.query("SELECT public.restore_personal_data($1::jsonb,false) AS result", [
      JSON.stringify(data),
    ]);
  await restore(backup);
  eq(
    Number(
      (await value(`SELECT count(*) AS n FROM public.food_logs WHERE member_id='${member}'`)).n,
    ),
    1105,
  );
  eq(
    Number(
      (await value(`SELECT count(*) AS n FROM public.set_logs WHERE member_id='${member}'`)).n,
    ),
    1,
  );
  eq(
    (
      await value(
        `SELECT finished_at='2026-10-01T11:00:00Z'::timestamptz AS finish FROM public.workout_sessions WHERE id='${session}'`,
      )
    ).finish,
    true,
  );
  eq(
    Number(
      (await value(`SELECT count(*) AS n FROM public.xp_events WHERE member_id='${member}'`)).n,
    ),
    rewardCount,
  );
  const repeated = (await restore(backup)).rows[0].result;
  eq(
    Object.values(repeated.inserted).every((n) => n === 0),
    true,
  );
  await db.exec(`RESET ROLE; DELETE FROM public.workout_sessions WHERE id='${session}';`);
  await as(member);
  await restore(backup);
  eq(
    Number(
      (
        await value(
          `SELECT count(*) AS n FROM public.workout_sessions WHERE id='${session}' AND finished_at IS NOT NULL`,
        )
      ).n,
    ),
    1,
  );
  eq(
    Number(
      (await value(`SELECT count(*) AS n FROM public.xp_events WHERE member_id='${member}'`)).n,
    ),
    rewardCount,
  );
  const bad = structuredClone(backup);
  bad.food_logs[0].member_id = outsider;
  await assert.rejects(restore(bad), /foreign/);
  checks++;
  const broken = structuredClone(backup);
  broken.set_logs.push({ ...broken.set_logs[0], id: id(990), exercise_id: id(999) });
  broken.water_logs.push({ ...broken.water_logs[0], id: id(991) });
  await assert.rejects(restore(broken), /foreign key/);
  checks++;
  eq(
    Number((await value(`SELECT count(*) AS n FROM public.water_logs WHERE id='${id(991)}'`)).n),
    0,
  );
  eq(
    Number(
      (
        await value(
          `SELECT count(*) AS n FROM public.workout_sessions WHERE id='${session}' AND finished_at IS NOT NULL`,
        )
      ).n,
    ),
    1,
  );
  const tamper = structuredClone(backup);
  tamper.profile.access_active = false;
  tamper.user_roles = [{ user_id: member, role: "super_admin" }];
  tamper.pv_ledger = [{ member_id: member, points: 999999 }];
  await restore(tamper);
  eq(
    (await value(`SELECT access_active FROM public.profiles WHERE id='${member}'`)).access_active,
    true,
  );
  eq(
    Number(
      (await value(`SELECT count(*) AS n FROM public.user_roles WHERE user_id='${member}'`)).n,
    ),
    0,
  );
  eq(
    Number(
      (
        await value(
          `SELECT coalesce(sum(points),0) AS n FROM public.pv_ledger WHERE member_id='${member}'`,
        )
      ).n,
    ),
    0,
  );
  await as(outsider);
  eq((await value("SELECT public.export_personal_data() AS data")).data.food_logs.length, 0);
  await assert.rejects(restore(backup), /foreign/);
  checks++;
  await db.exec("RESET ROLE");
  eq(
    Number(
      (
        await value(
          `SELECT count(*) AS n FROM pg_proc p JOIN pg_namespace ns ON ns.oid=p.pronamespace WHERE ns.nspname='public' AND p.proname IN('export_personal_data','restore_personal_data','assign_program_version','publish_program','copy_program_week_one') AND p.prosecdef`,
        )
      ).n,
    ),
    0,
  );
  eq(
    Number(
      (
        await value(
          "SELECT count(*) AS n FROM pg_constraint c JOIN pg_namespace ns ON ns.oid=c.connamespace WHERE c.contype='f' AND ns.nspname='public' AND NOT EXISTS(SELECT 1 FROM pg_index i WHERE i.indrelid=c.conrelid AND i.indisvalid AND i.indisready AND i.indpred IS NULL AND c.conkey <@ (i.indkey::smallint[])[0:cardinality(c.conkey)-1])",
        )
      ).n,
    ),
    0,
  );
  eq(
    Number(
      (
        await value(
          "SELECT count(*) AS n FROM pg_class c JOIN pg_namespace ns ON ns.oid=c.relnamespace WHERE ns.nspname='public' AND c.relkind='r' AND NOT c.relrowsecurity",
        )
      ).n,
    ),
    0,
  );
  await as(admin);
  await db.exec(`UPDATE public.profiles SET access_active=false WHERE id='${member}'`);
  await as(member);
  await assert.rejects(restore(backup), /active membership/);
  checks++;
  await db.exec("RESET ROLE; SET ROLE anon");
  await denied("SELECT public.export_personal_data()");
  console.log(
    `${checks} reliability assertions passed: version backfill/isolation, atomic rollback, complete export, restore retry, reward deduplication and ownership.`,
  );
} catch (error) {
  console.error(error.message, error.where ?? "");
  process.exitCode = 1;
} finally {
  await db.close();
}
