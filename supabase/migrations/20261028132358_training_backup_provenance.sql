SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='120s';
CREATE FUNCTION private.restore_import_receipts(_rows jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT private.is_active(auth.uid()) OR current_setting('prime.restore_member',true) IS DISTINCT FROM auth.uid()::text THEN RAISE EXCEPTION 'Active personal restore required';END IF;
 IF jsonb_typeof(_rows) IS DISTINCT FROM 'array' OR jsonb_array_length(_rows)>100000 THEN RAISE EXCEPTION 'Invalid import receipts';END IF;
 FOR r IN SELECT value FROM jsonb_array_elements(_rows) LOOP
  IF r->>'member_id' IS DISTINCT FROM auth.uid()::text
   OR coalesce(r->>'fingerprint','') !~ '^[a-f0-9]{32}$'
   OR coalesce(r->>'content_fingerprint','') !~ '^[a-f0-9]{32}$'
   OR NOT EXISTS(SELECT 1 FROM public.import_batches b WHERE b.id=(r->>'batch_id')::uuid AND b.member_id=auth.uid() AND b.provider=r->>'provider')
   OR (r->>'session_id' IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.workout_sessions s WHERE s.id=(r->>'session_id')::uuid AND s.member_id=auth.uid() AND s.origin='import' AND s.import_batch_id=(r->>'batch_id')::uuid))
  THEN RAISE EXCEPTION 'Invalid import receipt ownership or provenance';END IF;
  INSERT INTO public.import_receipts(member_id,provider,fingerprint,content_fingerprint,batch_id,session_id)
  VALUES(auth.uid(),r->>'provider',r->>'fingerprint',r->>'content_fingerprint',(r->>'batch_id')::uuid,(r->>'session_id')::uuid) ON CONFLICT DO NOTHING;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION private.restore_import_receipts(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.restore_import_receipts(jsonb) TO authenticated;
DO $$ DECLARE definition text;BEGIN
 SELECT pg_get_functiondef('public.restore_personal_data(jsonb,boolean)'::regprocedure) INTO definition;
 IF position('USING rows;' IN definition)=0 OR position('RETURN jsonb_build_object(''inserted''' IN definition)=0 THEN RAISE EXCEPTION 'Restore definition changed; review compatibility patch';END IF;
 definition=replace(definition,'USING rows;',E'USING CASE WHEN tab=''set_logs'' THEN (SELECT jsonb_agg(r ORDER BY coalesce(r->>''set_role'',''working'')=''drop'',coalesce((r->>''segment_index'')::integer,0),r->>''id'') FROM jsonb_array_elements(rows)r) ELSE rows END;');
 definition=replace(definition,'RETURN jsonb_build_object(''inserted''',E'PERFORM private.restore_import_receipts(coalesce(_data->''import_receipts'',''[]''::jsonb));\n  RETURN jsonb_build_object(''inserted''');
 EXECUTE definition;
END $$;
