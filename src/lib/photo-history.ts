import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
export type HistoryPhoto = Tables<"progress_photos">;
export const PHOTO_PAGE_SIZE = 30;
export async function loadPhotoPage(
  owner: string,
  options: { page: number; pose?: string; from?: string; to?: string },
) {
  let query = supabase
    .from("progress_photos")
    .select("*")
    .eq("member_id", owner)
    .retry(false)
    .abortSignal(AbortSignal.timeout(15000));
  if (options.pose) query = query.eq("pose", options.pose);
  if (options.from) query = query.gte("taken_on", options.from);
  if (options.to) query = query.lte("taken_on", options.to);
  const result = await query
    .order("taken_on", { ascending: false })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(options.page * PHOTO_PAGE_SIZE, (options.page + 1) * PHOTO_PAGE_SIZE);
  if (result.error) throw result.error;
  return {
    photos: result.data.slice(0, PHOTO_PAGE_SIZE),
    hasOlder: result.data.length > PHOTO_PAGE_SIZE,
  };
}
export async function signHistoryPhotos(photos: HistoryPhoto[]) {
  if (!photos.length) return [];
  const result = await supabase.storage.from("progress-photos").createSignedUrls(
    photos.map((p) => p.path),
    3600,
  );
  if (result.error) throw result.error;
  const urls = new Map((result.data ?? []).map((u) => [u.path, u.signedUrl]));
  return photos.map((p) => ({ ...p, url: urls.get(p.path) || null }));
}
