import assert from "node:assert/strict";
import { resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { createTestDatabase } from "./test-database.mjs";

// Replay both histories in isolation; never connect to the hosted database.
if (!process.argv[2]) throw new Error("Supply the prepared deployment workspace");
const directory = pathToFileURL(resolve(process.argv[2], "supabase/migrations") + sep);
const local = await createTestDatabase();
let deployment;
try {
  deployment = await createTestDatabase(undefined, directory);
  const queries = [
    "SELECT table_name,column_name,data_type,is_nullable,column_default FROM information_schema.columns WHERE table_schema IN ('public','private') ORDER BY table_name,ordinal_position",
    "SELECT schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check FROM pg_policies WHERE schemaname IN ('public','private','storage') ORDER BY schemaname,tablename,policyname",
    "SELECT n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) args,pg_get_functiondef(p.oid) definition FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('public','private') ORDER BY n.nspname,p.proname,args",
    "SELECT c.conname,c.conrelid::regclass::text relation,pg_get_constraintdef(c.oid) definition FROM pg_constraint c WHERE c.connamespace IN ('public'::regnamespace,'private'::regnamespace) ORDER BY relation,c.conname",
    "SELECT event_object_table,trigger_name,event_manipulation,action_statement FROM information_schema.triggers WHERE trigger_schema IN ('public','private') ORDER BY event_object_table,trigger_name,event_manipulation",
  ];
  for (const query of queries)
    assert.deepEqual((await deployment.query(query)).rows, (await local.query(query)).rows);
  console.log(
    "Repository and deployment histories replay identically across five schema/security inventories.",
  );
} finally {
  await deployment?.close();
  await local.close();
}
