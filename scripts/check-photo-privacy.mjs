import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createTestDatabase } from "./test-database.mjs";
const db = await createTestDatabase();
const a = randomUUID(),
  b = randomUUID(),
  admin = randomUUID(),
  photo = randomUUID(),
  otherPhoto = randomUUID();
let checks = 0;
const eq = (value, expected) => {
  assert.deepEqual(value, expected);
  checks++;
};
const deny = async (sql) => {
  await assert.rejects(db.exec(sql), /permission|policy|Remove the stored file/i);
  checks++;
};
const as = async (id) =>
  db.exec(
    `RESET ROLE; SELECT set_config('request.jwt.claim.sub','${id}',false); SET ROLE authenticated;`,
  );
try {
  await db.exec(`ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created;
    INSERT INTO auth.users(id) VALUES ('${a}'),('${b}'),('${admin}');
    INSERT INTO public.profiles(id) VALUES ('${a}'),('${b}'),('${admin}');
    INSERT INTO public.user_roles(user_id,role) VALUES ('${admin}','super_admin');`);
  await as(a);
  // Simulated Storage metadata in isolated WASM; real file operations use Storage API only.
  await db.exec(
    `INSERT INTO storage.objects(bucket_id,name) VALUES ('progress-photos','${a}/photo.gif')`,
  );
  await db.exec(
    `INSERT INTO public.progress_photos(id,member_id,path) VALUES ('${photo}','${a}','${a}/photo.gif')`,
  );
  await deny(`DELETE FROM public.progress_photos WHERE id='${photo}'`);
  await as(b);
  await db.exec(
    `INSERT INTO public.progress_photos(id,member_id,path) VALUES ('${otherPhoto}','${b}','${b}/other.jpg')`,
  );
  await as(a);
  await db.exec(
    `INSERT INTO public.photo_deletion_queue(photo_id,member_id,path) VALUES ('${photo}','${a}','${a}/photo.gif') ON CONFLICT DO NOTHING`,
  );
  await db.exec(
    `INSERT INTO public.photo_deletion_queue(photo_id,member_id,path) VALUES ('${photo}','${a}','${a}/photo.gif') ON CONFLICT DO NOTHING`,
  );
  eq((await db.query("SELECT * FROM public.photo_deletion_queue")).rows.length, 1);
  await deny(
    `INSERT INTO public.photo_deletion_queue(photo_id,member_id,path) VALUES ('${otherPhoto}','${a}','${a}/fake.jpg')`,
  );
  await deny(
    `INSERT INTO public.photo_deletion_queue(photo_id,member_id,path) VALUES ('${otherPhoto}','${b}','${b}/other.jpg')`,
  );
  await deny(`UPDATE public.photo_deletion_queue SET path='${a}/wrong.jpg'`);
  await deny("DELETE FROM public.photo_deletion_queue");
  await as(b);
  eq((await db.query("SELECT * FROM public.photo_deletion_queue")).rows.length, 0);
  await as(admin);
  await db.exec(`UPDATE public.profiles SET access_active=false WHERE id='${a}'`);
  await as(a);
  eq((await db.query("SELECT * FROM public.photo_deletion_queue")).rows.length, 1);
  await deny(`DELETE FROM public.progress_photos WHERE id='${photo}'`);
  await db.exec(
    `DELETE FROM storage.objects WHERE bucket_id='progress-photos' AND name='${a}/photo.gif'`,
  );
  await db.exec(`DELETE FROM public.progress_photos WHERE id='${photo}'`);
  eq((await db.query("SELECT * FROM public.photo_deletion_queue")).rows.length, 0);
  await db.exec("RESET ROLE; SET ROLE anon");
  await deny("SELECT * FROM public.photo_deletion_queue");
  await db.exec("RESET ROLE");
  const bucket = (
    await db.query(
      "SELECT public,allowed_mime_types FROM storage.buckets WHERE id='progress-photos'",
    )
  ).rows[0];
  eq(bucket.public, false);
  eq(bucket.allowed_mime_types, ["image/*"]);
  eq(
    (
      await db.query(
        "SELECT has_function_privilege('authenticated','private.require_photo_file_removed()','EXECUTE') AS allowed",
      )
    ).rows[0].allowed,
    false,
  );
  eq(
    (
      await db.query(
        "SELECT relrowsecurity FROM pg_class WHERE oid='public.photo_deletion_queue'::regclass",
      )
    ).rows[0].relrowsecurity,
    true,
  );
  console.log(
    `${checks} photo privacy assertions passed: ownership, immutable retry records, paused deletion, cascade cleanup and private image bucket.`,
  );
} finally {
  await db.close();
}
