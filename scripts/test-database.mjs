import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";

export async function createTestDatabase(beforeMigration) {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
      CREATE SCHEMA auth; CREATE SCHEMA storage;
      GRANT USAGE ON SCHEMA auth,storage,public TO authenticated,anon,service_role;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,raw_user_meta_data jsonb DEFAULT '{}',raw_app_meta_data jsonb DEFAULT '{}');
      CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean DEFAULT false,file_size_limit bigint,allowed_mime_types text[]);
      CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bucket_id text,name text);
      GRANT SELECT,INSERT,UPDATE,DELETE ON storage.objects TO authenticated;
      ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
      CREATE FUNCTION storage.foldername(text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$ SELECT string_to_array($1,'/') $$;
      CREATE FUNCTION public.rls_auto_enable() RETURNS event_trigger LANGUAGE plpgsql AS $$ BEGIN END $$;
    `);
    const files = (await readdir(new URL("../supabase/migrations/", import.meta.url)))
      .filter((name) => name.endsWith(".sql") && (!beforeMigration || name < beforeMigration))
      .sort();
    for (const name of files)
      await db.exec(
        await readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8"),
      );
    return db;
  } catch (error) {
    await db.close();
    throw error;
  }
}
