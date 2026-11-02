import assert from "node:assert/strict";
import { createTestDatabase } from "./test-database.mjs";
const db = await createTestDatabase();
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const scalar = async (sql, args = []) => Object.values((await db.query(sql, args)).rows[0])[0];
const as = async (n) =>
  db.exec(
    `RESET ROLE; SELECT set_config('request.jwt.claim.sub','${id(n)}',false); SET ROLE authenticated`,
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
  for (let n = 1; n <= 4; n++)
    await db.exec(
      `INSERT INTO auth.users(id,email) VALUES('${id(n)}','schedule-${n}@test.invalid'); INSERT INTO public.profiles(id) VALUES('${id(n)}'); INSERT INTO public.user_roles(user_id,role) VALUES('${id(n)}','${n === 1 ? "admin" : n === 2 ? "coach" : "member"}')`,
    );
  await as(1);
  await db.exec(
    `UPDATE public.training_rollout SET enabled=true; INSERT INTO public.exercises(id,name_en,muscle) VALUES('${id(10)}','Review lift','chest'); INSERT INTO public.coach_assignments(coach_id,member_id) VALUES('${id(2)}','${id(3)}'); INSERT INTO public.programs(id,name,weeks,created_by) VALUES('${id(11)}','Schedule review',1,'${id(1)}'); INSERT INTO public.program_items(program_id,exercise_id,week,day,target_sets,target_reps,position) SELECT '${id(11)}','${id(10)}',1,n,1,'8',n FROM generate_series(1,3)n`,
  );
  const version = await scalar("SELECT public.publish_program($1::uuid)", [id(11)]);
  const assignment = await scalar("SELECT public.assign_program_version($1::uuid,$2::uuid)", [
    id(3),
    version,
  ]);
  const today = await scalar("SELECT to_char(current_date,'YYYY-MM-DD')");
  const configure = (mode, date, expected) =>
    db.query("SELECT public.configure_program_schedule($1::uuid,$2,$3::date,$4::jsonb)", [
      assignment,
      mode,
      date,
      JSON.stringify(expected),
    ]);
  const schedule = () =>
    scalar(
      "SELECT jsonb_build_object('mode',mode,'start_date',start_date) FROM public.program_schedules WHERE assignment_id=$1::uuid",
      [assignment],
    );
  await as(2);
  await configure("calendar", today, null);
  const original = await schedule();
  eq(original, { mode: "calendar", start_date: today });
  await as(3);
  const occurrences = (
    await db.query("SELECT id,day,due_date::text FROM public.session_occurrences ORDER BY day")
  ).rows;
  await db.query("SELECT public.start_session_occurrence($1::uuid,$2::uuid,now())", [
    occurrences[0].id,
    id(20),
  ]);
  await db.exec(
    `INSERT INTO public.set_logs(session_id,member_id,exercise_id,set_number,reps,weight_kg) VALUES('${id(20)}','${id(3)}','${id(10)}',1,8,20); UPDATE public.workout_sessions SET finished_at=now() WHERE id='${id(20)}'`,
  );
  await db.query("SELECT public.start_session_occurrence($1::uuid,$2::uuid,now())", [
    occurrences[1].id,
    id(21),
  ]);
  const moved = await scalar("SELECT (current_date+10)::text");
  await db.query("SELECT public.move_session_occurrence($1::uuid,$2::date)", [
    occurrences[2].id,
    moved,
  ]);
  await as(2);
  await configure("calendar", today, null);
  eq(
    await scalar("SELECT due_date::text FROM public.session_occurrences WHERE id=$1::uuid", [
      occurrences[2].id,
    ]),
    moved,
  );
  await configure("rotation", today, original);
  await denied(
    "SELECT public.configure_program_schedule($1::uuid,'calendar',current_date+1,$2::jsonb)",
    [assignment, JSON.stringify(original)],
  );
  eq((await schedule()).mode, "rotation");
  const after = (
    await db.query("SELECT status,due_date::text FROM public.session_occurrences ORDER BY day")
  ).rows;
  eq(after[0], { status: "completed", due_date: occurrences[0].due_date });
  eq(after[1], { status: "in_progress", due_date: occurrences[1].due_date });
  eq(after[2], { status: "scheduled", due_date: null });
  await denied("SELECT public.configure_program_schedule($1::uuid,'calendar',current_date)", [
    assignment,
  ]);
  await as(4);
  await denied(
    "SELECT public.configure_program_schedule($1::uuid,'rotation',current_date,$2::jsonb)",
    [assignment, JSON.stringify({ mode: "rotation", start_date: today })],
  );
  await as(1);
  await db.exec(`UPDATE public.profiles SET access_active=false WHERE id='${id(2)}'`);
  await as(2);
  await denied(
    "SELECT public.configure_program_schedule($1::uuid,'rotation',current_date,NULL::jsonb)",
    [assignment],
  );
  console.log(
    `${checks} schedule assertions passed: stale reviews, safe retry, moved sessions, preserved history, old-client denial and authorization.`,
  );
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  await db.close();
}
