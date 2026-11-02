import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createTestDatabase } from "./test-database.mjs";
const migration = "20261101160432_trusted_owner_provisioning.sql";
const db = await createTestDatabase();
let checks = 0;
const eq = (a, b) => {
  assert.deepEqual(a, b);
  checks++;
};
const scalar = async (sql, args = []) => Object.values((await db.query(sql, args)).rows[0])[0];
const denied = async (sql, args = [], pattern = /permission|provisioning|invite-only/i) => {
  await assert.rejects(db.query(sql, args), pattern);
  checks++;
};
const owner = randomUUID(),
  token = "a".repeat(64),
  replacement = "b".repeat(64),
  email = "owner@test.invalid";
const prepare = (token) =>
  db.query("SELECT private.prepare_owner_provisioning($1::uuid,$2,$3)", [
    owner,
    email,
    createHash("sha256").update(token).digest("hex"),
  ]);
const signup = (id, mail, app = {}, user = {}) =>
  db.query(
    "INSERT INTO auth.users(id,email,raw_app_meta_data,raw_user_meta_data) VALUES($1::uuid,$2,$3::jsonb,$4::jsonb)",
    [id, mail, JSON.stringify(app), JSON.stringify(user)],
  );
try {
  await assert.rejects(
    signup(randomUUID(), "first-public@test.invalid"),
    /Trusted owner provisioning/,
  );
  checks++;
  eq(await scalar("SELECT count(*)::int FROM public.profiles"), 0);
  for (const role of ["anon", "authenticated", "service_role"]) {
    await db.exec(`SET ROLE ${role}`);
    await denied("SELECT private.prepare_owner_provisioning($1::uuid,$2,$3)", [
      owner,
      email,
      token,
    ]);
    await denied("SELECT * FROM private.owner_provisioning");
    await db.exec("RESET ROLE");
  }
  await prepare(token);
  await assert.rejects(
    signup(owner, email, {}, { prime_owner_provisioning_token: token, role: "super_admin" }),
    /Trusted owner provisioning/,
  );
  checks++;
  await assert.rejects(
    signup(owner, email, { prime_owner_provisioning_token: replacement }),
    /Trusted owner provisioning/,
  );
  checks++;
  await assert.rejects(
    signup(owner, "different@test.invalid", { prime_owner_provisioning_token: token }),
    /Trusted owner provisioning/,
  );
  checks++;
  await assert.rejects(
    signup(randomUUID(), email, { prime_owner_provisioning_token: token }),
    /Trusted owner provisioning/,
  );
  checks++;
  await db.exec("UPDATE private.owner_provisioning SET expires_at=now()-interval '1 second'");
  await assert.rejects(
    signup(owner, email, { prime_owner_provisioning_token: token }),
    /Trusted owner provisioning/,
  );
  checks++;
  await prepare(token);
  await prepare(replacement);
  await assert.rejects(
    signup(owner, email, { prime_owner_provisioning_token: token }),
    /Trusted owner provisioning/,
  );
  checks++;
  // Another invited insert in the same transaction must not clear the pending
  // owner's verification token and let an unverified bootstrap commit.
  await db.exec("BEGIN");
  await signup(owner, email, { provider: "email" });
  await db.query(
    "INSERT INTO public.invites(email,role) VALUES('same-transaction@test.invalid','member')",
  );
  await signup(randomUUID(), "same-transaction@test.invalid");
  await assert.rejects(db.exec("COMMIT"), /Trusted owner provisioning token/);
  checks++;
  eq(await scalar("SELECT count(*)::int FROM public.profiles"), 0);
  eq(await scalar("SELECT consumed_at IS NULL FROM private.owner_provisioning"), true);
  // Match GoTrue Admin API ordering: initial insert has provider metadata only;
  // custom app_metadata is written later in the same transaction.
  await db.exec("BEGIN");
  await signup(owner, email, { provider: "email", providers: ["email"] });
  await db.query(
    "UPDATE auth.users SET raw_app_meta_data = raw_app_meta_data || $2::jsonb WHERE id=$1::uuid",
    [owner, JSON.stringify({ prime_owner_provisioning_token: replacement })],
  );
  await db.exec("COMMIT");
  checks++;
  eq(
    (
      await db.query("SELECT role FROM public.user_roles WHERE user_id=$1::uuid ORDER BY role", [
        owner,
      ])
    ).rows
      .map((r) => r.role)
      .sort(),
    ["member", "super_admin"],
  );
  eq(
    await scalar(
      "SELECT consumed_at IS NOT NULL AND token_hash IS NULL AND expires_at IS NULL FROM private.owner_provisioning",
    ),
    true,
  );
  await assert.rejects(prepare(replacement), /closed/);
  checks++;
  await assert.rejects(
    signup(randomUUID(), "replay@test.invalid", { prime_owner_provisioning_token: replacement }),
    /invite-only/,
  );
  checks++;
  const member = randomUUID();
  await db.query("INSERT INTO public.invites(email,role) VALUES('invited@test.invalid','member')");
  await signup(
    member,
    "invited@test.invalid",
    {},
    { role: "super_admin", prime_owner_provisioning_token: replacement },
  );
  eq(
    (
      await db.query("SELECT role FROM public.user_roles WHERE user_id=$1::uuid", [member])
    ).rows.map((r) => r.role),
    ["member"],
  );
  eq(
    await scalar(
      "SELECT accepted_at IS NOT NULL FROM public.invites WHERE email='invited@test.invalid'",
    ),
    true,
  );
  eq(
    await scalar(
      "SELECT count(*)::int FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prosecdef AND (has_function_privilege('authenticated',p.oid,'execute') OR has_function_privilege('anon',p.oid,'execute'))",
    ),
    0,
  );
  const existing = await createTestDatabase(migration);
  try {
    const oldOwner = randomUUID();
    await existing.query(
      "INSERT INTO auth.users(id,email) VALUES($1::uuid,'existing@test.invalid')",
      [oldOwner],
    );
    const before = (
      await existing.query("SELECT user_id,role FROM public.user_roles ORDER BY user_id,role")
    ).rows;
    await existing.exec(
      await readFile(new URL(`../supabase/migrations/${migration}`, import.meta.url), "utf8"),
    );
    eq(
      (await existing.query("SELECT user_id,role FROM public.user_roles ORDER BY user_id,role"))
        .rows,
      before,
    );
    eq(
      (
        await existing.query(
          "SELECT consumed_at IS NOT NULL AS closed FROM private.owner_provisioning",
        )
      ).rows[0].closed,
      true,
    );
    await assert.rejects(
      existing.query(
        "SELECT private.prepare_owner_provisioning($1::uuid,'replacement@test.invalid',$2)",
        [randomUUID(), token],
      ),
      /closed/,
    );
    checks++;
  } finally {
    await existing.close();
  }
  console.log(
    `${checks} owner-provisioning assertions passed: public denial, trusted metadata, expiry/rotation, consumption, invitation compatibility and existing-owner preservation.`,
  );
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  await db.close();
}
