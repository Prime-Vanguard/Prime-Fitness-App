import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createTestDatabase } from "./test-database.mjs";

const db = await createTestDatabase();
const ids = Object.fromEntries(
  [
    "admin",
    "otherAdmin",
    "member",
    "unrelated",
    "task",
    "claim",
    "self",
    "info",
    "stale",
    "paused",
  ].map((name) => [name, randomUUID()]),
);
let checks = 0;
const equal = (actual, expected) => {
  assert.deepEqual(actual, expected);
  checks++;
};
const scalar = async (sql) => Object.values((await db.query(sql)).rows[0])[0];
async function as(name) {
  await db.exec(
    `RESET ROLE; SELECT set_config('request.jwt.claim.sub','${ids[name]}',false); SET ROLE authenticated;`,
  );
}
async function rejected(sql, pattern) {
  await assert.rejects(db.exec(sql), pattern);
  checks++;
}
try {
  await db.exec("ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created");
  for (const actor of ["admin", "otherAdmin", "member", "unrelated"])
    await db.exec(
      `INSERT INTO auth.users(id,email) VALUES ('${ids[actor]}','${actor}@test.invalid'); INSERT INTO public.profiles(id,email,display_name) VALUES ('${ids[actor]}','${actor}@test.invalid','Review test'); INSERT INTO public.user_roles(user_id,role) VALUES ('${ids[actor]}','${actor.includes("Admin") || actor === "admin" ? "admin" : "member"}')`,
    );
  await db.exec("ALTER TABLE auth.users ENABLE TRIGGER on_auth_user_created");
  await as("admin");
  await db.exec(
    `INSERT INTO public.pv_tasks(id,title_en,points,created_by) VALUES ('${ids.task}','Review fixture',50,'${ids.admin}')`,
  );
  await as("member");
  for (const claim of ["claim", "info", "stale", "paused"])
    await db.exec(
      `INSERT INTO public.pv_claims(id,task_id,member_id,note) VALUES ('${ids[claim]}','${ids.task}','${ids.member}','Recorded evidence')`,
    );
  await as("unrelated");
  equal(
    (
      await db.query(
        `UPDATE public.pv_claims SET status='approved' WHERE id='${ids.claim}' RETURNING id`,
      )
    ).rows.length,
    0,
  );
  await as("admin");
  await db.exec(
    `INSERT INTO public.pv_claims(id,task_id,member_id,note) VALUES ('${ids.self}','${ids.task}','${ids.admin}','Own evidence')`,
  );
  await rejected(
    `UPDATE public.pv_claims SET status='approved' WHERE id='${ids.self}'`,
    /own claim/i,
  );
  const accepted = (
    await db.query(
      `UPDATE public.pv_claims SET status='approved',review_note='Evidence checked' WHERE id='${ids.claim}' AND status='pending' AND reviewed_at IS NULL RETURNING reviewed_by,reviewed_at`,
    )
  ).rows;
  equal(accepted.length, 1);
  equal(accepted[0].reviewed_by, ids.admin);
  equal(!!accepted[0].reviewed_at, true);
  equal(
    await scalar(`SELECT count(*)::integer FROM public.pv_ledger WHERE claim_id='${ids.claim}'`),
    1,
  );
  equal(await scalar(`SELECT points FROM public.pv_ledger WHERE claim_id='${ids.claim}'`), 50);
  await as("otherAdmin");
  equal(
    (
      await db.query(
        `UPDATE public.pv_claims SET status='approved' WHERE id='${ids.claim}' AND status='pending' AND reviewed_at IS NULL RETURNING id`,
      )
    ).rows.length,
    0,
  );
  await rejected(
    `UPDATE public.pv_claims SET status='approved' WHERE id='${ids.claim}'`,
    /already decided/i,
  );
  equal(
    await scalar(`SELECT count(*)::integer FROM public.pv_ledger WHERE claim_id='${ids.claim}'`),
    1,
  );
  await as("admin");
  await db.exec(
    `UPDATE public.pv_claims SET status='needs_info',review_note='Provide details' WHERE id='${ids.info}'`,
  );
  equal(
    await scalar(`SELECT count(*)::integer FROM public.pv_ledger WHERE claim_id='${ids.info}'`),
    0,
  );
  await as("otherAdmin");
  await db.exec(
    `UPDATE public.pv_claims SET status='approved',review_note='Details checked' WHERE id='${ids.info}' AND status='needs_info'`,
  );
  equal(
    await scalar(`SELECT count(*)::integer FROM public.pv_ledger WHERE claim_id='${ids.info}'`),
    1,
  );
  await db.exec(
    `UPDATE public.pv_claims SET status='needs_info',review_note='New reviewer feedback' WHERE id='${ids.stale}'`,
  );
  await as("admin");
  equal(
    (
      await db.query(
        `UPDATE public.pv_claims SET status='rejected',review_note='Stale review' WHERE id='${ids.stale}' AND status='pending' AND reviewed_at IS NULL RETURNING id`,
      )
    ).rows.length,
    0,
  );
  equal(await scalar(`SELECT status FROM public.pv_claims WHERE id='${ids.stale}'`), "needs_info");
  equal(
    await scalar(`SELECT count(*)::integer FROM public.pv_ledger WHERE claim_id='${ids.stale}'`),
    0,
  );
  await as("otherAdmin");
  const invitation = randomUUID();
  await db.exec(
    `INSERT INTO public.invites(id,email,invited_by) VALUES ('${invitation}','pause-review@test.invalid','${ids.otherAdmin}')`,
  );
  await db.exec(`UPDATE public.profiles SET access_active=false WHERE id='${ids.admin}'`);
  await as("admin");
  equal(
    (
      await db.query(
        `UPDATE public.pv_claims SET status='approved' WHERE id='${ids.paused}' RETURNING id`,
      )
    ).rows.length,
    0,
  );
  await rejected(
    `INSERT INTO public.invites(email,invited_by) VALUES ('paused-admin@test.invalid','${ids.admin}')`,
    /permission|policy/i,
  );
  equal(
    (
      await db.query(
        `UPDATE public.invites SET revoked_at=now() WHERE id='${invitation}' RETURNING id`,
      )
    ).rows.length,
    0,
  );
  await rejected(
    `INSERT INTO public.pv_tasks(title_en,points,created_by) VALUES ('Paused task',50,'${ids.admin}')`,
    /permission|policy/i,
  );
  equal(
    (await db.query(`UPDATE public.pv_tasks SET active=false WHERE id='${ids.task}' RETURNING id`))
      .rows.length,
    0,
  );
  equal(
    (await db.query(`DELETE FROM public.pv_tasks WHERE id='${ids.task}' RETURNING id`)).rows.length,
    0,
  );
  await as("otherAdmin");
  equal(
    await scalar(`SELECT count(*)::integer FROM public.pv_ledger WHERE claim_id='${ids.paused}'`),
    0,
  );
  equal(
    await scalar(`SELECT count(*)::integer FROM public.pv_ledger WHERE claim_id='${ids.self}'`),
    0,
  );
  console.log(
    `${checks} admin review assertions passed: self-review denial, server receipts, terminal decisions, stale conditional reviews, single awards and paused staff.`,
  );
} finally {
  await db.close();
}
