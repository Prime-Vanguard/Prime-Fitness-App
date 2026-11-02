import assert from "node:assert/strict";
import { createTestDatabase } from "./test-database.mjs";
const db = await createTestDatabase();
let checks = 0;
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const as = async (n) =>
  db.exec(
    `RESET ROLE;SELECT set_config('request.jwt.claim.sub','${id(n)}',false);SET ROLE authenticated`,
  );
const value = async (sql) => (await db.query(sql)).rows[0];
const call = (request, reward = 10, cost = 10, member = 2) =>
  value(
    `SELECT public.request_redemption('${id(member)}','${id(request)}','${id(reward)}',${cost}) receipt`,
  );
try {
  await db.exec("ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created");
  for (let n = 1; n <= 4; n++)
    await db.exec(
      `INSERT INTO auth.users(id,email) VALUES('${id(n)}','redemption${n}@test.invalid');INSERT INTO public.profiles(id,access_active) VALUES('${id(n)}',${n !== 4});INSERT INTO public.user_roles(user_id,role) VALUES('${id(n)}','${n === 1 ? "admin" : "member"}')`,
    );
  await as(1);
  await db.exec(
    `INSERT INTO public.rewards(id,title_en,cost_pv,stock) VALUES('${id(10)}','Reward',10,3),('${id(11)}','Other reward',10,3);RESET ROLE;INSERT INTO public.pv_ledger(member_id,points,source,approved_by) VALUES('${id(2)}',100,'fixture','${id(1)}')`,
  );
  await as(2);
  assert.equal((await call(20)).receipt.id, id(20));
  checks++;
  await assert.rejects(
    db.exec(
      `INSERT INTO public.redemptions(id,member_id,reward_id) VALUES('${id(20)}','${id(2)}','${id(10)}')`,
    ),
    (e) => e.code === "23505",
  );
  checks++;
  assert.equal((await call(20)).receipt.id, id(20));
  checks++;
  assert.equal((await value(`SELECT count(*)::int n FROM public.redemptions`)).n, 1);
  checks++;
  assert.equal(
    (
      await value(
        `SELECT sum(points)::int balance FROM public.pv_ledger WHERE member_id='${id(2)}'`,
      )
    ).balance,
    90,
  );
  checks++;
  assert.equal((await value(`SELECT stock FROM public.rewards WHERE id='${id(10)}'`)).stock, 2);
  checks++;
  await assert.rejects(call(20, 11));
  checks++;
  await assert.rejects(call(22, 10, 9), (e) => e.code === "PF001");
  checks++;
  assert.equal((await value(`SELECT count(*)::int n FROM public.redemptions`)).n, 1);
  checks++;
  assert.equal((await value(`SELECT stock FROM public.rewards WHERE id='${id(10)}'`)).stock, 2);
  checks++;
  await call(21);
  checks++;
  assert.equal(
    (
      await value(
        `SELECT sum(points)::int balance FROM public.pv_ledger WHERE member_id='${id(2)}'`,
      )
    ).balance,
    80,
  );
  checks++;
  await as(1);
  await db.exec(
    `UPDATE public.redemptions SET status='rejected' WHERE id='${id(20)}';UPDATE public.rewards SET active=false WHERE id='${id(10)}'`,
  );
  await as(2);
  assert.equal((await call(20)).receipt.status, "rejected");
  checks++;
  assert.equal(
    (
      await value(
        `SELECT sum(points)::int balance FROM public.pv_ledger WHERE member_id='${id(2)}'`,
      )
    ).balance,
    90,
  );
  checks++;
  await as(3);
  await assert.rejects(call(20));
  checks++;
  await as(4);
  await assert.rejects(call(24, 11, 10, 4));
  checks++;
  await db.exec(`RESET ROLE;SELECT set_config('request.jwt.claim.sub','',false);SET ROLE anon`);
  await assert.rejects(call(25));
  checks++;
  console.log(`${checks} redemption-retry assertions passed.`);
} finally {
  await db.close();
}
