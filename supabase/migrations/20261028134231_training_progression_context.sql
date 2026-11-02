SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='120s';
CREATE OR REPLACE FUNCTION public.get_training_context(_member uuid,_slot text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE p public.training_policies; session public.workout_sessions; sets jsonb; item jsonb; expected jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT private.training_enabled('progression') OR NOT (_member=auth.uid() OR private.can_coach_member(_member)) THEN RAISE EXCEPTION 'Training context unavailable';END IF;
 SELECT * INTO p FROM public.training_policies WHERE member_id=_member AND slot_key=_slot AND EXISTS(SELECT 1 FROM public.program_assignments a WHERE a.member_id=_member AND a.program_version_id=training_policies.program_version_id AND a.active);
 IF p.id IS NULL THEN RETURN NULL;END IF;
 SELECT i INTO item FROM public.program_versions v CROSS JOIN LATERAL jsonb_array_elements(v.items)i WHERE v.id=p.program_version_id AND p.slot_key=v.id::text||':'||(i->>'id') AND (i->>'exercise_id')::uuid=p.exercise_id;
 IF item IS NULL THEN RETURN NULL;END IF;
 expected:=jsonb_build_object('logging_mode',coalesce(item->>'logging_mode','weighted_reps'),'load_convention',coalesce(item->>'load_convention','external_total'));
 SELECT s.* INTO session FROM public.workout_sessions s WHERE s.member_id=_member AND s.finished_at IS NOT NULL AND (s.origin='native' OR p.allow_imported)
 AND EXISTS(SELECT 1 FROM public.set_logs l WHERE l.session_id=s.id AND l.exercise_id=p.exercise_id AND l.set_role='working' AND (l.slot_key=p.slot_key OR p.allow_imported AND s.origin='import') AND l.logging_mode=expected->>'logging_mode' AND l.load_convention=expected->>'load_convention')
 ORDER BY s.finished_at DESC,s.id DESC LIMIT 1;
 SELECT coalesce(jsonb_agg(to_jsonb(l) ORDER BY l.set_number,l.id),'[]'::jsonb) INTO sets FROM public.set_logs l WHERE l.session_id=session.id AND l.exercise_id=p.exercise_id AND (l.slot_key=p.slot_key OR p.allow_imported AND session.origin='import') AND l.logging_mode=expected->>'logging_mode' AND l.load_convention=expected->>'load_convention';
 RETURN jsonb_build_object('policy',to_jsonb(p),'session',to_jsonb(session),'sets',sets,'expected',expected);
END $$;
