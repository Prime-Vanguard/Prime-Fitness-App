import { randomBytes, randomUUID, createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL, fileURLToPath } from "node:url";
import { resolve, relative, isAbsolute, sep, dirname, basename } from "node:path";
import { realpathSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const marker = "prime_owner_provisioning_token";
export function protectedIntentPath(file) {
  if (!file?.endsWith(".owner-intent.json"))
    throw new Error("Use a protected path ending in .owner-intent.json.");
  const target = resolve(realpathSync(dirname(resolve(file))), basename(file)),
    root = realpathSync(fileURLToPath(new URL("../", import.meta.url))),
    path = relative(root, target);
  if (!path || !(path === ".." || path.startsWith(`..${sep}`) || isAbsolute(path)))
    throw new Error(
      "Keep owner intent files outside the application repository and public assets.",
    );
  return target;
}
export function projectUrl(value) {
  const url = new URL(value);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error("Use a plain Supabase server URL.");
  return url.href.replace(/\/+$/, "");
}
export function validateIntent(value, url) {
  if (
    !value ||
    value.version !== 1 ||
    value.projectUrl !== projectUrl(url) ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value.ownerId ?? "",
    ) ||
    !/^[a-f0-9]{64}$/.test(value.token ?? "") ||
    typeof value.email !== "string" ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email) ||
    value.email !== value.email.trim().toLowerCase()
  )
    throw new Error("The owner intent is invalid or belongs to a different backend.");
  return value;
}
export function makeIntent(email, url) {
  const intent = {
    version: 1,
    projectUrl: projectUrl(url),
    ownerId: randomUUID(),
    email: String(email).trim().toLowerCase(),
    token: randomBytes(32).toString("hex"),
  };
  return validateIntent(intent, url);
}
export function approvalSql(intent) {
  const quote = (value) => `'${value.replaceAll("'", "''")}'`;
  const hash = createHash("sha256").update(intent.token).digest("hex");
  return `SELECT private.prepare_owner_provisioning(${quote(intent.ownerId)}::uuid, ${quote(intent.email)}, ${quote(hash)});`;
}
/** Only consumes a trusted SQL approval; never inserts/promotes user_roles through the client. */
export async function provisionOwner(client, intent, password) {
  if (typeof password !== "string" || password.length < 12)
    throw new Error("Set PRIME_OWNER_PASSWORD to a unique password of at least 12 characters.");
  const existing = await client.auth.admin.getUserById(intent.ownerId);
  if (existing.error && existing.error.status !== 404 && existing.error.code !== "user_not_found")
    throw new Error("Could not verify the intended account. No creation was attempted.");
  let user = existing.data?.user;
  if (!existing.error && !user)
    throw new Error("The account lookup was incomplete. No creation was attempted.");
  if (!user) {
    const profiles = await client.from("profiles").select("id", { count: "exact", head: true });
    if (profiles.error || profiles.count !== 0)
      throw new Error("Owner creation requires a verified empty installation.");
    const result = await client.auth.admin.createUser({
      id: intent.ownerId,
      email: intent.email,
      password,
      email_confirm: true,
      app_metadata: { [marker]: intent.token },
    });
    if (result.error || !result.data?.user)
      throw new Error(
        "Owner creation was not confirmed. Check the SQL approval and retry the same intent file; do not generate a new identity.",
      );
    user = result.data.user;
  }
  if (user.id !== intent.ownerId || user.email?.toLowerCase() !== intent.email)
    throw new Error(
      "The existing account does not match the reviewed intent. No changes were made.",
    );
  const roles = await client
    .from("user_roles")
    .select("role")
    .eq("user_id", intent.ownerId)
    .eq("role", "super_admin");
  if (roles.error || !roles.data?.some((row) => row.role === "super_admin"))
    throw new Error("The account is not a verified owner. No role promotion was attempted.");
  const clean = await client.auth.admin.updateUserById(intent.ownerId, {
    app_metadata: { [marker]: null },
  });
  if (
    clean.error ||
    clean.data?.user?.id !== intent.ownerId ||
    clean.data.user.app_metadata?.[marker]
  )
    throw new Error(
      "Owner exists, but token cleanup was not confirmed. Retry the same intent file; the password and owner role will not be changed.",
    );
  return intent.ownerId;
}
function operatorClient(url, key) {
  if (!key || key.startsWith("sb_publishable_"))
    throw new Error("A server-only Supabase service/secret key is required.");
  if (!key.startsWith("sb_secret_")) {
    let role;
    try {
      role = JSON.parse(Buffer.from(key.split(".")[1] ?? "", "base64url").toString()).role;
    } catch {
      /* Fail closed below. */
    }
    if (role !== "service_role")
      throw new Error("A server-only Supabase service/secret key is required.");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_secret_") && headers.get("Authorization") === `Bearer ${key}`)
          headers.delete("Authorization");
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
}
async function main() {
  const [command, arg, file] = process.argv.slice(2),
    url = process.env.SUPABASE_URL;
  if (!url) throw new Error("Set the server-only SUPABASE_URL.");
  if (command === "prepare") {
    if (!file?.endsWith(".owner-intent.json"))
      throw new Error("Usage: prepare <email> <protected-path.owner-intent.json>");
    const intent = makeIntent(arg, url);
    await writeFile(protectedIntentPath(file), JSON.stringify(intent, null, 2), {
      flag: "wx",
      mode: 0o600,
    });
    console.log(
      "Intent saved. Run this approval in the trusted database SQL console, then use create within 30 minutes:",
    );
    console.log(approvalSql(intent));
  } else if (command === "create") {
    if (!arg?.endsWith(".owner-intent.json"))
      throw new Error("Usage: create <protected-path.owner-intent.json>");
    const intent = validateIntent(
      JSON.parse(await readFile(protectedIntentPath(arg), "utf8")),
      url,
    );
    const id = await provisionOwner(
      operatorClient(projectUrl(url), process.env.SUPABASE_SERVICE_ROLE_KEY),
      intent,
      process.env.PRIME_OWNER_PASSWORD,
    );
    console.log(
      `Owner verified: ${id}. Keep the identity record and securely remove the consumed intent file.`,
    );
  } else
    throw new Error(
      "Usage: prepare <email> <protected-path.owner-intent.json> | create <protected-path.owner-intent.json>",
    );
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
