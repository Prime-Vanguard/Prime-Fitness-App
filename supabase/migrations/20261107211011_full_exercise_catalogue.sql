-- Stable source identities prevent duplicate catalogue seeds without changing existing exercise IDs.
CREATE UNIQUE INDEX exercises_reference_identity_idx
ON public.exercises ((guidance->'text_source'->>'repository'), (guidance->'text_source'->>'exercise_id'))
WHERE guidance->'text_source'->>'repository' = 'hasaneyldrm/exercises-dataset';

-- Catalogue cardio entries are discoverable references; cardio logging has its own metrics/rewards.
CREATE FUNCTION private.guard_catalogue_strength_entry() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF EXISTS (SELECT 1 FROM public.exercises e WHERE e.id=NEW.exercise_id
   AND e.guidance->>'catalogue_kind'='cardio') THEN
   RAISE EXCEPTION 'Use the cardio logger for this catalogue activity';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.guard_catalogue_strength_entry() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER guard_catalogue_strength_set BEFORE INSERT OR UPDATE OF exercise_id ON public.set_logs
FOR EACH ROW EXECUTE FUNCTION private.guard_catalogue_strength_entry();
CREATE TRIGGER guard_catalogue_strength_program BEFORE INSERT OR UPDATE OF exercise_id ON public.program_items
FOR EACH ROW EXECUTE FUNCTION private.guard_catalogue_strength_entry();
