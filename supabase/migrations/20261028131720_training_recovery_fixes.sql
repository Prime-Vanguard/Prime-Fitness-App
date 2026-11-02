SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='120s';

-- An abandoned active session releases its occurrence; completed history never advances twice.
CREATE FUNCTION private.release_discarded_occurrence() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF OLD.occurrence_id IS NOT NULL AND OLD.finished_at IS NULL THEN
  PERFORM 1 FROM public.session_occurrences WHERE id=OLD.occurrence_id FOR UPDATE;
  UPDATE public.session_occurrences o SET status=CASE
   WHEN EXISTS(SELECT 1 FROM public.program_assignments a WHERE a.id=o.assignment_id AND a.active)
   THEN 'scheduled' ELSE 'cancelled' END
  WHERE o.id=OLD.occurrence_id AND o.member_id=OLD.member_id AND o.status='in_progress';
 END IF;
 RETURN OLD;
END $$;
REVOKE ALL ON FUNCTION private.release_discarded_occurrence() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER release_discarded_occurrence AFTER DELETE ON public.workout_sessions
FOR EACH ROW EXECUTE FUNCTION private.release_discarded_occurrence();
