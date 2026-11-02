SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

CREATE TABLE public.program_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES public.programs(id) ON DELETE RESTRICT,
  version integer NOT NULL CHECK (version > 0),
  name text NOT NULL,
  description text,
  weeks integer NOT NULL CHECK (weeks BETWEEN 1 AND 52),
  items jsonb NOT NULL CHECK (jsonb_typeof(items) = 'array'),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(program_id,version)
);
CREATE INDEX program_versions_created_by_idx ON public.program_versions(created_by);
ALTER TABLE public.program_assignments ADD COLUMN program_version_id uuid REFERENCES public.program_versions(id) ON DELETE RESTRICT;
CREATE INDEX program_assignments_version_idx ON public.program_assignments(program_version_id);

-- Preserve the routines existing members were assigned before changing the read path.
INSERT INTO public.program_versions(program_id,version,name,description,weeks,items,created_by)
  SELECT p.id,1,p.name,p.description,p.weeks,
    coalesce((SELECT jsonb_agg(jsonb_build_object('id',i.id,'exercise_id',i.exercise_id,'week',i.week,'day',i.day,'target_sets',i.target_sets,'target_reps',i.target_reps,'position',i.position,'name_en',e.name_en,'name_ar',e.name_ar,'muscle',e.muscle,'equipment',e.equipment) ORDER BY i.week,i.day,i.position,i.id)
      FROM public.program_items i JOIN public.exercises e ON e.id=i.exercise_id WHERE i.program_id=p.id),'[]'::jsonb),p.created_by
  FROM public.programs p;
UPDATE public.program_assignments a SET program_version_id=v.id FROM public.program_versions v WHERE v.program_id=a.program_id AND v.version=1;
ALTER TABLE public.program_assignments ALTER COLUMN program_version_id SET NOT NULL;
-- The app already selected the latest assignment; retain that effective choice.
WITH ranked AS (SELECT id,row_number() OVER (PARTITION BY member_id ORDER BY created_at DESC,id DESC) AS n FROM public.program_assignments WHERE active)
UPDATE public.program_assignments a SET active=false FROM ranked r WHERE a.id=r.id AND r.n>1;
CREATE UNIQUE INDEX program_assignments_one_active_idx ON public.program_assignments(member_id) WHERE active;

ALTER TABLE public.program_versions ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT ON public.program_versions TO authenticated;
GRANT ALL ON public.program_versions TO service_role;
CREATE POLICY "versions read" ON public.program_versions FOR SELECT TO authenticated USING (
  (SELECT private.is_admin((SELECT auth.uid()))) OR EXISTS (SELECT 1 FROM public.program_assignments a WHERE a.program_version_id=program_versions.id AND (a.member_id=(SELECT auth.uid()) OR private.manages_member((SELECT auth.uid()),a.member_id)))
);
CREATE POLICY "versions admin publish" ON public.program_versions FOR INSERT TO authenticated WITH CHECK ((SELECT private.is_admin((SELECT auth.uid()))));

CREATE FUNCTION private.lock_program_draft() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  IF TG_OP='INSERT' THEN PERFORM 1 FROM public.programs WHERE id=NEW.program_id FOR UPDATE;
  ELSIF TG_OP='DELETE' THEN PERFORM 1 FROM public.programs WHERE id=OLD.program_id FOR UPDATE;
  ELSE PERFORM 1 FROM public.programs WHERE id IN (OLD.program_id,NEW.program_id) ORDER BY id FOR UPDATE;
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER lock_program_draft BEFORE INSERT OR UPDATE OR DELETE ON public.program_items FOR EACH ROW EXECUTE FUNCTION private.lock_program_draft();

CREATE FUNCTION private.capture_program_version() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE p public.programs;
BEGIN
  IF auth.uid() IS NULL OR NOT private.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Only admins can publish programs'; END IF;
  SELECT * INTO STRICT p FROM public.programs WHERE id=NEW.program_id FOR UPDATE;
  IF EXISTS (SELECT 1 FROM public.program_items WHERE program_id=p.id AND (week NOT BETWEEN 1 AND p.weeks OR day NOT BETWEEN 1 AND 7 OR target_sets NOT BETWEEN 1 AND 100 OR length(btrim(target_reps)) NOT BETWEEN 1 AND 64)) THEN RAISE EXCEPTION 'Fix invalid program prescriptions before publishing'; END IF;
  SELECT coalesce(max(version),0)+1 INTO NEW.version FROM public.program_versions WHERE program_id=p.id;
  NEW.name:=p.name; NEW.description:=p.description; NEW.weeks:=p.weeks; NEW.created_by:=auth.uid(); NEW.created_at:=now();
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',i.id,'exercise_id',i.exercise_id,'week',i.week,'day',i.day,'target_sets',i.target_sets,'target_reps',i.target_reps,'position',i.position,'name_en',e.name_en,'name_ar',e.name_ar,'muscle',e.muscle,'equipment',e.equipment) ORDER BY i.week,i.day,i.position,i.id),'[]'::jsonb)
    INTO NEW.items FROM public.program_items i JOIN public.exercises e ON e.id=i.exercise_id WHERE i.program_id=p.id;
  IF jsonb_array_length(NEW.items)=0 THEN RAISE EXCEPTION 'Add exercises before publishing'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER capture_program_version BEFORE INSERT ON public.program_versions FOR EACH ROW EXECUTE FUNCTION private.capture_program_version();
CREATE FUNCTION private.immutable_program_version() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  IF TG_OP='UPDATE' AND NEW.created_by IS NULL AND OLD.created_by IS NOT NULL AND (to_jsonb(NEW)-'created_by')=(to_jsonb(OLD)-'created_by') THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'Published program versions are immutable';
END $$;
CREATE TRIGGER immutable_program_version BEFORE UPDATE OR DELETE ON public.program_versions FOR EACH ROW EXECUTE FUNCTION private.immutable_program_version();
CREATE FUNCTION private.guard_program_assignment() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  IF TG_OP='UPDATE' AND (NEW.member_id,NEW.program_id,NEW.program_version_id) IS DISTINCT FROM (OLD.member_id,OLD.program_id,OLD.program_version_id) THEN RAISE EXCEPTION 'Create a new assignment to change its version'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.program_versions WHERE id=NEW.program_version_id AND program_id=NEW.program_id) THEN RAISE EXCEPTION 'Assign a published version of this program'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_program_assignment BEFORE INSERT OR UPDATE ON public.program_assignments FOR EACH ROW EXECUTE FUNCTION private.guard_program_assignment();

CREATE FUNCTION public.copy_program_week_one(_program uuid) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE p public.programs;
BEGIN
  IF auth.uid() IS NULL OR NOT private.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Only admins can edit programs'; END IF;
  SELECT * INTO STRICT p FROM public.programs WHERE id=_program FOR UPDATE;
  IF NOT EXISTS (SELECT 1 FROM public.program_items WHERE program_id=_program AND week=1) THEN RAISE EXCEPTION 'Week one is empty; nothing was replaced'; END IF;
  DELETE FROM public.program_items WHERE program_id=_program AND week>1;
  INSERT INTO public.program_items(program_id,week,day,exercise_id,target_sets,target_reps,position)
    SELECT _program,w,i.day,i.exercise_id,i.target_sets,i.target_reps,i.position FROM public.program_items i CROSS JOIN generate_series(2,p.weeks) w WHERE i.program_id=_program AND i.week=1;
END $$;
CREATE FUNCTION public.publish_program(_program uuid) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE p public.programs; v public.program_versions; content jsonb; result uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT private.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Only admins can publish programs'; END IF;
  SELECT * INTO STRICT p FROM public.programs WHERE id=_program FOR UPDATE;
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',i.id,'exercise_id',i.exercise_id,'week',i.week,'day',i.day,'target_sets',i.target_sets,'target_reps',i.target_reps,'position',i.position,'name_en',e.name_en,'name_ar',e.name_ar,'muscle',e.muscle,'equipment',e.equipment) ORDER BY i.week,i.day,i.position,i.id),'[]'::jsonb)
    INTO content FROM public.program_items i JOIN public.exercises e ON e.id=i.exercise_id WHERE i.program_id=_program;
  SELECT * INTO v FROM public.program_versions WHERE program_id=_program ORDER BY version DESC LIMIT 1;
  IF jsonb_array_length(content)=0 THEN RAISE EXCEPTION 'Add exercises before publishing'; END IF;
  IF v.id IS NOT NULL AND (v.name,v.description,v.weeks,v.items) IS NOT DISTINCT FROM (p.name,p.description,p.weeks,content) THEN RETURN v.id; END IF;
  INSERT INTO public.program_versions(program_id,version,name,weeks,items) VALUES (_program,1,p.name,p.weeks,'[]') RETURNING id INTO result;
  RETURN result;
END $$;
CREATE FUNCTION public.assign_program_version(_member uuid,_version uuid) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE v public.program_versions; result uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT private.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Only admins can assign programs'; END IF;
  SELECT * INTO STRICT v FROM public.program_versions WHERE id=_version;
  IF jsonb_array_length(v.items)=0 THEN RAISE EXCEPTION 'Cannot assign an empty program version'; END IF;
  PERFORM 1 FROM public.profiles WHERE id=_member FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Member not found'; END IF;
  SELECT id INTO result FROM public.program_assignments WHERE member_id=_member AND active AND program_version_id=_version;
  IF result IS NOT NULL THEN RETURN result; END IF;
  UPDATE public.program_assignments SET active=false WHERE member_id=_member AND active;
  INSERT INTO public.program_assignments(program_id,program_version_id,member_id,assigned_by,start_date) VALUES (v.program_id,v.id,_member,auth.uid(),(now() AT TIME ZONE 'Africa/Cairo')::date) RETURNING id INTO result;
  RETURN result;
END $$;
REVOKE EXECUTE ON FUNCTION private.lock_program_draft(),private.capture_program_version(),private.immutable_program_version(),private.guard_program_assignment() FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.copy_program_week_one(uuid),public.publish_program(uuid),public.assign_program_version(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.copy_program_week_one(uuid),public.publish_program(uuid),public.assign_program_version(uuid,uuid) TO authenticated;

CREATE VIEW public.member_activity_days WITH(security_invoker=true) AS
  SELECT member_id,(started_at AT TIME ZONE 'Africa/Cairo')::date AS activity_date FROM public.workout_sessions WHERE finished_at IS NOT NULL
  UNION SELECT member_id,log_date FROM public.food_logs
  UNION SELECT member_id,shield_date FROM public.streak_shields;
CREATE VIEW public.member_pv_totals WITH(security_invoker=true) AS SELECT member_id,sum(points)::bigint AS points FROM public.pv_ledger GROUP BY member_id;
GRANT SELECT ON public.member_activity_days,public.member_pv_totals TO authenticated;

-- One database snapshot, independent of the REST row limit. Rewards and access
-- records are exported for reference, never accepted by the restore operation.
CREATE FUNCTION public.export_personal_data() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE result jsonb='{}'; tab text; rows jsonb; uid uuid=auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Sign in before exporting'; END IF;
  FOREACH tab IN ARRAY ARRAY['workout_sessions','set_logs','food_logs','water_logs','body_measurements','saved_meals','progress_photos','nutrition_targets','program_assignments','xp_events','pv_ledger','pv_claims','redemptions','member_badges','streak_shields','notifications','user_roles','pod_members'] LOOP
    EXECUTE format('SELECT coalesce(jsonb_agg(to_jsonb(t)),''[]''::jsonb) FROM public.%I t WHERE %I=$1',tab,CASE WHEN tab='user_roles' THEN 'user_id' ELSE 'member_id' END) INTO rows USING uid;
    result:=result || jsonb_build_object(tab,rows);
  END LOOP;
  SELECT to_jsonb(p) INTO rows FROM public.profiles p WHERE id=uid;
  result:=result || jsonb_build_object('profile',rows);
  SELECT coalesce(jsonb_agg(to_jsonb(v)),'[]') INTO rows FROM public.program_versions v WHERE EXISTS(SELECT 1 FROM public.program_assignments a WHERE a.member_id=uid AND a.program_version_id=v.id);
  result:=result || jsonb_build_object('program_versions',rows);
  SELECT coalesce(jsonb_agg(to_jsonb(e)),'[]') INTO rows FROM public.exercises e WHERE EXISTS(SELECT 1 FROM public.set_logs s WHERE s.member_id=uid AND s.exercise_id=e.id);
  RETURN result || jsonb_build_object('exercises',rows);
END $$;

-- Add missing personal records only. Existing rows, roles, assignments, rewards,
-- claims, shields and privacy choices are preserved. All writes remain under RLS.
CREATE FUNCTION public.restore_personal_data(_data jsonb,_preferences boolean DEFAULT false) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE uid uuid=auth.uid(); tab text; row jsonb; rows jsonb; session public.workout_sessions; existing public.workout_sessions;
  finishes jsonb='{}'; counts jsonb='{}'; n integer; wanted integer; found_count integer; new_sessions integer=0;
BEGIN
  IF uid IS NULL OR NOT private.is_active(uid) THEN RAISE EXCEPTION 'An active membership is required to restore'; END IF;
  IF jsonb_typeof(_data) IS DISTINCT FROM 'object' OR octet_length(_data::text)>33554432 THEN RAISE EXCEPTION 'Invalid or oversized backup data'; END IF;
  FOREACH tab IN ARRAY ARRAY['workout_sessions','set_logs','food_logs','water_logs','body_measurements','saved_meals','progress_photos'] LOOP
    rows:=_data->tab;
    IF jsonb_typeof(rows) IS DISTINCT FROM 'array' OR jsonb_array_length(rows)>100000 THEN RAISE EXCEPTION 'Invalid backup table: %',tab; END IF;
    IF EXISTS(SELECT 1 FROM jsonb_array_elements(rows) r WHERE jsonb_typeof(r) IS DISTINCT FROM 'object' OR (r->>'member_id') IS DISTINCT FROM uid::text OR r->>'id' IS NULL) THEN RAISE EXCEPTION 'Backup contains invalid or foreign records'; END IF;
    SELECT count(DISTINCT r->>'id') INTO n FROM jsonb_array_elements(rows) r;
    IF n<>jsonb_array_length(rows) THEN RAISE EXCEPTION 'Duplicate IDs in backup'; END IF;
  END LOOP;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(_data->'progress_photos') p WHERE split_part(p->>'path','/',1) IS DISTINCT FROM uid::text OR p->>'path' LIKE '%..%') THEN RAISE EXCEPTION 'Invalid photo ownership'; END IF;
  -- Serialize restore operations for this member, including duplicate retries.
  PERFORM 1 FROM public.profiles WHERE id=uid FOR UPDATE;
  FOR row IN SELECT value FROM jsonb_array_elements(_data->'workout_sessions') LOOP
    SELECT * INTO session FROM jsonb_populate_record(NULL::public.workout_sessions,row);
    SELECT * INTO existing FROM public.workout_sessions WHERE id=session.id AND member_id=uid FOR UPDATE;
    IF NOT FOUND THEN
      finishes:=finishes || jsonb_build_object(session.id::text,session.finished_at);
      session.finished_at:=NULL;
      INSERT INTO public.workout_sessions SELECT session.*;
      new_sessions:=new_sessions+1;
    END IF;
  END LOOP;
  -- Recover deleted sets in an existing completed workout without losing its
  -- finish time. Re-finishing invokes the ordinary, idempotent reward triggers.
  FOR existing IN SELECT s.* FROM public.workout_sessions s WHERE s.member_id=uid AND s.finished_at IS NOT NULL AND EXISTS(
    SELECT 1 FROM jsonb_array_elements(_data->'set_logs') l WHERE (l->>'session_id')::uuid=s.id AND NOT EXISTS(SELECT 1 FROM public.set_logs x WHERE x.id=(l->>'id')::uuid)) ORDER BY s.id FOR UPDATE LOOP
    finishes:=finishes || jsonb_build_object(existing.id::text,existing.finished_at);
    UPDATE public.workout_sessions SET finished_at=NULL WHERE id=existing.id AND member_id=uid;
  END LOOP;
  FOREACH tab IN ARRAY ARRAY['set_logs','food_logs','water_logs','body_measurements','saved_meals','progress_photos'] LOOP
    rows:=_data->tab;
    EXECUTE format('INSERT INTO public.%I SELECT r.* FROM jsonb_populate_recordset(NULL::public.%I,$1) r WHERE NOT EXISTS(SELECT 1 FROM public.%I t WHERE t.id=r.id) ON CONFLICT(id) DO NOTHING',tab,tab,tab) USING rows;
    GET DIAGNOSTICS n=ROW_COUNT;
    counts:=counts || jsonb_build_object(tab,n);
    wanted:=jsonb_array_length(rows);
    EXECUTE format('SELECT count(*) FROM public.%I t WHERE t.member_id=$1 AND t.id IN(SELECT (r->>''id'')::uuid FROM jsonb_array_elements($2) r)',tab) INTO found_count USING uid,rows;
    IF found_count<>wanted THEN RAISE EXCEPTION 'Conflicting or inaccessible backup records'; END IF;
  END LOOP;
  FOR row IN SELECT jsonb_build_object('id',key,'finished_at',value) FROM jsonb_each(finishes) LOOP
    IF row->>'finished_at' IS NOT NULL THEN UPDATE public.workout_sessions SET finished_at=(row->>'finished_at')::timestamptz WHERE id=(row->>'id')::uuid AND member_id=uid; END IF;
  END LOOP;
  IF _preferences THEN
    IF (_data->'profile'->>'id') IS DISTINCT FROM uid::text OR _data->'profile'->>'units' NOT IN('metric','imperial') OR _data->'profile'->>'locale' NOT IN('ar','en') THEN RAISE EXCEPTION 'Invalid profile preferences'; END IF;
    IF _data->'profile'->>'avatar_url' IS NOT NULL AND (split_part(_data->'profile'->>'avatar_url','/',1)<>uid::text OR _data->'profile'->>'avatar_url' LIKE '%..%') THEN RAISE EXCEPTION 'Invalid avatar ownership'; END IF;
    UPDATE public.profiles SET display_name=_data->'profile'->>'display_name',units=_data->'profile'->>'units',locale=_data->'profile'->>'locale',avatar_url=_data->'profile'->>'avatar_url' WHERE id=uid;
  END IF;
  RETURN jsonb_build_object('inserted',counts || jsonb_build_object('workout_sessions',new_sessions));
END $$;
REVOKE EXECUTE ON FUNCTION public.export_personal_data(),public.restore_personal_data(jsonb,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.export_personal_data(),public.restore_personal_data(jsonb,boolean) TO authenticated;
