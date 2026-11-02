SET LOCAL lock_timeout = '5s';
-- Internal trigger only: clients cannot bypass file-first deletion with a direct REST DELETE.
CREATE FUNCTION private.require_photo_file_removed() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id='progress-photos' AND name=OLD.path) THEN
    RAISE EXCEPTION 'Remove the stored file before deleting this photo entry';
  END IF;
  RETURN OLD;
END $$;
REVOKE ALL ON FUNCTION private.require_photo_file_removed() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER require_photo_file_removed BEFORE DELETE ON public.progress_photos
FOR EACH ROW EXECUTE FUNCTION private.require_photo_file_removed();
