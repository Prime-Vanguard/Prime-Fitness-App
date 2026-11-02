SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='120s';
ALTER TABLE public.training_rollout ADD COLUMN available boolean NOT NULL DEFAULT true;
CREATE OR REPLACE FUNCTION private.training_enabled(_feature text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT private.is_active(auth.uid()) AND EXISTS(SELECT 1 FROM public.training_rollout WHERE feature=_feature AND available AND (enabled OR (staff_enabled AND (private.is_admin(auth.uid()) OR private.has_role(auth.uid(),'coach'))) OR EXISTS(SELECT 1 FROM public.training_pilots WHERE member_id=auth.uid())))
$$;
ALTER TABLE private.member_mutation_receipts ADD CONSTRAINT member_receipts_owner_fk FOREIGN KEY(member_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE private.member_sync_tombstones ADD CONSTRAINT member_tombstones_owner_fk FOREIGN KEY(member_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
CREATE OR REPLACE FUNCTION private.can_coach_member(_member uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT private.is_active(auth.uid()) AND (private.is_admin(auth.uid()) OR private.has_role(auth.uid(),'coach') AND EXISTS(SELECT 1 FROM public.coach_assignments WHERE member_id=_member AND coach_id=auth.uid() AND active))
$$;
CREATE UNIQUE INDEX set_logs_working_side_unique ON public.set_logs(member_id,session_id,exercise_id,slot_key,pair_id,side) WHERE pair_id IS NOT NULL AND set_role='working';
CREATE TABLE private.import_chunk_receipts(member_id uuid NOT NULL,batch_id uuid NOT NULL,fingerprint text NOT NULL,result jsonb NOT NULL,PRIMARY KEY(member_id,batch_id,fingerprint));
ALTER TABLE private.import_chunk_receipts ADD CONSTRAINT import_chunks_owner_fk FOREIGN KEY(member_id) REFERENCES public.profiles(id) ON DELETE CASCADE,ADD CONSTRAINT import_chunks_batch_fk FOREIGN KEY(batch_id) REFERENCES public.import_batches(id) ON DELETE CASCADE;
CREATE INDEX import_chunks_batch_idx ON private.import_chunk_receipts(batch_id);
ALTER TABLE private.import_chunk_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.import_chunk_receipts FROM PUBLIC,anon,authenticated;
CREATE FUNCTION private.import_chunk_receipt(_batch uuid,_hash text,_result jsonb DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 IF NOT private.training_enabled('imports') OR NOT EXISTS(SELECT 1 FROM public.import_batches WHERE id=_batch AND member_id=auth.uid()) THEN RAISE EXCEPTION 'Own active import batch required';END IF;
 SELECT r.result INTO result FROM private.import_chunk_receipts r WHERE member_id=auth.uid() AND batch_id=_batch AND fingerprint=_hash;
 IF result IS NOT NULL THEN RETURN result;END IF;
 IF _result IS NOT NULL THEN INSERT INTO private.import_chunk_receipts VALUES(auth.uid(),_batch,_hash,_result);END IF;RETURN _result;
END $$;
REVOKE ALL ON FUNCTION private.import_chunk_receipt(uuid,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.import_chunk_receipt(uuid,text,jsonb) TO authenticated;
CREATE FUNCTION private.import_batch_outcome(_batch uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('accepted',coalesce(sum((result->>'accepted')::int),0),'skipped',coalesce(sum((result->>'skipped')::int),0),'chunks',count(*)) FROM private.import_chunk_receipts WHERE member_id=auth.uid() AND batch_id=_batch AND EXISTS(SELECT 1 FROM public.import_batches WHERE id=_batch AND member_id=auth.uid())
$$;
REVOKE ALL ON FUNCTION private.import_batch_outcome(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.import_batch_outcome(uuid) TO authenticated;
CREATE FUNCTION public.get_import_batch_outcome(_batch uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT private.import_batch_outcome(_batch) $$;
REVOKE ALL ON FUNCTION public.get_import_batch_outcome(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_import_batch_outcome(uuid) TO authenticated;
DO $$ DECLARE definition text;BEGIN
 SELECT pg_get_functiondef('public.xp_on_workout()'::regprocedure) INTO definition;
 definition=replace(definition,'AND reps>0','AND set_role=''working'' AND (reps>0 OR duration_seconds>0)');
 IF position('duration_seconds' IN definition)=0 THEN RAISE EXCEPTION 'Qualifying workout predicate was not upgraded';END IF;
 EXECUTE definition;
END $$;
-- A daily singleton created on another device is a resolvable conflict, not data loss.
DO $$ DECLARE definition text;BEGIN
 SELECT pg_get_functiondef('public.apply_member_mutations(jsonb)'::regprocedure) INTO definition;
 definition=replace(definition,'result=jsonb_build_object(''id'',mid,''status'',''applied'',''record'',oldrow,''revision'',rev)','result=jsonb_build_object(''id'',mid,''entity'',tab,''record_id'',rid,''status'',''applied'',''record'',oldrow,''revision'',rev)');
 definition=replace(definition,'rev=coalesce((oldrow->>''revision'')::bigint,private.sync_tombstone(tab,rid));',E'IF oldrow IS NULL AND tab=''wellness_checkins'' THEN\n SELECT to_jsonb(t) INTO oldrow FROM public.wellness_checkins t WHERE member_id=auth.uid() AND log_date=(m->''payload''->>''log_date'')::date;\n END IF;\n rev=coalesce((oldrow->>''revision'')::bigint,private.sync_tombstone(tab,rid));');
 definition=replace(definition,'IF rev<>coalesce((m->>''base_revision'')::bigint,0) THEN','IF rev<>coalesce((m->>''base_revision'')::bigint,0) OR (oldrow IS NOT NULL AND (oldrow->>''id'')::uuid<>rid) THEN');
 EXECUTE definition;
 SELECT pg_get_functiondef('public.get_admin_analytics()'::regprocedure) INTO definition;
 definition=replace(definition,'WHERE s.finished_at>=','WHERE s.origin=''native'' AND s.finished_at>=');EXECUTE definition;
 -- A source fingerprint ignores input row order; content fingerprints ignore transient set IDs.
 SELECT pg_get_functiondef('public.commit_training_import(uuid,text,jsonb)'::regprocedure) INTO definition;
 definition=replace(definition,'INSERT INTO public.workout_sessions(id,member_id,title,started_at,origin,activity_date,import_batch_id,time_precision) VALUES(sid,auth.uid(),left(w->>''title'',200),start_time','INSERT INTO public.workout_sessions(id,member_id,title,notes,started_at,origin,activity_date,import_batch_id,time_precision) VALUES(sid,auth.uid(),left(w->>''title'',200),w->>''notes'',start_time');
 definition=replace(definition,'DECLARE w jsonb;','DECLARE chunk_hash text; cached jsonb; w jsonb;');
 definition=replace(definition,'FOR w IN SELECT value FROM jsonb_array_elements(_workouts) LOOP',E'SELECT md5(jsonb_agg(jsonb_build_object(''title'',doc->>''title'',''date'',doc->>''activity_date'',''source'',doc->''source_rows'',''sets'',(SELECT jsonb_agg(s-ARRAY[''id'',''pair_id'',''root_set_id'',''slot_key''] ORDER BY (s-ARRAY[''id'',''pair_id'',''root_set_id'',''slot_key''])::text) FROM jsonb_array_elements(doc->''sets'')s)) ORDER BY doc->>''activity_date'',doc->>''title'')::text) INTO chunk_hash FROM jsonb_array_elements(_workouts) AS entries(doc);\n IF chunk_hash IS NULL THEN RAISE EXCEPTION ''Import chunk cannot be empty'';END IF;\n cached=private.import_chunk_receipt(_batch,chunk_hash);IF cached IS NOT NULL THEN RETURN cached;END IF;\n FOR w IN SELECT value FROM jsonb_array_elements(_workouts) LOOP');
 definition=replace(definition,'RETURN jsonb_build_object(''accepted'',accepted,''skipped'',skipped,''batch_id'',_batch);','RETURN private.import_chunk_receipt(_batch,chunk_hash,jsonb_build_object(''accepted'',accepted,''skipped'',skipped,''batch_id'',_batch));');
 definition=replace(definition,'source_hash=md5(jsonb_build_object(''date'',activity,''title'',w->>''title'',''source'',w->''source_rows'')::text);',E'IF jsonb_typeof(w->''source_rows'') IS DISTINCT FROM ''array'' OR jsonb_array_length(w->''source_rows'')=0 THEN RAISE EXCEPTION ''Import source rows required'';END IF;\n SELECT md5(jsonb_build_object(''date'',activity,''title'',w->>''title'',''source'',jsonb_agg(value ORDER BY value::text))::text) INTO source_hash FROM jsonb_array_elements(w->''source_rows'');');
 definition=replace(definition,'''date'',activity,''sets'',jsonb_agg','''date'',activity,''started_at'',w->>''started_at'',''sets'',jsonb_agg');
 EXECUTE definition;
END $$;

-- An old acknowledgement must reflect newer server edits/deletions, never resurrect old content.
CREATE OR REPLACE FUNCTION private.mutation_receipt(_id uuid,_hash text,_result jsonb DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE receipt private.member_mutation_receipts; tab text; rid uuid; current_record jsonb; current_revision bigint;
BEGIN
 IF auth.uid() IS NULL OR NOT private.is_active(auth.uid()) THEN RAISE EXCEPTION 'Active member required';END IF;
 SELECT * INTO receipt FROM private.member_mutation_receipts WHERE member_id=auth.uid() AND mutation_id=_id;
 IF receipt.mutation_id IS NOT NULL THEN
  IF receipt.fingerprint<>_hash THEN RAISE EXCEPTION 'Mutation identity cannot be reused with different content';END IF;
  tab=receipt.result->>'entity';rid=(receipt.result->>'record_id')::uuid;
  IF tab IN ('food_logs','water_logs','body_measurements','wellness_checkins','saved_meals') AND rid IS NOT NULL THEN
   EXECUTE format('SELECT to_jsonb(t) FROM public.%I t WHERE id=$1 AND member_id=$2',tab) INTO current_record USING rid,auth.uid();
   current_revision=coalesce((current_record->>'revision')::bigint,private.sync_tombstone(tab,rid));
   RETURN receipt.result||jsonb_build_object('status','already_applied','record',current_record,'revision',current_revision);
  END IF;RETURN receipt.result||jsonb_build_object('status','already_applied');
 END IF;
 IF _result IS NOT NULL THEN INSERT INTO private.member_mutation_receipts VALUES(auth.uid(),_id,_hash,_result);END IF;RETURN _result;
END $$;
CREATE FUNCTION private.redact_member_receipts() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 UPDATE private.member_mutation_receipts SET result=jsonb_set(result,'{record}','null'::jsonb) WHERE member_id=OLD.member_id AND (result->>'record_id'=OLD.id::text OR result->'record'->>'id'=OLD.id::text);
 IF EXISTS(SELECT 1 FROM public.profiles WHERE id=OLD.member_id) THEN INSERT INTO private.member_sync_tombstones VALUES(OLD.member_id,TG_TABLE_NAME,OLD.id,OLD.revision+1) ON CONFLICT(member_id,entity,record_id) DO UPDATE SET revision=greatest(private.member_sync_tombstones.revision,EXCLUDED.revision);END IF;
 RETURN OLD;
END $$;
REVOKE ALL ON FUNCTION private.redact_member_receipts() FROM PUBLIC,anon,authenticated;
DO $$ DECLARE tab text;BEGIN FOREACH tab IN ARRAY ARRAY['food_logs','water_logs','body_measurements','wellness_checkins','saved_meals'] LOOP EXECUTE format('CREATE TRIGGER redact_member_receipts AFTER DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION private.redact_member_receipts()',tab);END LOOP;END $$;

CREATE OR REPLACE FUNCTION private.guard_workout_origin() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF TG_OP='UPDATE' AND (NEW.origin,NEW.activity_date,NEW.import_batch_id,NEW.time_precision) IS DISTINCT FROM (OLD.origin,OLD.activity_date,OLD.import_batch_id,OLD.time_precision) THEN RAISE EXCEPTION 'Workout provenance is immutable';END IF;
 IF TG_OP='UPDATE' AND OLD.origin='import' AND OLD.finished_at IS NOT NULL THEN NEW.import_edited=OLD.import_edited OR NEW.import_edited OR (to_jsonb(NEW)-ARRAY['updated_at','import_edited']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['updated_at','import_edited']);END IF;
 RETURN NEW;
END $$;
DO $$ DECLARE tab text;BEGIN FOREACH tab IN ARRAY ARRAY['food_logs','water_logs','body_measurements','saved_meals'] LOOP EXECUTE format('CREATE POLICY active_member_deletes ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING((SELECT private.is_active((SELECT auth.uid()))))',tab);END LOOP;END $$;

-- Read-only snapshot restore, scoped to existing owned sessions. No client table write grant.
CREATE FUNCTION private.restore_exercise_snapshots(_rows jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT private.is_active(auth.uid()) OR current_setting('prime.restore_member',true) IS DISTINCT FROM auth.uid()::text THEN RAISE EXCEPTION 'Active personal restore required';END IF;
 IF jsonb_typeof(_rows) IS DISTINCT FROM 'array' OR jsonb_array_length(_rows)>100000 THEN RAISE EXCEPTION 'Invalid workout snapshots';END IF;
 FOR r IN SELECT value FROM jsonb_array_elements(_rows) LOOP
  IF (r->>'member_id') IS DISTINCT FROM auth.uid()::text OR NOT EXISTS(SELECT 1 FROM public.workout_sessions WHERE id=(r->>'session_id')::uuid AND member_id=auth.uid()) OR jsonb_typeof(r->'snapshot') IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid snapshot ownership';END IF;
  INSERT INTO public.workout_exercises(id,session_id,member_id,exercise_id,slot_key,snapshot) VALUES((r->>'id')::uuid,(r->>'session_id')::uuid,auth.uid(),(r->>'exercise_id')::uuid,coalesce(r->>'slot_key',''),r->'snapshot') ON CONFLICT DO NOTHING;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION private.restore_exercise_snapshots(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.restore_exercise_snapshots(jsonb) TO authenticated;
DO $$ DECLARE definition text;BEGIN
 SELECT pg_get_functiondef('public.restore_personal_data(jsonb,boolean)'::regprocedure) INTO definition;
 definition=replace(definition,'-- Recover deleted sets',E'PERFORM private.restore_exercise_snapshots(coalesce(_data->''workout_exercises'',''[]''::jsonb));\n  -- Recover deleted sets');
 EXECUTE definition;
 -- Preserve frozen metadata for program-linked slots; current guidance can still improve independently.
 SELECT pg_get_functiondef('private.capture_workout_exercise()'::regprocedure) INTO definition;
 definition=replace(definition,'NEW.workout_exercise_id=slot.id;RETURN NEW;',E'IF TG_OP=''INSERT'' AND NEW.slot_key LIKE ''%:%'' THEN\n UPDATE public.workout_exercises x SET snapshot=x.snapshot || (SELECT jsonb_build_object(''name_en'',i->''name_en'',''name_ar'',i->''name_ar'',''muscle'',i->''muscle'',''equipment'',i->''equipment'') FROM public.program_versions v CROSS JOIN LATERAL jsonb_array_elements(v.items)i WHERE EXISTS(SELECT 1 FROM public.program_assignments a WHERE a.program_version_id=v.id AND a.member_id=NEW.member_id) AND NEW.slot_key=v.id::text||'':''||(i->>''id'') AND (i->>''exercise_id'')::uuid=NEW.exercise_id LIMIT 1) WHERE x.id=slot.id AND EXISTS(SELECT 1 FROM public.program_versions v CROSS JOIN LATERAL jsonb_array_elements(v.items)i WHERE EXISTS(SELECT 1 FROM public.program_assignments a WHERE a.program_version_id=v.id AND a.member_id=NEW.member_id) AND NEW.slot_key=v.id::text||'':''||(i->>''id'') AND (i->>''exercise_id'')::uuid=NEW.exercise_id);\n END IF;\n NEW.workout_exercise_id=slot.id;RETURN NEW;');
 EXECUTE definition;
END $$;
