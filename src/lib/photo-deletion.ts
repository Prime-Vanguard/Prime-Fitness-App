import { supabase } from "@/integrations/supabase/client";
import { fetchAll } from "./pagination";

export type PhotoIdentity = { id: string; member_id: string; path: string };
export async function pendingPhotoDeletions(owner: string) {
  return fetchAll(
    (from, to) =>
      supabase
        .from("photo_deletion_queue")
        .select("photo_id,member_id,path")
        .eq("member_id", owner)
        .order("photo_id")
        .range(from, to),
    (row) => row.photo_id,
  );
}
export async function queuePhotoDeletion(photo: PhotoIdentity) {
  const queued = await supabase.from("photo_deletion_queue").upsert(
    {
      photo_id: photo.id,
      member_id: photo.member_id,
      path: photo.path,
    },
    { onConflict: "photo_id", ignoreDuplicates: true },
  );
  if (queued.error) throw queued.error;
}
export async function deleteProgressPhoto(photo: PhotoIdentity) {
  await queuePhotoDeletion(photo);
  const file = await supabase.storage.from("progress-photos").remove([photo.path]);
  if (file.error) throw file.error;
  // Cascade removes the queue entry only after the file removal is acknowledged.
  const record = await supabase
    .from("progress_photos")
    .delete()
    .eq("id", photo.id)
    .eq("member_id", photo.member_id);
  if (record.error) throw record.error;
}
