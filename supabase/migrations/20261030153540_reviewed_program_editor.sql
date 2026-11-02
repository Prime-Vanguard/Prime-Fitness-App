-- Guard reviewed program operations without changing published versions or reward rules.
DO $$ DECLARE tab text; BEGIN
  FOREACH tab IN ARRAY ARRAY['programs','program_items','program_assignments'] LOOP
    EXECUTE format('CREATE POLICY editor_active_inserts ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK ((SELECT private.is_active((SELECT auth.uid()))))',tab);
    EXECUTE format('CREATE POLICY editor_active_updates ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING ((SELECT private.is_active((SELECT auth.uid())))) WITH CHECK ((SELECT private.is_active((SELECT auth.uid()))))',tab);
    EXECUTE format('CREATE POLICY editor_active_deletes ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING ((SELECT private.is_active((SELECT auth.uid()))))',tab);
  END LOOP;
END $$;
CREATE POLICY editor_active_publish ON public.program_versions AS RESTRICTIVE
FOR INSERT TO authenticated WITH CHECK ((SELECT private.is_active((SELECT auth.uid()))));

CREATE FUNCTION private.program_editor_snapshot(_program uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT jsonb_build_object(
  'program',to_jsonb(p),
  'items',(SELECT coalesce(jsonb_agg(to_jsonb(i)-'created_at' ORDER BY i.id),'[]'::jsonb) FROM public.program_items i WHERE i.program_id=p.id),
  'exercises',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',e.id,'name_en',e.name_en,'name_ar',e.name_ar,'muscle',e.muscle,'equipment',e.equipment,'logging_mode',e.logging_mode,'load_convention',e.load_convention) ORDER BY e.id),'[]'::jsonb) FROM public.exercises e WHERE EXISTS(SELECT 1 FROM public.program_items i WHERE i.program_id=p.id AND i.exercise_id=e.id))
 ) FROM public.programs p WHERE p.id=_program
$$;
REVOKE ALL ON FUNCTION private.program_editor_snapshot(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.program_editor_snapshot(uuid) TO authenticated;

-- The capture trigger gained these mode/convention fields in the compatibility migration.
-- Keep the existing publication comparison in sync so an unchanged retry reuses its version.
CREATE OR REPLACE FUNCTION public.publish_program(_program uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE p public.programs; v public.program_versions; content jsonb; result uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT private.is_admin(auth.uid()) OR NOT private.is_active(auth.uid()) THEN RAISE EXCEPTION 'Active administrator access required'; END IF;
 SELECT * INTO STRICT p FROM public.programs WHERE id=_program FOR UPDATE;
 PERFORM 1 FROM public.exercises e WHERE EXISTS(SELECT 1 FROM public.program_items i WHERE i.program_id=p.id AND i.exercise_id=e.id) ORDER BY e.id FOR SHARE;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',i.id,'exercise_id',i.exercise_id,'week',i.week,'day',i.day,'target_sets',i.target_sets,'target_reps',i.target_reps,'position',i.position,'name_en',e.name_en,'name_ar',e.name_ar,'muscle',e.muscle,'equipment',e.equipment,'logging_mode',e.logging_mode,'load_convention',e.load_convention) ORDER BY i.week,i.day,i.position,i.id),'[]'::jsonb)
 INTO content FROM public.program_items i JOIN public.exercises e ON e.id=i.exercise_id WHERE i.program_id=_program;
 SELECT * INTO v FROM public.program_versions WHERE program_id=_program ORDER BY version DESC LIMIT 1;
 IF jsonb_array_length(content)=0 THEN RAISE EXCEPTION 'Add exercises before publishing'; END IF;
 IF v.id IS NOT NULL AND (v.name,v.description,v.weeks,v.items) IS NOT DISTINCT FROM (p.name,p.description,p.weeks,content) THEN RETURN v.id; END IF;
 INSERT INTO public.program_versions(program_id,version,name,weeks,items) VALUES (_program,1,p.name,p.weeks,'[]') RETURNING id INTO result;
 RETURN result;
END $$;

CREATE FUNCTION public.review_program_draft(_program uuid,_action text,_expected jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE p public.programs; snapshot jsonb; wanted jsonb; actual jsonb; source_now jsonb; source_then jsonb; source_exercises jsonb; expected_exercises jsonb; version_id uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT private.is_admin(auth.uid()) OR NOT private.is_active(auth.uid()) THEN RAISE EXCEPTION 'Active administrator access required'; END IF;
 IF _action IS NULL OR _action NOT IN ('copy','publish') OR _expected IS NULL OR jsonb_typeof(_expected)<>'object' THEN RAISE EXCEPTION 'A reviewed program preview is required'; END IF;
 SELECT * INTO STRICT p FROM public.programs WHERE id=_program FOR UPDATE;
 -- Draft item triggers acquire the same parent lock. Exercise share locks retain reviewed identity metadata through capture.
 PERFORM 1 FROM public.exercises e WHERE EXISTS(SELECT 1 FROM public.program_items i WHERE i.program_id=p.id AND i.exercise_id=e.id) ORDER BY e.id FOR SHARE;
 snapshot:=private.program_editor_snapshot(p.id);
 IF _action='copy' AND p.weeks>1 AND snapshot->'program'=_expected->'program' THEN
   SELECT coalesce(jsonb_agg(i ORDER BY i->>'id'),'[]') INTO source_now FROM jsonb_array_elements(snapshot->'items') i WHERE (i->>'week')::int=1;
   SELECT coalesce(jsonb_agg(i ORDER BY i->>'id'),'[]') INTO source_then FROM jsonb_array_elements(_expected->'items') i WHERE (i->>'week')::int=1;
   SELECT coalesce(jsonb_agg(e ORDER BY e->>'id'),'[]') INTO source_exercises FROM jsonb_array_elements(snapshot->'exercises') e WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(source_then) i WHERE i->>'exercise_id'=e->>'id');
   SELECT coalesce(jsonb_agg(e ORDER BY e->>'id'),'[]') INTO expected_exercises FROM jsonb_array_elements(_expected->'exercises') e WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(source_then) i WHERE i->>'exercise_id'=e->>'id');
   SELECT coalesce(jsonb_agg(row ORDER BY row::text),'[]') INTO wanted FROM (SELECT jsonb_set(i-'id','{week}',to_jsonb(w)) row FROM jsonb_array_elements(source_then) i CROSS JOIN generate_series(1,p.weeks) w) rows;
   SELECT coalesce(jsonb_agg(i-'id' ORDER BY (i-'id')::text),'[]') INTO actual FROM jsonb_array_elements(snapshot->'items') i;
   IF jsonb_array_length(source_then)>0 AND source_now=source_then AND source_exercises=expected_exercises AND wanted=actual THEN RETURN jsonb_build_object('copied',true,'already_applied',true); END IF;
 END IF;
 IF snapshot IS DISTINCT FROM _expected THEN RAISE EXCEPTION 'Program preview changed; reload and review again'; END IF;
 IF _action='copy' THEN
   IF p.weeks<2 THEN RAISE EXCEPTION 'Copy requires at least two weeks'; END IF;
   PERFORM public.copy_program_week_one(p.id);
   RETURN jsonb_build_object('copied',true);
 END IF;
 version_id:=public.publish_program(p.id);
 RETURN jsonb_build_object('version_id',version_id);
END $$;
REVOKE ALL ON FUNCTION public.review_program_draft(uuid,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.review_program_draft(uuid,text,jsonb) TO authenticated;

CREATE FUNCTION public.review_program_assignment(_member uuid,_version uuid,_expected uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE current_assignment public.program_assignments;
BEGIN
 IF auth.uid() IS NULL OR NOT private.is_admin(auth.uid()) OR NOT private.is_active(auth.uid()) THEN RAISE EXCEPTION 'Active administrator access required'; END IF;
 PERFORM 1 FROM public.profiles WHERE id=_member FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Member unavailable'; END IF;
 SELECT * INTO current_assignment FROM public.program_assignments WHERE member_id=_member AND active;
 IF current_assignment.program_version_id=_version THEN RETURN current_assignment.id; END IF;
 IF current_assignment.id IS DISTINCT FROM _expected THEN RAISE EXCEPTION 'Active assignment changed; reload and review again'; END IF;
 RETURN public.assign_program_version(_member,_version);
END $$;
REVOKE ALL ON FUNCTION public.review_program_assignment(uuid,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.review_program_assignment(uuid,uuid,uuid) TO authenticated;
