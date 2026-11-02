SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='120s';
-- JSON order alone is insufficient: an INSERT SELECT anti-join may reorder its inputs.
-- Separate statements make working roots visible before drop-segment triggers run.
CREATE FUNCTION private.restore_set_graph(_rows jsonb) RETURNS integer
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE pass integer; inserted integer; total integer=0;
BEGIN
 IF auth.uid() IS NULL OR NOT private.is_active(auth.uid()) OR current_setting('prime.restore_member',true) IS DISTINCT FROM auth.uid()::text THEN RAISE EXCEPTION 'Active personal restore required';END IF;
 IF jsonb_typeof(_rows) IS DISTINCT FROM 'array' OR jsonb_array_length(_rows)>100000 THEN RAISE EXCEPTION 'Invalid set records';END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(_rows)r WHERE r->>'member_id' IS DISTINCT FROM auth.uid()::text) THEN RAISE EXCEPTION 'Invalid set ownership';END IF;
 FOR pass IN 0..1 LOOP
  INSERT INTO public.set_logs SELECT r.* FROM jsonb_populate_recordset(NULL::public.set_logs,_rows)r
  WHERE (coalesce(r.set_role,'working')='drop')=(pass=1)
  AND NOT EXISTS(SELECT 1 FROM public.set_logs s WHERE s.id=r.id)
  ON CONFLICT(id) DO NOTHING;
  GET DIAGNOSTICS inserted=ROW_COUNT;total:=total+inserted;
 END LOOP;
 RETURN total;
END $$;
REVOKE ALL ON FUNCTION private.restore_set_graph(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.restore_set_graph(jsonb) TO authenticated;
DO $$ DECLARE definition text; start_at integer; finish_at integer; original text;BEGIN
 SELECT pg_get_functiondef('public.restore_personal_data(jsonb,boolean)'::regprocedure) INTO definition;
 start_at:=strpos(definition,'EXECUTE format(''INSERT INTO public.%I');
 IF start_at=0 THEN RAISE EXCEPTION 'Restore insert definition changed';END IF;
 finish_at:=strpos(substr(definition,start_at),'GET DIAGNOSTICS n=ROW_COUNT;');
 IF finish_at=0 THEN RAISE EXCEPTION 'Restore count definition changed';END IF;
 original:=substr(definition,start_at,finish_at-1+length('GET DIAGNOSTICS n=ROW_COUNT;'));
 definition:=replace(definition,original,E'IF tab=''set_logs'' THEN n:=private.restore_set_graph(rows); ELSE\n'||original||E'\nEND IF;');
 EXECUTE definition;
END $$;
