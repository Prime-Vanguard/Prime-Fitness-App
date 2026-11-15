import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { createTestDatabase } from "./test-database.mjs";

// Replay a realistic excessive-grant baseline before applying the forward fix.
const migration = (await readdir("supabase/migrations")).find((f) =>
  f.endsWith("_production_access_hardening.sql"),
);
const db = await createTestDatabase(migration);
let checks = 0;
const eq = (a, b) => {
  assert.deepEqual(a, b);
  checks++;
};
const scalar = async (sql) => Object.values((await db.query(sql)).rows[0])[0];
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
try {
  await db.exec(
    "GRANT TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public TO anon, authenticated; ALTER DEFAULT PRIVILEGES GRANT TRUNCATE, REFERENCES, TRIGGER ON TABLES TO anon, authenticated; ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT TRUNCATE, REFERENCES, TRIGGER ON TABLES TO anon, authenticated;",
  );
  await db.exec(await readFile("supabase/migrations/" + migration, "utf8"));
  eq(
    Number(
      await scalar(
        "SELECT count(*) FROM pg_class c WHERE c.relnamespace='public'::regnamespace AND c.relkind='r' AND (has_table_privilege('anon',c.oid,'TRUNCATE') OR has_table_privilege('authenticated',c.oid,'TRIGGER') OR has_table_privilege('authenticated',c.oid,'REFERENCES'))",
      ),
    ),
    0,
  );
  await db.exec("CREATE TABLE public.privilege_probe(id int);");
  for (const role of ["anon", "authenticated"]) {
    for (const privilege of ["TRUNCATE", "REFERENCES", "TRIGGER"])
      eq(
        await scalar(
          `SELECT has_table_privilege('${role}','public.privilege_probe','${privilege}')`,
        ),
        false,
      );
    await db.exec(`SET ROLE ${role}`);
    await assert.rejects(db.exec("TRUNCATE public.privilege_probe"), /permission/i);
    checks++;
    await db.exec("RESET ROLE");
  }
  await db.exec("ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created");
  for (let n = 1; n <= 5; n++)
    await db.exec(
      `INSERT INTO auth.users(id,email) VALUES ('${id(n)}','actor${n}@test.invalid'); INSERT INTO public.profiles(id,email,display_name) VALUES ('${id(n)}','actor${n}@test.invalid','Synthetic'); INSERT INTO public.user_roles(user_id,role) VALUES ('${id(n)}','${n === 1 ? "coach" : n === 2 ? "pod_leader" : n === 5 ? "admin" : "member"}')`,
    );
  await db.exec(
    `INSERT INTO public.coach_assignments(coach_id,member_id,active) VALUES ('${id(1)}','${id(3)}',true); INSERT INTO public.pods(id,name,leader_id) VALUES ('${id(10)}','Synthetic Pod','${id(2)}'); INSERT INTO public.pod_members(pod_id,member_id) VALUES ('${id(10)}','${id(3)}'); INSERT INTO public.body_measurements(member_id,weight_kg) VALUES ('${id(3)}',80)`,
  );
  for (const n of [1, 2]) {
    const readAs = async () => {
      await db.exec(
        `RESET ROLE; SELECT set_config('request.jwt.claim.sub','${id(n)}',false); SET ROLE authenticated`,
      );
      return Number(
        await scalar(`SELECT count(*) FROM public.body_measurements WHERE member_id='${id(3)}'`),
      );
    };
    eq(await readAs(), 1);
    await db.exec(`RESET ROLE; DELETE FROM public.user_roles WHERE user_id='${id(n)}'`);
    eq(await readAs(), 0);
    await db.exec(
      `RESET ROLE; SELECT set_config('request.jwt.claim.sub','${id(5)}',false); INSERT INTO public.user_roles(user_id,role) VALUES ('${id(n)}','${n === 1 ? "coach" : "pod_leader"}'); UPDATE public.profiles SET access_active=false WHERE id='${id(n)}'`,
    );
    eq(await readAs(), 0);
    await db.exec(
      `RESET ROLE; SELECT set_config('request.jwt.claim.sub','${id(5)}',false); UPDATE public.profiles SET access_active=true WHERE id='${id(n)}'`,
    );
    eq(await readAs(), 1);
  }
  await db.exec(
    `RESET ROLE; SELECT set_config('request.jwt.claim.sub','${id(3)}',false); SET ROLE authenticated`,
  );
  eq(Number(await scalar("SELECT count(*) FROM public.body_measurements")), 1);
  await db.exec(
    `RESET ROLE; SELECT set_config('request.jwt.claim.sub','${id(4)}',false); SET ROLE authenticated`,
  );
  eq(Number(await scalar("SELECT count(*) FROM public.body_measurements")), 0);
  await db.exec("RESET ROLE");
  // Reapplication must remain safe; no changes to member data or policy ownership.
  await db.exec(await readFile("supabase/migrations/" + migration, "utf8"));
  console.log(`${checks} production access assertions passed.`);
} finally {
  await db.close();
}
