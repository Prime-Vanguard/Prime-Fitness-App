import assert from "node:assert/strict";
import { createTestDatabase } from "./test-database.mjs";

// Replay the full history before verifying the new profile contract and existing RLS.
const db = await createTestDatabase();
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const preferences = {
  goals: ["strength"],
  experience: "novice",
  weekly_days: 3,
  equipment: ["full_gym"],
};
let checks = 0;
try {
  await db.exec("ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created");
  for (let n = 1; n <= 4; n++) {
    await db.query("INSERT INTO auth.users(id,email) VALUES ($1,$2)", [
      id(n),
      `synthetic${n}@test.invalid`,
    ]);
    await db.query(
      "INSERT INTO public.profiles(id,email,display_name) VALUES ($1,$2,'Synthetic')",
      [id(n), `synthetic${n}@test.invalid`],
    );
    await db.query("INSERT INTO public.user_roles(user_id,role) VALUES ($1,$2)", [
      id(n),
      n === 3 ? "coach" : n === 4 ? "admin" : "member",
    ]);
  }
  await db.exec(
    `INSERT INTO public.coach_assignments(coach_id,member_id,active) VALUES ('${id(3)}','${id(1)}',true)`,
  );
  const actor = async (n) =>
    db.exec(
      `RESET ROLE; SELECT set_config('request.jwt.claim.sub','${id(n)}',false); SET ROLE authenticated`,
    );
  await actor(1);
  const saved = await db.query(
    "UPDATE public.profiles SET training_preferences=$1::jsonb WHERE id=$2 RETURNING training_preferences",
    [JSON.stringify(preferences), id(1)],
  );
  assert.deepEqual(saved.rows[0].training_preferences, preferences);
  checks++;
  const backup = (await db.query("SELECT public.export_personal_data() AS data")).rows[0].data;
  assert.deepEqual(backup.profile.training_preferences, preferences);
  checks++;
  await db.query("UPDATE public.profiles SET training_preferences=null WHERE id=$1", [id(1)]);
  await db.query("SELECT public.restore_personal_data($1::jsonb,true)", [JSON.stringify(backup)]);
  assert.deepEqual(
    (await db.query("SELECT training_preferences FROM public.profiles WHERE id=$1", [id(1)]))
      .rows[0].training_preferences,
    preferences,
  );
  checks++;
  delete backup.profile.training_preferences;
  await db.query("SELECT public.restore_personal_data($1::jsonb,true)", [JSON.stringify(backup)]);
  assert.deepEqual(
    (await db.query("SELECT training_preferences FROM public.profiles WHERE id=$1", [id(1)]))
      .rows[0].training_preferences,
    preferences,
  );
  checks++;
  backup.profile.training_preferences = null;
  await db.query("SELECT public.restore_personal_data($1::jsonb,true)", [JSON.stringify(backup)]);
  assert.equal(
    (await db.query("SELECT training_preferences FROM public.profiles WHERE id=$1", [id(1)]))
      .rows[0].training_preferences,
    null,
  );
  checks++;
  await db.query("UPDATE public.profiles SET training_preferences=$1::jsonb WHERE id=$2", [
    JSON.stringify(preferences),
    id(1),
  ]);
  for (const patch of [
    { weekly_days: 0 },
    { weekly_days: 2.5 },
    { weekly_days: "3" },
    { goals: ["strength", "strength"] },
    { goals: null },
    { experience: "expert" },
    { equipment: ["unknown"] },
    { hidden: true },
  ]) {
    await assert.rejects(
      db.query("UPDATE public.profiles SET training_preferences=$1::jsonb WHERE id=$2", [
        JSON.stringify({ ...preferences, ...patch }),
        id(1),
      ]),
      /valid_training_preferences/,
    );
    checks++;
  }
  for (const n of [2, 3, 4]) {
    await actor(n);
    const rows = await db.query("SELECT training_preferences FROM public.profiles WHERE id=$1", [
      id(1),
    ]);
    assert.equal(rows.rows.length, n === 2 ? 0 : 1);
    checks++;
  }
  await actor(2);
  assert.equal(
    (
      await db.query(
        "UPDATE public.profiles SET training_preferences=null WHERE id=$1 RETURNING id",
        [id(1)],
      )
    ).rows.length,
    0,
  );
  checks++;
  await db.exec(
    `RESET ROLE; UPDATE public.coach_assignments SET active=false WHERE coach_id='${id(3)}'`,
  );
  await actor(3);
  assert.equal(
    (await db.query("SELECT id FROM public.profiles WHERE id=$1", [id(1)])).rows.length,
    0,
  );
  checks++;
  await db.exec("RESET ROLE");
  assert.equal(Number((await db.query("SELECT count(*) AS n FROM public.xp_events")).rows[0].n), 0);
  checks++;
  console.log(`Onboarding: ${checks} schema, permission and reward-isolation checks passed.`);
} finally {
  await db.close();
}
