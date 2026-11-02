CREATE TABLE public.progress_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  taken_on date NOT NULL DEFAULT current_date,
  pose text NOT NULL DEFAULT 'front',
  path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.progress_photos(member_id, taken_on DESC);
GRANT SELECT, INSERT, DELETE ON public.progress_photos TO authenticated;
GRANT ALL ON public.progress_photos TO service_role;
ALTER TABLE public.progress_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "photos read" ON public.progress_photos FOR SELECT TO authenticated
  USING (member_id = auth.uid() OR private.is_admin(auth.uid()) OR private.manages_member(auth.uid(), member_id));
CREATE POLICY "photos own insert" ON public.progress_photos FOR INSERT TO authenticated
  WITH CHECK (member_id = auth.uid() AND pose IN ('front','side','back') AND path LIKE auth.uid()::text || '/%');
CREATE POLICY "photos active only" ON public.progress_photos AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (private.is_active(auth.uid()));
CREATE POLICY "photos own delete" ON public.progress_photos FOR DELETE TO authenticated USING (member_id = auth.uid());

CREATE POLICY "progress photos read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'progress-photos' AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR private.is_admin(auth.uid())
    OR private.manages_member(auth.uid(), ((storage.foldername(name))[1])::uuid)));
CREATE POLICY "progress photos own upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'progress-photos' AND (storage.foldername(name))[1] = auth.uid()::text AND private.is_active(auth.uid()));
CREATE POLICY "progress photos own delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'progress-photos' AND (storage.foldername(name))[1] = auth.uid()::text);