import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createTestDatabase } from "./test-database.mjs";
const db = await createTestDatabase(),
  ids = Object.fromEntries(
    ["admin", "admin2", "member", "other", "reward", "reject", "fulfill", "paused"].map((k) => [
      k,
      randomUUID(),
    ]),
  );
let checks = 0;
const eq = (a, b) => {
  assert.deepEqual(a, b);
  checks++;
};
const scalar = async (sql) => Object.values((await db.query(sql)).rows[0])[0];
const as = async (key) =>
  db.exec(
    `RESET ROLE; SELECT set_config('request.jwt.claim.sub','${ids[key]}',false); SET ROLE authenticated;`,
  );
const denied = async (sql) => {
  await assert.rejects(db.exec(sql));
  checks++;
};
try {
  await db.exec("ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created");
  for (const actor of ["admin", "admin2", "member", "other"])
    await db.exec(
      `INSERT INTO auth.users(id,email) VALUES ('${ids[actor]}','${actor}@test.invalid'); INSERT INTO public.profiles(id,email,display_name) VALUES ('${ids[actor]}','${actor}@test.invalid','Shop fixture'); INSERT INTO public.user_roles(user_id,role) VALUES ('${ids[actor]}','${actor.startsWith("admin") ? "admin" : "member"}');`,
    );
  await db.exec("ALTER TABLE auth.users ENABLE TRIGGER on_auth_user_created");
  await db.exec(
    `INSERT INTO public.pv_ledger(member_id,points,source,approved_by) VALUES ('${ids.member}',500,'manual','${ids.admin}');`,
  );
  await as("admin");
  await db.exec(
    `INSERT INTO public.rewards(id,title_en,cost_pv,stock,created_by) VALUES ('${ids.reward}','Fixture reward',50,3,'${ids.admin}');`,
  );
  await as("member");
  for (const key of ["reject", "fulfill", "paused"])
    await db.exec(
      `INSERT INTO public.redemptions(id,reward_id,member_id) VALUES ('${ids[key]}','${ids.reward}','${ids.member}');`,
    );
  eq(await scalar(`SELECT stock FROM public.rewards WHERE id='${ids.reward}'`), 0);
  eq(
    (
      await db.query(
        `UPDATE public.redemptions SET status='fulfilled' WHERE id='${ids.reject}' RETURNING id`,
      )
    ).rows.length,
    0,
  );
  await as("other");
  eq(
    (
      await db.query(
        `UPDATE public.redemptions SET status='rejected' WHERE id='${ids.reject}' RETURNING id`,
      )
    ).rows.length,
    0,
  );
  await as("admin");
  await db.exec(`UPDATE public.rewards SET cost_pv=75 WHERE id='${ids.reward}'`);
  await db.exec(
    `UPDATE public.redemptions SET status='rejected',review_note='Unavailable' WHERE id='${ids.reject}' AND status='pending';`,
  );
  eq(
    await scalar(
      `SELECT points FROM public.pv_ledger WHERE redemption_id='${ids.reject}' AND source='refund'`,
    ),
    50,
  );
  eq(await scalar(`SELECT stock FROM public.rewards WHERE id='${ids.reward}'`), 1);
  eq(
    await scalar(
      `SELECT count(*)::int FROM public.pv_ledger WHERE redemption_id='${ids.reject}' AND source='refund'`,
    ),
    1,
  );
  eq(
    await scalar(`SELECT reviewed_by::text FROM public.redemptions WHERE id='${ids.reject}'`),
    ids.admin,
  );
  eq(
    await scalar(`SELECT reviewed_at IS NOT NULL FROM public.redemptions WHERE id='${ids.reject}'`),
    true,
  );
  eq(
    (
      await db.query(
        `UPDATE public.redemptions SET status='rejected',review_note='Unavailable' WHERE id='${ids.reject}' AND status='pending' RETURNING id`,
      )
    ).rows.length,
    0,
  );
  await denied(`UPDATE public.redemptions SET status='fulfilled' WHERE id='${ids.reject}'`);
  eq(
    await scalar(
      `SELECT count(*)::int FROM public.pv_ledger WHERE redemption_id='${ids.reject}' AND source='refund'`,
    ),
    1,
  );
  await db.exec(
    `UPDATE public.redemptions SET status='fulfilled',review_note='Delivered' WHERE id='${ids.fulfill}' AND status='pending';`,
  );
  eq(
    await scalar(
      `SELECT count(*)::int FROM public.pv_ledger WHERE redemption_id='${ids.fulfill}' AND source='refund'`,
    ),
    0,
  );
  eq(await scalar(`SELECT stock FROM public.rewards WHERE id='${ids.reward}'`), 1);
  await as("admin2");
  await db.exec(`UPDATE public.profiles SET access_active=false WHERE id='${ids.admin}'`);
  await as("admin");
  eq(
    (
      await db.query(
        `UPDATE public.redemptions SET status='rejected' WHERE id='${ids.paused}' RETURNING id`,
      )
    ).rows.length,
    0,
  );
  eq(
    (await db.query(`UPDATE public.rewards SET active=false WHERE id='${ids.reward}' RETURNING id`))
      .rows.length,
    0,
  );
  await denied(`INSERT INTO public.rewards(title_en,cost_pv) VALUES ('Denied',20)`);
  await db.exec("RESET ROLE");
  eq(await scalar(`SELECT status FROM public.redemptions WHERE id='${ids.paused}'`), "pending");
  eq(await scalar(`SELECT stock FROM public.rewards WHERE id='${ids.reward}'`), 1);
  console.log(
    `${checks} shop database assertions passed: active authorization, terminal decisions, original-cost refunds, receipts and single stock restoration.`,
  );
} finally {
  await db.close();
}
