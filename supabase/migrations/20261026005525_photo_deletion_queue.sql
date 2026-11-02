SET LOCAL lock_timeout = '5s';
-- Retain each object's identity until Storage removal AND metadata deletion succeed.
CREATE TABLE public.photo_deletion_queue (
  photo_id uuid PRIMARY KEY REFERENCES public.progress_photos(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  path text NOT NULL CHECK (length(path) BETWEEN 1 AND 1024),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX photo_deletion_queue_member_idx ON public.photo_deletion_queue(member_id,photo_id);
ALTER TABLE public.photo_deletion_queue ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.photo_deletion_queue FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.photo_deletion_queue TO authenticated;
GRANT INSERT(photo_id,member_id,path) ON public.photo_deletion_queue TO authenticated;
GRANT ALL ON public.photo_deletion_queue TO service_role;
CREATE POLICY "photo deletion own read" ON public.photo_deletion_queue FOR SELECT TO authenticated
  USING (member_id=(SELECT auth.uid()));
CREATE POLICY "photo deletion own enqueue" ON public.photo_deletion_queue FOR INSERT TO authenticated
  WITH CHECK (member_id=(SELECT auth.uid()) AND EXISTS (
    SELECT 1 FROM public.progress_photos p WHERE p.id=photo_deletion_queue.photo_id
      AND p.member_id=(SELECT auth.uid()) AND p.path=photo_deletion_queue.path
  ));
-- Includes legacy image formats for byte-preserving restore; the upload UI emits JPEG.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES ('progress-photos','progress-photos',false,10485760,ARRAY['image/*'])
ON CONFLICT(id) DO UPDATE SET public=false,file_size_limit=10485760,allowed_mime_types=EXCLUDED.allowed_mime_types;
