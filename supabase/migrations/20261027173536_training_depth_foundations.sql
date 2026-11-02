SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='120s';

CREATE FUNCTION private.can_coach_member(_member uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT private.is_active(auth.uid()) AND (private.is_admin(auth.uid()) OR EXISTS(SELECT 1 FROM public.coach_assignments WHERE member_id=_member AND coach_id=auth.uid() AND active))
$$;
REVOKE ALL ON FUNCTION private.can_coach_member(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.can_coach_member(uuid) TO authenticated;

CREATE TABLE public.training_rollout(feature text PRIMARY KEY CHECK(feature IN ('guidance','logging','progression','scheduling','imports','offline')),enabled boolean NOT NULL DEFAULT false,staff_enabled boolean NOT NULL DEFAULT true);
INSERT INTO public.training_rollout(feature) VALUES('guidance'),('logging'),('progression'),('scheduling'),('imports'),('offline');
CREATE TABLE public.training_pilots(member_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE);
ALTER TABLE public.training_rollout ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_pilots ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.training_rollout TO authenticated;
GRANT UPDATE ON public.training_rollout TO authenticated;
GRANT SELECT,INSERT,DELETE ON public.training_pilots TO authenticated;
CREATE POLICY rollout_read ON public.training_rollout FOR SELECT TO authenticated USING(true);
CREATE POLICY rollout_update ON public.training_rollout FOR UPDATE TO authenticated USING((SELECT private.is_admin((SELECT auth.uid()))) AND (SELECT private.is_active((SELECT auth.uid())))) WITH CHECK((SELECT private.is_admin((SELECT auth.uid()))) AND (SELECT private.is_active((SELECT auth.uid()))));
CREATE POLICY pilots_read ON public.training_pilots FOR SELECT TO authenticated USING(member_id=(SELECT auth.uid()) OR (SELECT private.is_admin((SELECT auth.uid()))));
CREATE POLICY pilots_insert ON public.training_pilots FOR INSERT TO authenticated WITH CHECK((SELECT private.is_admin((SELECT auth.uid()))) AND (SELECT private.is_active((SELECT auth.uid()))));
CREATE POLICY pilots_delete ON public.training_pilots FOR DELETE TO authenticated USING((SELECT private.is_admin((SELECT auth.uid()))) AND (SELECT private.is_active((SELECT auth.uid()))));
CREATE FUNCTION private.training_enabled(_feature text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT private.is_active(auth.uid()) AND EXISTS(SELECT 1 FROM public.training_rollout WHERE feature=_feature AND (enabled OR (staff_enabled AND (private.is_admin(auth.uid()) OR private.has_role(auth.uid(),'coach'))) OR EXISTS(SELECT 1 FROM public.training_pilots WHERE member_id=auth.uid())))
$$;
REVOKE ALL ON FUNCTION private.training_enabled(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.training_enabled(text) TO authenticated;
CREATE FUNCTION public.get_training_features() RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT jsonb_object_agg(feature,private.training_enabled(feature)) FROM public.training_rollout
$$;
REVOKE ALL ON FUNCTION public.get_training_features() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_training_features() TO authenticated;

ALTER TABLE public.exercises ADD COLUMN equipment_tags text[] NOT NULL DEFAULT '{}',ADD COLUMN aliases text[] NOT NULL DEFAULT '{}',ADD COLUMN movement_pattern text,
 ADD COLUMN logging_mode text NOT NULL DEFAULT 'weighted_reps' CHECK(logging_mode IN ('weighted_reps','bodyweight_reps','timed')),
 ADD COLUMN load_convention text NOT NULL DEFAULT 'external_total' CHECK(load_convention IN ('external_total','per_hand','bodyweight')),
 ADD COLUMN guidance jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(guidance)='object'),ADD COLUMN media jsonb,
 ADD COLUMN editorial_status text NOT NULL DEFAULT 'needs_review' CHECK(editorial_status IN ('needs_review','reviewed'));
UPDATE public.exercises SET equipment_tags=ARRAY[lower(trim(equipment))] WHERE lower(trim(equipment)) IN ('barbell','dumbbell','cable','machine','bodyweight','kettlebell','band','bench');
CREATE FUNCTION private.validate_guidance() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NOT NULL AND NOT private.is_active(auth.uid()) THEN RAISE EXCEPTION 'Active staff access required'; END IF;
 IF NEW.media IS NOT NULL AND (NEW.media->>'license' IS NULL OR NEW.media->>'license' NOT IN ('original','CC0','CC-BY-4.0') OR coalesce(NEW.media->>'author','')='' OR coalesce(NEW.media->>'source','')='' OR coalesce(NEW.media->>'permission','')='' OR coalesce(NEW.media->>'attribution','')='' OR coalesce(NEW.media->>'url','') !~ '^https://') THEN RAISE EXCEPTION 'Approved commercial media rights and HTTPS source required'; END IF;
 IF NEW.editorial_status='reviewed' AND (coalesce(NEW.guidance->>'steps_en','')='' OR coalesce(NEW.guidance->>'steps_ar','')='' OR cardinality(NEW.equipment_tags)=0 OR NEW.movement_pattern IS NULL) THEN RAISE EXCEPTION 'Reviewed exercises require bilingual instructions, equipment and movement classification'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER validate_guidance BEFORE INSERT OR UPDATE ON public.exercises FOR EACH ROW EXECUTE FUNCTION private.validate_guidance();
CREATE TABLE public.exercise_alternatives(exercise_id uuid REFERENCES public.exercises(id) ON DELETE CASCADE,alternative_id uuid REFERENCES public.exercises(id) ON DELETE CASCADE,reason_en text NOT NULL,reason_ar text NOT NULL,PRIMARY KEY(exercise_id,alternative_id),CHECK(exercise_id<>alternative_id));
CREATE INDEX exercise_alternatives_reverse_idx ON public.exercise_alternatives(alternative_id);
ALTER TABLE public.exercise_alternatives ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.exercise_alternatives TO authenticated;
CREATE POLICY alternatives_read ON public.exercise_alternatives FOR SELECT TO authenticated USING(true);
CREATE POLICY alternatives_write_insert ON public.exercise_alternatives FOR INSERT TO authenticated WITH CHECK((SELECT private.is_admin((SELECT auth.uid()))) AND (SELECT private.is_active((SELECT auth.uid()))));
CREATE POLICY alternatives_write_update ON public.exercise_alternatives FOR UPDATE TO authenticated USING((SELECT private.is_admin((SELECT auth.uid()))) AND (SELECT private.is_active((SELECT auth.uid())))) WITH CHECK((SELECT private.is_admin((SELECT auth.uid()))) AND (SELECT private.is_active((SELECT auth.uid()))));
CREATE POLICY alternatives_write_delete ON public.exercise_alternatives FOR DELETE TO authenticated USING((SELECT private.is_admin((SELECT auth.uid()))) AND (SELECT private.is_active((SELECT auth.uid()))));

CREATE FUNCTION private.history_exercise(_exercise uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.set_logs s WHERE s.exercise_id=_exercise AND (s.member_id=auth.uid() OR private.can_coach_member(s.member_id))) OR EXISTS(SELECT 1 FROM public.program_assignments a JOIN public.program_versions v ON v.id=a.program_version_id CROSS JOIN LATERAL jsonb_array_elements(v.items) i WHERE (a.member_id=auth.uid() OR private.can_coach_member(a.member_id)) AND i->>'exercise_id'=_exercise::text)
$$;
REVOKE ALL ON FUNCTION private.history_exercise(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.history_exercise(uuid) TO authenticated;
ALTER POLICY "Members view active exercises" ON public.exercises USING(active OR (SELECT private.is_admin((SELECT auth.uid()))) OR private.history_exercise(id));

CREATE TABLE public.workout_exercises(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),session_id uuid NOT NULL REFERENCES public.workout_sessions(id) ON DELETE CASCADE,member_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,exercise_id uuid NOT NULL REFERENCES public.exercises(id),slot_key text NOT NULL DEFAULT '',snapshot jsonb NOT NULL,UNIQUE(session_id,exercise_id,slot_key));
CREATE INDEX workout_exercises_member_idx ON public.workout_exercises(member_id);
CREATE INDEX workout_exercises_exercise_idx ON public.workout_exercises(exercise_id);
ALTER TABLE public.workout_exercises ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.workout_exercises TO authenticated;
CREATE POLICY workout_exercises_read ON public.workout_exercises FOR SELECT TO authenticated USING(member_id=(SELECT auth.uid()) OR private.can_coach_member(member_id));
INSERT INTO public.workout_exercises(session_id,member_id,exercise_id,snapshot) SELECT DISTINCT s.session_id,s.member_id,s.exercise_id,jsonb_build_object('name_en',e.name_en,'name_ar',e.name_ar,'muscle',e.muscle,'equipment',e.equipment,'logging_mode',e.logging_mode,'load_convention',e.load_convention) FROM public.set_logs s JOIN public.exercises e ON e.id=s.exercise_id;
ALTER TABLE public.set_logs ADD COLUMN workout_exercise_id uuid REFERENCES public.workout_exercises(id),ADD COLUMN slot_key text NOT NULL DEFAULT '',
 ADD COLUMN set_role text NOT NULL DEFAULT 'working' CHECK(set_role IN ('working','warmup','drop')),
 ADD COLUMN logging_mode text NOT NULL DEFAULT 'weighted_reps' CHECK(logging_mode IN ('weighted_reps','bodyweight_reps','timed')),
 ADD COLUMN load_convention text NOT NULL DEFAULT 'external_total' CHECK(load_convention IN ('external_total','per_hand','bodyweight')),
 ADD COLUMN duration_seconds integer CHECK(duration_seconds BETWEEN 1 AND 86400),ADD COLUMN side text NOT NULL DEFAULT 'bilateral' CHECK(side IN ('bilateral','left','right')),
 ADD COLUMN pair_id uuid,ADD COLUMN root_set_id uuid REFERENCES public.set_logs(id) ON DELETE CASCADE,ADD COLUMN segment_index integer NOT NULL DEFAULT 0 CHECK(segment_index BETWEEN 0 AND 100);
CREATE INDEX set_logs_workout_exercise_idx ON public.set_logs(workout_exercise_id);
CREATE INDEX set_logs_root_idx ON public.set_logs(root_set_id);
UPDATE public.set_logs s SET workout_exercise_id=w.id FROM public.workout_exercises w WHERE s.session_id=w.session_id AND s.exercise_id=w.exercise_id;
ALTER TABLE public.set_logs ADD CONSTRAINT set_detail_shape CHECK((logging_mode='timed' AND duration_seconds IS NOT NULL AND reps IS NULL OR logging_mode<>'timed' AND duration_seconds IS NULL) AND (side='bilateral' AND pair_id IS NULL OR side<>'bilateral' AND pair_id IS NOT NULL) AND (set_role='drop' AND root_set_id IS NOT NULL AND segment_index>0 OR set_role<>'drop' AND root_set_id IS NULL AND segment_index=0));
CREATE FUNCTION private.capture_workout_exercise() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE root public.set_logs; slot public.workout_exercises; ex public.exercises;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.workout_sessions WHERE id=NEW.session_id AND member_id=NEW.member_id) THEN RAISE EXCEPTION 'Workout ownership policy mismatch' USING ERRCODE='23503'; END IF;
 IF TG_OP='UPDATE' AND (NEW.exercise_id,NEW.slot_key,NEW.session_id,NEW.member_id) IS DISTINCT FROM (OLD.exercise_id,OLD.slot_key,OLD.session_id,OLD.member_id) THEN RAISE EXCEPTION 'Historical set identity is immutable'; END IF;
 IF NEW.set_role='drop' THEN SELECT * INTO root FROM public.set_logs WHERE id=NEW.root_set_id; IF root.id IS NULL OR root.set_role<>'working' OR (root.session_id,root.member_id,root.exercise_id,root.slot_key,root.side) IS DISTINCT FROM (NEW.session_id,NEW.member_id,NEW.exercise_id,NEW.slot_key,NEW.side) THEN RAISE EXCEPTION 'Drop segments must reference a working set in the same exercise slot and side'; END IF; END IF;
 SELECT * INTO slot FROM public.workout_exercises WHERE session_id=NEW.session_id AND exercise_id=NEW.exercise_id AND slot_key=NEW.slot_key;
 IF slot.id IS NULL THEN
  SELECT * INTO ex FROM public.exercises WHERE id=NEW.exercise_id;
  IF ex.id IS NULL THEN RAISE EXCEPTION 'Unknown exercise'; END IF;
  INSERT INTO public.workout_exercises(session_id,member_id,exercise_id,slot_key,snapshot) VALUES(NEW.session_id,NEW.member_id,NEW.exercise_id,NEW.slot_key,jsonb_build_object('name_en',ex.name_en,'name_ar',ex.name_ar,'muscle',ex.muscle,'equipment',ex.equipment,'logging_mode',NEW.logging_mode,'load_convention',NEW.load_convention)) ON CONFLICT(session_id,exercise_id,slot_key) DO NOTHING;
  SELECT * INTO slot FROM public.workout_exercises WHERE session_id=NEW.session_id AND exercise_id=NEW.exercise_id AND slot_key=NEW.slot_key;
 END IF;
 IF (slot.snapshot->>'logging_mode',slot.snapshot->>'load_convention') IS DISTINCT FROM (NEW.logging_mode,NEW.load_convention) THEN RAISE EXCEPTION 'An exercise slot cannot mix logging modes or load conventions'; END IF;
 NEW.workout_exercise_id=slot.id;RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.capture_workout_exercise() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER capture_workout_exercise BEFORE INSERT OR UPDATE ON public.set_logs FOR EACH ROW EXECUTE FUNCTION private.capture_workout_exercise();

ALTER TABLE public.workout_sessions ADD COLUMN origin text NOT NULL DEFAULT 'native' CHECK(origin IN ('native','import')),ADD COLUMN activity_date date,ADD COLUMN import_batch_id uuid;
CREATE FUNCTION private.guard_workout_origin() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF TG_OP='UPDATE' AND (NEW.origin,NEW.activity_date,NEW.import_batch_id) IS DISTINCT FROM (OLD.origin,OLD.activity_date,OLD.import_batch_id) THEN RAISE EXCEPTION 'Workout provenance is immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_workout_origin BEFORE UPDATE ON public.workout_sessions FOR EACH ROW EXECUTE FUNCTION private.guard_workout_origin();
-- Replace only the qualifying-set predicate; preserve receipt caps and milestone logic.
DO $$ DECLARE definition text; BEGIN
 SELECT pg_get_functiondef('public.xp_on_workout()'::regprocedure) INTO definition;
 definition=replace(definition,'IF OLD.finished_at IS NULL AND NEW.finished_at IS NOT NULL','IF NEW.origin = ''native'' AND OLD.finished_at IS NULL AND NEW.finished_at IS NOT NULL');
 definition=replace(definition,'AND reps > 0','AND set_role = ''working'' AND (reps > 0 OR duration_seconds > 0)');
 EXECUTE definition;
END $$;
CREATE OR REPLACE VIEW public.member_activity_days WITH(security_invoker=true) AS SELECT member_id,(started_at AT TIME ZONE 'Africa/Cairo')::date AS activity_date FROM public.workout_sessions WHERE finished_at IS NOT NULL AND origin='native' UNION SELECT member_id,log_date FROM public.food_logs UNION SELECT member_id,shield_date FROM public.streak_shields;

CREATE TABLE public.training_policies(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),member_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,program_version_id uuid NOT NULL REFERENCES public.program_versions(id),slot_key text NOT NULL,exercise_id uuid NOT NULL REFERENCES public.exercises(id),rule text NOT NULL DEFAULT 'off' CHECK(rule IN ('off','double','duration')),working_sets integer NOT NULL CHECK(working_sets BETWEEN 1 AND 100),reps_min integer,reps_max integer,duration_target integer,increment numeric NOT NULL CHECK(increment>0 AND increment<=1000),rpe_ceiling numeric NOT NULL CHECK(rpe_ceiling BETWEEN 1 AND 10),upper_limit numeric,allow_imported boolean NOT NULL DEFAULT false,override jsonb,revision integer NOT NULL DEFAULT 1,updated_by uuid REFERENCES public.profiles(id),updated_at timestamptz NOT NULL DEFAULT now(),UNIQUE(member_id,program_version_id,slot_key),CHECK(rule<>'double' OR (reps_min IS NOT NULL AND reps_max IS NOT NULL AND reps_min BETWEEN 1 AND 1000 AND reps_max BETWEEN reps_min AND 1000)),CHECK(rule<>'duration' OR (duration_target IS NOT NULL AND duration_target BETWEEN 1 AND 86400 AND increment=trunc(increment))),CHECK(upper_limit IS NULL OR upper_limit>0));
CREATE INDEX training_policies_version_idx ON public.training_policies(program_version_id);
CREATE INDEX training_policies_exercise_idx ON public.training_policies(exercise_id);
CREATE INDEX training_policies_actor_idx ON public.training_policies(updated_by);
ALTER TABLE public.training_policies ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.training_policies TO authenticated;
CREATE POLICY training_policies_read ON public.training_policies FOR SELECT TO authenticated USING(member_id=(SELECT auth.uid()) OR private.can_coach_member(member_id));
CREATE POLICY training_policies_write_insert ON public.training_policies FOR INSERT TO authenticated WITH CHECK(private.can_coach_member(member_id) AND (SELECT private.training_enabled('progression')));
CREATE POLICY training_policies_write_update ON public.training_policies FOR UPDATE TO authenticated USING(private.can_coach_member(member_id)) WITH CHECK(private.can_coach_member(member_id) AND (SELECT private.training_enabled('progression')));
CREATE POLICY training_policies_write_delete ON public.training_policies FOR DELETE TO authenticated USING(private.can_coach_member(member_id));
CREATE FUNCTION private.guard_training_policy() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF NOT private.can_coach_member(NEW.member_id) THEN RAISE EXCEPTION 'Current coach or active admin required'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.program_assignments WHERE member_id=NEW.member_id AND program_version_id=NEW.program_version_id AND active) THEN RAISE EXCEPTION 'An active assignment is required'; END IF;
 IF NEW.override IS NOT NULL AND (coalesce(NEW.override->>'reason','')='' OR jsonb_typeof(NEW.override)<>'object') THEN RAISE EXCEPTION 'Override reason required'; END IF;
 NEW.revision=CASE WHEN TG_OP='INSERT' THEN 1 ELSE OLD.revision+1 END;NEW.updated_by=auth.uid();NEW.updated_at=now();RETURN NEW;
END $$;
CREATE TRIGGER guard_training_policy BEFORE INSERT OR UPDATE ON public.training_policies FOR EACH ROW EXECUTE FUNCTION private.guard_training_policy();

CREATE TABLE public.wellness_checkins(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),member_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,log_date date NOT NULL,sleep_hours numeric CHECK(sleep_hours BETWEEN 0 AND 24),energy integer CHECK(energy BETWEEN 1 AND 5),soreness integer CHECK(soreness BETWEEN 1 AND 5),notes text CHECK(length(notes)<=2000),created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(member_id,log_date),CHECK(sleep_hours IS NOT NULL OR energy IS NOT NULL OR soreness IS NOT NULL OR coalesce(length(trim(notes)),0)>0));
ALTER TABLE public.wellness_checkins ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.wellness_checkins TO authenticated;
CREATE POLICY wellness_read ON public.wellness_checkins FOR SELECT TO authenticated USING(member_id=(SELECT auth.uid()) OR private.can_coach_member(member_id));
CREATE POLICY wellness_insert ON public.wellness_checkins FOR INSERT TO authenticated WITH CHECK(member_id=(SELECT auth.uid()) AND (SELECT private.is_active((SELECT auth.uid()))) AND (SELECT private.training_enabled('offline')) AND log_date<=(now() AT TIME ZONE 'Africa/Cairo')::date);
CREATE POLICY wellness_update ON public.wellness_checkins FOR UPDATE TO authenticated USING(member_id=(SELECT auth.uid())) WITH CHECK(member_id=(SELECT auth.uid()) AND (SELECT private.is_active((SELECT auth.uid()))) AND log_date<=(now() AT TIME ZONE 'Africa/Cairo')::date);
CREATE POLICY wellness_delete ON public.wellness_checkins FOR DELETE TO authenticated USING(member_id=(SELECT auth.uid()) AND (SELECT private.is_active((SELECT auth.uid()))));

GRANT ALL ON public.training_rollout,public.training_pilots,public.exercise_alternatives,public.workout_exercises,public.training_policies,public.wellness_checkins TO service_role;
