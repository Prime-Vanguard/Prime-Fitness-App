import assert from "node:assert/strict";
import { createTestDatabase } from "./test-database.mjs";
const db = await createTestDatabase();
let checks = 0;
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
async function as(n) {
  await db.exec(
    `RESET ROLE;SELECT set_config('request.jwt.claim.sub','${id(n)}',false);SET ROLE authenticated`,
  );
}
async function value(sql) {
  return (await db.query(sql)).rows[0];
}
async function denied(sql) {
  await assert.rejects(db.exec(sql));
  checks++;
}
try {
  await db.exec(`ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created;`);
  for (let n = 1; n <= 5; n++)
    await db.exec(
      `INSERT INTO auth.users(id,email) VALUES('${id(n)}','training${n}@test.invalid');INSERT INTO public.profiles(id,access_active) VALUES('${id(n)}',${n !== 5});INSERT INTO public.user_roles(user_id,role) VALUES('${id(n)}','${n === 1 ? "admin" : n === 2 ? "coach" : "member"}')`,
    );
  await as(1);
  await db.exec(
    `UPDATE public.training_rollout SET enabled=true;INSERT INTO public.exercises(id,name_en,name_ar,muscle,equipment) VALUES('${id(10)}','Test squat','Test','quads','barbell');INSERT INTO public.coach_assignments(coach_id,member_id) VALUES('${id(2)}','${id(3)}')`,
  );
  await denied(
    `UPDATE public.exercises SET media='{"url":"https://test.invalid/demo.mp4","license":"unknown"}' WHERE id='${id(10)}'`,
  );
  await as(3);
  await db.exec(
    `INSERT INTO public.workout_sessions(id,member_id) VALUES('${id(20)}','${id(3)}');INSERT INTO public.set_logs(id,session_id,member_id,exercise_id,set_number,reps,weight_kg) VALUES('${id(21)}','${id(20)}','${id(3)}','${id(10)}',1,10,20)`,
  );
  checks++;
  assert.equal((await value(`SELECT count(*)::int n FROM public.workout_exercises`)).n, 1);
  await denied(
    `INSERT INTO public.set_logs(session_id,member_id,exercise_id,set_number,reps,set_role,root_set_id,segment_index) VALUES('${id(20)}','${id(3)}','${id(10)}',2,8,'drop','${id(99)}',1)`,
  );
  await db.exec(
    `INSERT INTO public.set_logs(session_id,member_id,exercise_id,set_number,reps,weight_kg,set_role,root_set_id,segment_index) VALUES('${id(20)}','${id(3)}','${id(10)}',2,8,10,'drop','${id(21)}',1)`,
  );
  checks++;
  await as(1);
  await db.exec(`UPDATE public.exercises SET active=false,name_en='Renamed' WHERE id='${id(10)}'`);
  await as(3);
  assert.equal(
    (await value(`SELECT snapshot->>'name_en' name FROM public.workout_exercises`)).name,
    "Test squat",
  );
  assert.equal(
    (await value(`SELECT count(*)::int n FROM public.exercises WHERE id='${id(10)}'`)).n,
    1,
  );
  checks += 2;
  await as(4);
  assert.equal(
    (await value(`SELECT count(*)::int n FROM public.exercises WHERE id='${id(10)}'`)).n,
    0,
  );
  checks++;
  await as(3);
  const put = {
    id: id(31),
    record_id: id(30),
    entity: "water_logs",
    op: "put",
    base_revision: 0,
    payload: { log_date: new Date().toISOString().slice(0, 10), ml: 250 },
  };
  const mutate = async (m) =>
    (await value(`SELECT public.apply_member_mutations('${JSON.stringify(m)}'::jsonb) result`))
      .result;
  assert.equal((await mutate([put]))[0].status, "applied");
  assert.equal((await mutate([put]))[0].status, "already_applied");
  checks += 2;
  assert.equal(
    (await value(`SELECT count(*)::int n FROM public.water_logs WHERE id='${id(30)}'`)).n,
    1,
  );
  checks++;
  const edit = { ...put, id: id(32), base_revision: 1, payload: { ...put.payload, ml: 500 } };
  const edited = await mutate([edit]);
  assert.equal(edited[0].status, "applied", JSON.stringify(edited));
  assert.equal((await mutate([{ ...edit, id: id(33) }]))[0].status, "conflict");
  checks += 2;
  await mutate([{ ...edit, id: id(34), base_revision: 2, op: "delete" }]);
  assert.equal((await mutate([{ ...put, id: id(35) }]))[0].status, "conflict");
  checks++;
  await db.exec(
    `INSERT INTO public.wellness_checkins(member_id,log_date,sleep_hours,energy) VALUES('${id(3)}',current_date,7,4)`,
  );
  await denied(
    `INSERT INTO public.wellness_checkins(member_id,log_date) VALUES('${id(3)}',current_date-1)`,
  );
  await as(2);
  assert.equal((await value(`SELECT count(*)::int n FROM public.wellness_checkins`)).n, 1);
  checks++;
  await as(4);
  assert.equal((await value(`SELECT count(*)::int n FROM public.wellness_checkins`)).n, 0);
  checks++;
  await as(5);
  await denied(
    `SELECT public.apply_member_mutations('${JSON.stringify([{ ...put, id: id(36), record_id: id(37) }])}'::jsonb)`,
  );
  await as(1);
  await db.exec(
    `INSERT INTO public.programs(id,name,weeks) VALUES('${id(40)}','Test plan',1);INSERT INTO public.program_items(program_id,exercise_id,week,day,target_sets,target_reps) VALUES('${id(40)}','${id(10)}',1,1,3,'8-12');`,
  );
  const ver = (await value(`SELECT public.publish_program('${id(40)}') id`)).id;
  const assignment = (await value(`SELECT public.assign_program_version('${id(3)}','${ver}') id`))
    .id;
  await as(2);
  await db.exec(
    `SELECT public.configure_program_schedule('${assignment}','rotation',current_date,NULL::jsonb)`,
  );
  checks++;
  await as(3);
  const occ = (await value(`SELECT id FROM public.session_occurrences`)).id;
  await denied(`UPDATE public.session_occurrences SET status='completed' WHERE id='${occ}'`);
  const first = (
    await value(`SELECT public.start_session_occurrence('${occ}','${id(45)}',now()) s`)
  ).s;
  const retry = (
    await value(`SELECT public.start_session_occurrence('${occ}','${id(46)}',now()) s`)
  ).s;
  assert.equal(first.id, retry.id);
  checks++;
  await db.exec(`DELETE FROM public.workout_sessions WHERE id='${first.id}'`);
  assert.equal(
    (await value(`SELECT status FROM public.session_occurrences WHERE id='${occ}'`)).status,
    "scheduled",
  );
  checks++;
  const restarted = (
    await value(`SELECT public.start_session_occurrence('${occ}','${id(47)}',now()) s`)
  ).s;
  assert.equal(restarted.id, id(47));
  checks++;
  await db.exec(
    `UPDATE public.workout_sessions SET finished_at=now() WHERE id='${id(47)}';DELETE FROM public.workout_sessions WHERE id='${id(47)}'`,
  );
  assert.equal(
    (await value(`SELECT status FROM public.session_occurrences WHERE id='${occ}'`)).status,
    "completed",
  );
  checks++;

  const imported = {
    title: "Imported",
    activity_date: new Date().toISOString().slice(0, 10),
    source_rows: [{ name: "Test squat", reps: 10, weight: 20 }],
    sets: [{ exercise_id: id(10), set_number: 1, reps: 10, weight_kg: 20 }],
  };
  const sql = `SELECT public.commit_training_import('${id(50)}','strong','${JSON.stringify([imported])}'::jsonb) r`;
  const xpBefore = await value(`SELECT coalesce(sum(amount),0)::int n FROM public.xp_events`);
  assert.equal((await value(sql)).r.accepted, 1);
  assert.equal((await value(sql)).r.accepted, 1);
  checks += 2;
  const duplicateSql = sql.replace(id(50), id(51));
  assert.equal((await value(duplicateSql)).r.skipped, 1);
  checks++;
  assert.equal(
    (await value(`SELECT public.get_import_batch_outcome('${id(50)}') r`)).r.accepted,
    1,
  );
  checks++;
  assert.equal(
    (await value(`SELECT coalesce(sum(amount),0)::int n FROM public.xp_events`)).n,
    xpBefore.n,
  );
  checks++;
  await denied(`UPDATE public.workout_sessions SET origin='native' WHERE origin='import'`);
  const importBackup = (await value("SELECT public.export_personal_data() data")).data;
  importBackup.set_logs.reverse();
  assert.equal((await value(`SELECT public.undo_training_import('${id(50)}') r`)).r.removed, 1);
  checks++;
  await db.exec("RESET ROLE");
  await db.exec(
    `DELETE FROM public.import_receipts WHERE batch_id='${id(50)}';DELETE FROM public.set_logs WHERE session_id='${id(20)}'`,
  );
  await as(3);
  await db.query("SELECT public.restore_personal_data($1::jsonb,false)", [
    JSON.stringify(importBackup),
  ]);
  assert.equal(
    (
      await value(
        `SELECT count(*)::int n FROM public.workout_sessions WHERE import_batch_id='${id(50)}' AND origin='import'`,
      )
    ).n,
    1,
  );
  assert.equal(
    (await value(`SELECT count(*)::int n FROM public.import_receipts WHERE batch_id='${id(50)}'`))
      .n,
    1,
  );
  assert.equal(
    (await value(`SELECT count(*)::int n FROM public.set_logs WHERE session_id='${id(20)}'`)).n,
    2,
  );
  assert.equal(
    (await value(`SELECT coalesce(sum(amount),0)::int n FROM public.xp_events`)).n,
    xpBefore.n,
  );
  checks += 4;
  const foreign = structuredClone(importBackup);
  foreign.import_receipts[0].member_id = id(4);
  await assert.rejects(
    db.query("SELECT public.restore_personal_data($1::jsonb,false)", [JSON.stringify(foreign)]),
  );
  checks++;
  const replay = await mutate([put]);
  assert.equal(replay[0].record, null);
  assert.equal(replay[0].revision, 3);
  checks += 2;
  // Warmups cannot claim a workout; a timed working hold can, without duplicate receipts.
  await db.exec(
    `INSERT INTO public.workout_sessions(id,member_id) VALUES('${id(60)}','${id(3)}');INSERT INTO public.set_logs(session_id,member_id,exercise_id,set_number,reps,set_role) VALUES('${id(60)}','${id(3)}','${id(10)}',1,10,'warmup');UPDATE public.workout_sessions SET finished_at=now() WHERE id='${id(60)}'`,
  );
  assert.equal(
    (
      await value(
        `SELECT coalesce(sum(amount),0)::int n FROM public.xp_events WHERE source='workout'`,
      )
    ).n,
    0,
  );
  checks++;
  await db.exec(
    `INSERT INTO public.workout_sessions(id,member_id) VALUES('${id(61)}','${id(3)}');INSERT INTO public.set_logs(session_id,member_id,exercise_id,set_number,reps,duration_seconds,logging_mode) VALUES('${id(61)}','${id(3)}','${id(10)}',1,NULL,30,'timed');UPDATE public.workout_sessions SET finished_at=now() WHERE id='${id(61)}'`,
  );
  assert.equal(
    (
      await value(
        `SELECT coalesce(sum(amount),0)::int n FROM public.xp_events WHERE source='workout'`,
      )
    ).n,
    3500,
  );
  checks++;
  // The latest-schema restore must accept old records with missing newly added fields.
  const exported = (await value("SELECT public.export_personal_data() data")).data;
  await db.exec(`DELETE FROM public.water_logs WHERE member_id='${id(3)}'`);
  const legacy = {
    ...exported,
    water_logs: [
      {
        id: id(70),
        member_id: id(3),
        log_date: new Date().toISOString().slice(0, 10),
        ml: 250,
        created_at: new Date().toISOString(),
      },
    ],
  };
  delete legacy.wellness_checkins;
  delete legacy.workout_exercises;
  await db.query("SELECT public.restore_personal_data($1::jsonb,false)", [JSON.stringify(legacy)]);
  assert.equal(
    (await value(`SELECT count(*)::int n FROM public.water_logs WHERE id='${id(70)}'`)).n,
    1,
  );
  checks++;
  const snapshot = (
    await value(`SELECT snapshot FROM public.workout_exercises WHERE session_id='${id(61)}'`)
  ).snapshot;
  assert.equal(snapshot.logging_mode, "timed");
  checks++;
  // Grouped meal writes roll back every ingredient when any payload is invalid.
  const bad = [
    {
      id: id(72),
      record_id: id(73),
      entity: "food_logs",
      op: "put",
      base_revision: 0,
      payload: {
        log_date: new Date().toISOString().slice(0, 10),
        meal: "lunch",
        name: "Meal",
        calories: 100,
        protein_g: 5,
        carbs_g: 10,
        fat_g: 2,
      },
    },
    {
      id: id(74),
      record_id: id(75),
      entity: "water_logs",
      op: "put",
      base_revision: 0,
      payload: { log_date: new Date().toISOString().slice(0, 10), ml: -1 },
    },
  ];
  await assert.rejects(
    db.query("SELECT public.apply_member_mutations($1::jsonb)", [JSON.stringify(bad)]),
  );
  assert.equal(
    (await value(`SELECT count(*)::int n FROM public.food_logs WHERE id='${id(73)}'`)).n,
    0,
  );
  checks += 2;
  await as(1);
  await db.exec(`UPDATE public.training_rollout SET available=false WHERE feature='offline'`);
  await as(3);
  await denied(`SELECT public.apply_member_mutations('[]')`);
  await as(1);
  await db.exec(`UPDATE public.training_rollout SET available=true WHERE feature='offline'`);
  await db.exec(`DELETE FROM public.user_roles WHERE user_id='${id(2)}' AND role='coach'`);
  await as(2);
  assert.equal((await value(`SELECT count(*)::int n FROM public.wellness_checkins`)).n, 0);
  checks++;
  await db.exec("RESET ROLE");
  assert.equal(
    (
      await value(
        `SELECT count(*)::int n FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND prosecdef AND prorettype<>'trigger'::regtype AND has_function_privilege('authenticated',p.oid,'EXECUTE')`,
      )
    ).n,
    0,
  );
  checks++;
  assert.equal(
    (
      await value(
        `SELECT count(*)::int n FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE c.contype='f' AND n.nspname IN ('public','private') AND NOT EXISTS(SELECT 1 FROM pg_index i WHERE i.indrelid=c.conrelid AND i.indisvalid AND i.indisready AND i.indpred IS NULL AND c.conkey <@ (i.indkey::smallint[])[0:cardinality(c.conkey)-1])`,
      )
    ).n,
    0,
  );
  checks++;
  await as(4);
  const privacy = { ...put, id: id(90), record_id: id(91) };
  await mutate([privacy]);
  await db.exec("RESET ROLE");
  await db.exec(`DELETE FROM auth.users WHERE id='${id(4)}'`);
  assert.equal(
    (
      await value(
        `SELECT count(*)::int n FROM private.member_mutation_receipts WHERE member_id='${id(4)}'`,
      )
    ).n,
    0,
  );
  checks++;
  await as(1);
  const slotItem = (
    await value(`SELECT items->0 item FROM public.program_versions WHERE id='${ver}'`)
  ).item;
  const slotKey = `${ver}:${slotItem.id}`;
  await db.query(
    `INSERT INTO public.training_policies(member_id,program_version_id,slot_key,exercise_id,rule,working_sets,reps_min,reps_max,increment,rpe_ceiling) VALUES($1,$2,$3,$4,'double',1,8,12,2.5,8)`,
    [id(3), ver, slotKey, id(10)],
  );
  await as(3);
  for (const [sessionId, convention] of [
    [id(95), "external_total"],
    [id(96), "per_hand"],
  ]) {
    await db.query(`INSERT INTO public.workout_sessions(id,member_id) VALUES($1,$2)`, [
      sessionId,
      id(3),
    ]);
    await db.query(
      `INSERT INTO public.set_logs(session_id,member_id,exercise_id,set_number,reps,weight_kg,rpe,slot_key,load_convention) VALUES($1,$2,$3,1,12,20,7,$4,$5)`,
      [sessionId, id(3), id(10), slotKey, convention],
    );
    await db.query(`UPDATE public.workout_sessions SET finished_at=now() WHERE id=$1`, [sessionId]);
  }
  const context = (
    await db.query(`SELECT public.get_training_context($1,$2) data`, [id(3), slotKey])
  ).rows[0].data;
  assert.equal(context.session.id, id(95));
  assert.equal(context.expected.load_convention, "external_total");
  checks += 2;
  console.log(`${checks} training-depth database assertions passed.`);
} finally {
  await db.close();
}
