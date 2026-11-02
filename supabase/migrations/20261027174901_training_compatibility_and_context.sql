SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='120s';
-- Defaults also cover legacy jsonb_populate_record restores, which explicitly pass NULL.
CREATE FUNCTION private.training_legacy_defaults() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF TG_TABLE_NAME='workout_sessions' THEN NEW.origin=coalesce(NEW.origin,'native');NEW.time_precision=coalesce(NEW.time_precision,'timestamp');NEW.import_edited=coalesce(NEW.import_edited,false);
 ELSIF TG_TABLE_NAME='set_logs' THEN NEW.slot_key=coalesce(NEW.slot_key,'');NEW.logging_mode=coalesce(NEW.logging_mode,'weighted_reps');NEW.load_convention=coalesce(NEW.load_convention,'external_total');NEW.set_role=coalesce(NEW.set_role,'working');NEW.side=coalesce(NEW.side,'bilateral');NEW.segment_index=coalesce(NEW.segment_index,0);
 ELSE NEW.revision=coalesce(NEW.revision,1);END IF;RETURN NEW;
END $$;
DO $$ DECLARE tab text; BEGIN FOREACH tab IN ARRAY ARRAY['workout_sessions','set_logs','food_logs','water_logs','body_measurements','wellness_checkins','saved_meals'] LOOP EXECUTE format('CREATE TRIGGER aa_training_defaults BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION private.training_legacy_defaults()',tab);END LOOP;END $$;

DO $$ DECLARE definition text; BEGIN
 SELECT pg_get_functiondef('public.export_personal_data()'::regprocedure) INTO definition;
 definition=replace(definition,'''notifications'',''user_roles'',''pod_members''','''notifications'',''user_roles'',''pod_members'',''wellness_checkins'',''workout_exercises'',''training_policies'',''program_schedules'',''session_occurrences'',''import_batches'',''import_receipts''');
 EXECUTE definition;
 SELECT pg_get_functiondef('public.restore_personal_data(jsonb,boolean)'::regprocedure) INTO definition;
 definition=replace(definition,'IF uid IS NULL THEN','IF uid IS NULL THEN');
 definition=replace(definition,'FOREACH tab IN ARRAY ARRAY[''workout_sessions''',E'_data := _data || jsonb_build_object(''wellness_checkins'',coalesce(_data->''wellness_checkins'',''[]''::jsonb));\n  PERFORM set_config(''prime.restore_member'',uid::text,true);\n  FOREACH tab IN ARRAY ARRAY[''workout_sessions''');
 definition=replace(definition,'''saved_meals'',''progress_photos'']','''saved_meals'',''progress_photos'',''wellness_checkins'']');
 -- Import batches are owner-scoped reference records, not reward or permission inputs.
 definition=replace(definition,'FOR row IN SELECT value FROM jsonb_array_elements(_data->''workout_sessions'') LOOP',E'FOR row IN SELECT value FROM jsonb_array_elements(coalesce(_data->''import_batches'',''[]''::jsonb)) LOOP\n IF (row->>''member_id'') IS DISTINCT FROM uid::text THEN RAISE EXCEPTION ''Invalid import batch ownership''; END IF;\n INSERT INTO public.import_batches(id,member_id,provider,parser_version) VALUES((row->>''id'')::uuid,uid,row->>''provider'',coalesce((row->>''parser_version'')::int,1)) ON CONFLICT(id) DO NOTHING;\n END LOOP;\n FOR row IN SELECT value FROM jsonb_array_elements(_data->''workout_sessions'') LOOP');
 definition=replace(definition,'session.finished_at:=NULL;','session.finished_at:=NULL;session.occurrence_id:=NULL;');
 EXECUTE definition;
END $$;
ALTER POLICY imports_insert ON public.import_batches WITH CHECK(member_id=(SELECT auth.uid()) AND (SELECT private.is_active((SELECT auth.uid()))));
-- Restoring missing sets in a completed occurrence must preserve its completion.
CREATE OR REPLACE FUNCTION private.track_occurrence() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE o public.session_occurrences; mode text;
BEGIN
 IF TG_OP='UPDATE' AND NEW.occurrence_id IS DISTINCT FROM OLD.occurrence_id THEN RAISE EXCEPTION 'Workout occurrence is immutable'; END IF;
 IF NEW.occurrence_id IS NULL THEN RETURN NEW; END IF;
 SELECT * INTO o FROM public.session_occurrences WHERE id=NEW.occurrence_id FOR UPDATE;
 IF o.id IS NULL OR o.member_id<>NEW.member_id OR NEW.origin<>'native' THEN RAISE EXCEPTION 'Occurrence ownership mismatch'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.member_id<>auth.uid() OR NOT private.training_enabled('scheduling') OR o.status<>'scheduled' OR NOT EXISTS(SELECT 1 FROM public.program_assignments WHERE id=o.assignment_id AND active) THEN RAISE EXCEPTION 'Session occurrence is unavailable'; END IF;
  SELECT s.mode INTO mode FROM public.program_schedules s WHERE s.assignment_id=o.assignment_id;
  IF mode='rotation' AND EXISTS(SELECT 1 FROM public.session_occurrences WHERE assignment_id=o.assignment_id AND ordinal<o.ordinal AND status IN ('scheduled','in_progress')) THEN RAISE EXCEPTION 'Start the next unfinished session in order'; END IF;
  UPDATE public.session_occurrences SET status='in_progress' WHERE id=o.id;
 ELSIF OLD.finished_at IS NULL AND NEW.finished_at IS NOT NULL THEN UPDATE public.session_occurrences SET status='completed' WHERE id=o.id;
 ELSIF OLD.finished_at IS NOT NULL AND NEW.finished_at IS NULL AND current_setting('prime.restore_member',true) IS DISTINCT FROM auth.uid()::text THEN RAISE EXCEPTION 'A completed occurrence cannot be reopened';END IF;
 RETURN NEW;
END $$;

-- Retain saved-food versus meal classification during offline writes.
DO $$ DECLARE definition text;BEGIN
 SELECT pg_get_functiondef('public.apply_member_mutations(jsonb)'::regprocedure) INTO definition;
 definition=replace(definition,'INSERT INTO public.saved_meals(id,member_id,name,items,revision) VALUES(rid,auth.uid(),p->>''name'',p->''items'',rev)','INSERT INTO public.saved_meals(id,member_id,name,kind,items,revision) VALUES(rid,auth.uid(),p->>''name'',p->>''kind'',p->''items'',rev)');
 definition=replace(definition,'name=EXCLUDED.name,items=EXCLUDED.items','name=EXCLUDED.name,kind=EXCLUDED.kind,items=EXCLUDED.items');
 EXECUTE definition;
END $$;

CREATE FUNCTION public.get_training_context(_member uuid,_slot text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE p public.training_policies; session public.workout_sessions; sets jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT private.training_enabled('progression') OR NOT (_member=auth.uid() OR private.can_coach_member(_member)) THEN RAISE EXCEPTION 'Training context unavailable';END IF;
 SELECT * INTO p FROM public.training_policies WHERE member_id=_member AND slot_key=_slot AND EXISTS(SELECT 1 FROM public.program_assignments a WHERE a.member_id=_member AND a.program_version_id=training_policies.program_version_id AND a.active);
 IF p.id IS NULL THEN RETURN NULL;END IF;
 SELECT s.* INTO session FROM public.workout_sessions s WHERE s.member_id=_member AND s.finished_at IS NOT NULL AND (s.origin='native' OR p.allow_imported) AND EXISTS(SELECT 1 FROM public.set_logs l WHERE l.session_id=s.id AND l.exercise_id=p.exercise_id AND l.set_role='working' AND (l.slot_key=p.slot_key OR p.allow_imported AND s.origin='import')) ORDER BY s.finished_at DESC,s.id DESC LIMIT 1;
 SELECT coalesce(jsonb_agg(to_jsonb(l) ORDER BY l.set_number,l.id),'[]'::jsonb) INTO sets FROM public.set_logs l WHERE l.session_id=session.id AND l.exercise_id=p.exercise_id AND (l.slot_key=p.slot_key OR p.allow_imported AND session.origin='import');
 RETURN jsonb_build_object('policy',to_jsonb(p),'session',to_jsonb(session),'sets',sets);
END $$;
REVOKE ALL ON FUNCTION public.get_training_context(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_training_context(uuid,text) TO authenticated;

CREATE FUNCTION private.validate_policy_override() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.program_versions v CROSS JOIN LATERAL jsonb_array_elements(v.items)i WHERE v.id=NEW.program_version_id AND NEW.slot_key=v.id::text||':'||(i->>'id') AND (i->>'exercise_id')::uuid=NEW.exercise_id) THEN RAISE EXCEPTION 'Policy must reference a real frozen exercise slot';END IF;
 IF NEW.override IS NOT NULL THEN
  IF length(NEW.override->>'reason')>2000 OR (NEW.override->>'weight_kg')::numeric NOT BETWEEN 0 AND 1000 OR (NEW.override->>'reps')::numeric NOT BETWEEN 1 AND 1000 OR (NEW.override->>'duration_seconds')::numeric NOT BETWEEN 1 AND 86400 OR coalesce(NEW.override->>'weight_kg',NEW.override->>'reps',NEW.override->>'duration_seconds') IS NULL THEN RAISE EXCEPTION 'Invalid override target';END IF;
 END IF;RETURN NEW;
END $$;
CREATE TRIGGER validate_policy_override BEFORE INSERT OR UPDATE ON public.training_policies FOR EACH ROW EXECUTE FUNCTION private.validate_policy_override();

-- New published versions carry mode/convention; existing immutable versions remain untouched.
DO $$ DECLARE definition text;BEGIN
 SELECT pg_get_functiondef('private.capture_program_version()'::regprocedure) INTO definition;
 definition=replace(definition,'''equipment'',e.equipment)','''equipment'',e.equipment,''logging_mode'',e.logging_mode,''load_convention'',e.load_convention)');EXECUTE definition;
END $$;
