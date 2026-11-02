import { test } from "node:test";
import assert from "node:assert/strict";
import {
  makeIntent,
  validateIntent,
  approvalSql,
  provisionOwner,
  projectUrl,
  protectedIntentPath,
} from "./owner-provisioning.mjs";
const url = "https://owner-fixture.supabase.co",
  password = "synthetic-long-password";
function fixture(
  intent,
  {
    existing = null,
    count = 0,
    owner = true,
    lookupError,
    cleanupError = null,
    lostResponse = false,
  } = {},
) {
  const calls = [];
  let user = existing;
  const client = {
    auth: {
      admin: {
        async getUserById() {
          return {
            data: { user },
            error: lookupError ?? (user ? null : { status: 404, code: "user_not_found" }),
          };
        },
        async createUser(payload) {
          calls.push(["create", payload]);
          user = { id: payload.id, email: payload.email, app_metadata: payload.app_metadata };
          return lostResponse
            ? { data: { user: null }, error: { status: 0 } }
            : { data: { user }, error: null };
        },
        async updateUserById(id, payload) {
          calls.push(["cleanup", id, payload]);
          return {
            data: { user: { ...user, app_metadata: payload.app_metadata } },
            error: cleanupError,
          };
        },
      },
    },
    from(table) {
      const result =
        table === "profiles"
          ? { count, error: null }
          : { data: owner ? [{ role: "super_admin" }] : [], error: null };
      const q = {
        select() {
          return q;
        },
        eq() {
          return q;
        },
        then(fn) {
          return Promise.resolve(result).then(fn);
        },
      };
      return q;
    },
  };
  return { client, calls };
}
test("intent is backend-bound, normalized and approval SQL contains only the token hash", () => {
  const intent = makeIntent(" O'Owner@Test.Invalid ", url + "/");
  assert.equal(intent.email, "o'owner@test.invalid");
  assert.equal(intent.projectUrl, url);
  assert(!approvalSql(intent).includes(intent.token));
  assert(approvalSql(intent).includes("o''owner@test.invalid"));
  assert.throws(() => validateIntent(intent, "https://other.supabase.co"));
  assert.throws(() => projectUrl("https://user:password@test.invalid"));
  assert.throws(() => projectUrl("javascript:alert(1)"));
});
test("intent files cannot be written into source or public assets", () => {
  assert.throws(() => protectedIntentPath("public/first.owner-intent.json"), /outside/);
  assert.throws(() => protectedIntentPath("src/first.owner-intent.json"), /outside/);
  assert.throws(() => protectedIntentPath("first.json"), /ending/);
});
test("creates only the reviewed identity through Admin API and clears its marker", async () => {
  const intent = makeIntent("owner@test.invalid", url),
    f = fixture(intent);
  assert.equal(await provisionOwner(f.client, intent, password), intent.ownerId);
  assert.equal(f.calls[0][1].id, intent.ownerId);
  assert.equal(f.calls[0][1].app_metadata.prime_owner_provisioning_token, intent.token);
  assert.deepEqual(f.calls[1], [
    "cleanup",
    intent.ownerId,
    { app_metadata: { prime_owner_provisioning_token: null } },
  ]);
});
test("existing owner retries never create an account or reset its password", async () => {
  const intent = makeIntent("owner@test.invalid", url),
    f = fixture(intent, { existing: { id: intent.ownerId, email: intent.email } });
  await provisionOwner(f.client, intent, password);
  assert.equal(f.calls.filter(([action]) => action === "create").length, 0);
  assert.equal("password" in f.calls[0][2], false);
});
test("a lost creation response can reconcile the same owner without another create", async () => {
  const intent = makeIntent("owner@test.invalid", url),
    f = fixture(intent, { lostResponse: true });
  await assert.rejects(provisionOwner(f.client, intent, password), /same intent file/);
  assert.equal(await provisionOwner(f.client, intent, password), intent.ownerId);
  assert.equal(f.calls.filter(([action]) => action === "create").length, 1);
});
test("blocks creation on nonempty installations and failed identity verification", async () => {
  const intent = makeIntent("owner@test.invalid", url);
  for (const options of [
    { count: 1 },
    { lookupError: { status: 401 } },
    { lookupError: { status: 503 } },
  ]) {
    const f = fixture(intent, options);
    await assert.rejects(provisionOwner(f.client, intent, password));
    assert.equal(f.calls.length, 0);
  }
});
test("does not promote an existing non-owner or modify a different account", async () => {
  const intent = makeIntent("owner@test.invalid", url);
  for (const options of [
    { existing: { id: intent.ownerId, email: intent.email }, owner: false },
    { existing: { id: intent.ownerId, email: "other@test.invalid" } },
  ]) {
    const f = fixture(intent, options);
    await assert.rejects(provisionOwner(f.client, intent, password));
    assert.equal(f.calls.length, 0);
  }
});
test("cleanup failure reports the existing owner and retries without re-creation", async () => {
  const intent = makeIntent("owner@test.invalid", url),
    f = fixture(intent, { cleanupError: { status: 503 } });
  await assert.rejects(provisionOwner(f.client, intent, password), /Owner exists/);
  assert.equal(f.calls.filter(([action]) => action === "create").length, 1);
});
test("rejects missing/weak credentials before any privileged action", async () => {
  const intent = makeIntent("owner@test.invalid", url),
    f = fixture(intent);
  await assert.rejects(provisionOwner(f.client, intent, "short"), /PRIME_OWNER_PASSWORD/);
  assert.equal(f.calls.length, 0);
});
