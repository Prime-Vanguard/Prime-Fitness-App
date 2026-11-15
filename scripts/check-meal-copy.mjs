import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createTestDatabase } from "./test-database.mjs";
const db = await createTestDatabase();
const member = randomUUID(),
  other = randomUUID(),
  paused = randomUUID(),
  first = randomUUID(),
  second = randomUUID();
let checks = 0;
const eq = (a, b) => {
  assert.deepEqual(a, b);
  checks++;
};
const as = async (id) =>
  db.exec(
    `RESET ROLE; SELECT set_config('request.jwt.claim.sub','${id}',false); SET ROLE authenticated;`,
  );
try {
  await db.exec("ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created");
  for (const id of [member, other, paused])
    await db.query("INSERT INTO auth.users(id,email) VALUES ($1,$2);", [id, `${id}@test.invalid`]);
  for (const id of [member, other, paused]) {
    await db.query("INSERT INTO public.profiles(id,email,access_active) VALUES ($1,$2,$3)", [
      id,
      `${id}@test.invalid`,
      id !== paused,
    ]);
    await db.query("INSERT INTO public.user_roles(user_id,role) VALUES ($1,'member')", [id]);
  }
  await as(member);
  const copy = `INSERT INTO public.food_logs(id,member_id,log_date,meal,name,calories,protein_g,carbs_g,fat_g) VALUES
 ('${first}','${member}',(now() AT TIME ZONE 'Africa/Cairo')::date,'breakfast','Copied oats',400,20,60,10),
 ('${second}','${member}',(now() AT TIME ZONE 'Africa/Cairo')::date,'breakfast','Copied milk',100,10,10,2)
 ON CONFLICT(id) DO NOTHING`;
  await db.exec(copy);
  const xp = async () =>
    Number(
      (
        await db.query(
          "SELECT coalesce(sum(amount),0) AS xp FROM public.xp_events WHERE member_id=$1",
          [member],
        )
      ).rows[0].xp,
    );
  const awarded = await xp();
  await db.exec(copy);
  await db.exec(copy);
  eq(
    Number(
      (await db.query("SELECT count(*) AS n FROM public.food_logs WHERE member_id=$1", [member]))
        .rows[0].n,
    ),
    2,
  );
  eq(await xp(), awarded);
  await assert.rejects(
    db.exec(
      `INSERT INTO public.food_logs(member_id,meal,name,calories) VALUES ('${other}','breakfast','Forbidden',100) ON CONFLICT(id) DO NOTHING`,
    ),
    (error) => error.code === "42501",
  );
  checks++;
  const valid = randomUUID();
  await assert.rejects(
    db.exec(
      `INSERT INTO public.food_logs(id,member_id,meal,name,calories) VALUES ('${valid}','${member}','lunch','Valid',100),('${randomUUID()}','${member}','lunch','Invalid',-1) ON CONFLICT(id) DO NOTHING`,
    ),
  );
  checks++;
  eq(
    Number(
      (await db.query("SELECT count(*) AS n FROM public.food_logs WHERE id=$1", [valid])).rows[0].n,
    ),
    0,
  );
  await as(other);
  eq(Number((await db.query("SELECT count(*) AS n FROM public.food_logs")).rows[0].n), 0);
  await as(paused);
  await assert.rejects(
    db.exec(
      `INSERT INTO public.food_logs(member_id,meal,name,calories) VALUES ('${paused}','breakfast','Paused',100) ON CONFLICT(id) DO NOTHING`,
    ),
    (error) => error.code === "42501",
  );
  checks++;
  console.log(
    `${checks} meal-copy database assertions passed: retry identity, reward parity, atomic validation, ownership, unrelated-member isolation and paused membership.`,
  );
} finally {
  await db.close();
}
