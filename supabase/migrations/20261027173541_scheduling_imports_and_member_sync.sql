SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='120s';
CREATE TABLE public.program_schedules(assignment_id uuid PRIMARY KEY REFERENCES public.program_assignments(id) ON DELETE CASCADE,member_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,mode text NOT NULL CHECK(mode IN ('calendar','rotation')),start_date date NOT NULL);
CREATE INDEX program_schedules_member_idx ON public.program_schedules(member_id);
CREATE TABLE public.session_occurrences(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),assignment_id uuid NOT NULL REFERENCES public.program_schedules(assignment_id) ON DELETE CASCADE,member_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,program_version_id uuid NOT NULL REFERENCES public.program_versions(id),week integer NOT NULL,day integer NOT NULL,ordinal integer NOT NULL,due_date date,status text NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled','in_progress','completed','cancelled')),UNIQUE(assignment_id,week,day));
CREATE INDEX session_occurrences_member_order_idx ON public.session_occurrences(member_id,status,ordinal);
CREATE INDEX session_occurrences_version_idx ON public.session_occurrences(program_version_id);
ALTER TABLE public.workout_sessions ADD COLUMN occurrence_id uuid UNIQUE REFERENCES public.session_occurrences(id),ADD COLUMN time_precision text NOT NULL DEFAULT 'timestamp' CHECK(time_precision IN ('timestamp','date')),ADD COLUMN import_edited boolean NOT NULL DEFAULT false;
ALTER TABLE public.program_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_occurrences ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE ON public.program_schedules,public.session_occurrences TO authenticated;
CREATE POLICY schedules_read ON public.program_schedules FOR SELECT TO authenticated USING(member_id=(SELECT auth.uid()) OR private.can_coach_member(member_id));
CREATE POLICY schedules_insert ON public.program_schedules FOR INSERT TO authenticated WITH CHECK(private.can_coach_member(member_id) AND (SELECT private.training_enabled('scheduling')) AND EXISTS(SELECT 1 FROM public.program_assignments a WHERE a.id=assignment_id AND a.member_id=program_schedules.member_id AND a.active));
CREATE POLICY schedules_update ON public.program_schedules FOR UPDATE TO authenticated USING(private.can_coach_member(member_id)) WITH CHECK(private.can_coach_member(member_id));
CREATE POLICY occurrences_read ON public.session_occurrences FOR SELECT TO authenticated USING(member_id=(SELECT auth.uid()) OR private.can_coach_member(member_id));
CREATE POLICY occurrences_insert ON public.session_occurrences FOR INSERT TO authenticated WITH CHECK(private.can_coach_member(member_id) AND (SELECT private.training_enabled('scheduling')) AND EXISTS(SELECT 1 FROM public.program_schedules s JOIN public.program_assignments a ON a.id=s.assignment_id WHERE s.assignment_id=session_occurrences.assignment_id AND s.member_id=session_occurrences.member_id AND a.program_version_id=session_occurrences.program_version_id AND a.active));
CREATE POLICY occurrences_update ON public.session_occurrences FOR UPDATE TO authenticated USING(member_id=(SELECT auth.uid()) OR private.can_coach_member(member_id)) WITH CHECK(member_id=(SELECT auth.uid()) AND (SELECT private.is_active((SELECT auth.uid()))) OR private.can_coach_member(member_id));
CREATE FUNCTION private.guard_occurrence() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF TG_OP='UPDATE' AND (NEW.id,NEW.assignment_id,NEW.member_id,NEW.program_version_id,NEW.week,NEW.day,NEW.ordinal,NEW.status) IS DISTINCT FROM (OLD.id,OLD.assignment_id,OLD.member_id,OLD.program_version_id,OLD.week,OLD.day,OLD.ordinal,OLD.status) AND pg_trigger_depth()<2 THEN RAISE EXCEPTION 'Occurrence identity and completion are server controlled'; END IF;
 IF TG_OP='UPDATE' AND NEW.due_date IS DISTINCT FROM OLD.due_date AND (OLD.status<>'scheduled' OR NOT private.training_enabled('scheduling')) THEN RAISE EXCEPTION 'Only unstarted sessions can be moved'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_occurrence BEFORE UPDATE ON public.session_occurrences FOR EACH ROW EXECUTE FUNCTION private.guard_occurrence();
CREATE FUNCTION public.configure_program_schedule(_assignment uuid,_mode text,_start date) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE a public.program_assignments; v public.program_versions;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(_assignment::text,0));
 SELECT * INTO a FROM public.program_assignments WHERE id=_assignment AND active;
 IF a.id IS NULL OR NOT private.can_coach_member(a.member_id) OR NOT private.training_enabled('scheduling') OR _mode NOT IN ('calendar','rotation') OR _start IS NULL THEN RAISE EXCEPTION 'Current coach or active admin required'; END IF;
 SELECT * INTO v FROM public.program_versions WHERE id=a.program_version_id;
 INSERT INTO public.program_schedules VALUES(a.id,a.member_id,_mode,_start) ON CONFLICT(assignment_id) DO UPDATE SET mode=EXCLUDED.mode,start_date=EXCLUDED.start_date;
 INSERT INTO public.session_occurrences(assignment_id,member_id,program_version_id,week,day,ordinal,due_date)
 SELECT a.id,a.member_id,v.id,w,d,(w-1)*7+d,CASE WHEN _mode='calendar' THEN _start+(w-1)*7+d-1 ELSE NULL END FROM(SELECT DISTINCT (i->>'week')::int w,(i->>'day')::int d FROM jsonb_array_elements(v.items)i)q ON CONFLICT(assignment_id,week,day) DO NOTHING;
 UPDATE public.session_occurrences SET due_date=CASE WHEN _mode='calendar' THEN _start+(week-1)*7+day-1 ELSE NULL END WHERE assignment_id=a.id AND status='scheduled';
END $$;
CREATE FUNCTION public.move_session_occurrence(_id uuid,_date date) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF NOT private.training_enabled('scheduling') OR _date IS NULL THEN RAISE EXCEPTION 'Scheduling access required'; END IF;
 UPDATE public.session_occurrences o SET due_date=_date WHERE o.id=_id AND o.member_id=auth.uid() AND o.status='scheduled' AND EXISTS(SELECT 1 FROM public.program_assignments a WHERE a.id=o.assignment_id AND a.active);
 IF NOT FOUND THEN RAISE EXCEPTION 'Only your active unstarted session can be moved'; END IF;
END $$;
CREATE FUNCTION private.track_occurrence() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
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
 ELSIF OLD.finished_at IS NOT NULL AND NEW.finished_at IS NULL THEN RAISE EXCEPTION 'A completed occurrence cannot be reopened';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.track_occurrence() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER track_occurrence BEFORE INSERT OR UPDATE ON public.workout_sessions FOR EACH ROW EXECUTE FUNCTION private.track_occurrence();
CREATE FUNCTION public.start_session_occurrence(_occurrence uuid,_session uuid,_started timestamptz) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE o public.session_occurrences; s public.workout_sessions;
BEGIN
 SELECT * INTO o FROM public.session_occurrences WHERE id=_occurrence AND member_id=auth.uid() FOR UPDATE;
 IF o.id IS NULL OR NOT private.training_enabled('scheduling') THEN RAISE EXCEPTION 'Session is unavailable'; END IF;
 SELECT * INTO s FROM public.workout_sessions WHERE occurrence_id=o.id;
 IF s.id IS NOT NULL THEN RETURN to_jsonb(s); END IF;
 IF _started>now() OR _started<now()-interval '30 days' THEN RAISE EXCEPTION 'Invalid workout start'; END IF;
 INSERT INTO public.workout_sessions(id,member_id,title,started_at,occurrence_id) VALUES(_session,auth.uid(),'W'||o.week||' D'||o.day,_started,o.id) RETURNING * INTO s;
 RETURN to_jsonb(s);
END $$;
CREATE FUNCTION private.cancel_old_occurrences() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN IF OLD.active AND NOT NEW.active THEN UPDATE public.session_occurrences SET status='cancelled' WHERE assignment_id=NEW.id AND status='scheduled'; END IF;RETURN NEW;END $$;
REVOKE ALL ON FUNCTION private.cancel_old_occurrences() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER cancel_old_occurrences AFTER UPDATE ON public.program_assignments FOR EACH ROW EXECUTE FUNCTION private.cancel_old_occurrences();

CREATE TABLE public.import_batches(id uuid PRIMARY KEY,member_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,provider text NOT NULL CHECK(provider IN ('strong','hevy','fitnotes')),parser_version integer NOT NULL DEFAULT 1,created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX import_batches_member_idx ON public.import_batches(member_id,created_at DESC);
CREATE TABLE public.import_receipts(member_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,provider text NOT NULL,fingerprint text NOT NULL,content_fingerprint text NOT NULL,batch_id uuid NOT NULL REFERENCES public.import_batches(id),session_id uuid REFERENCES public.workout_sessions(id) ON DELETE SET NULL,PRIMARY KEY(member_id,provider,fingerprint),UNIQUE(member_id,content_fingerprint));
CREATE INDEX import_receipts_batch_idx ON public.import_receipts(batch_id);
CREATE INDEX import_receipts_session_idx ON public.import_receipts(session_id);
ALTER TABLE public.workout_sessions ADD CONSTRAINT workout_sessions_import_batch_fk FOREIGN KEY(import_batch_id) REFERENCES public.import_batches(id);
CREATE INDEX workout_sessions_import_batch_idx ON public.workout_sessions(import_batch_id);
ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_receipts ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT ON public.import_batches,public.import_receipts TO authenticated;
CREATE POLICY imports_read ON public.import_batches FOR SELECT TO authenticated USING(member_id=(SELECT auth.uid()));
CREATE POLICY imports_insert ON public.import_batches FOR INSERT TO authenticated WITH CHECK(member_id=(SELECT auth.uid()) AND (SELECT private.training_enabled('imports')));
CREATE POLICY receipts_read ON public.import_receipts FOR SELECT TO authenticated USING(member_id=(SELECT auth.uid()));
CREATE POLICY receipts_insert ON public.import_receipts FOR INSERT TO authenticated WITH CHECK(member_id=(SELECT auth.uid()) AND (SELECT private.training_enabled('imports')) AND EXISTS(SELECT 1 FROM public.workout_sessions s WHERE s.id=session_id AND s.member_id=(SELECT auth.uid()) AND s.origin='import' AND s.import_batch_id=batch_id));
CREATE FUNCTION public.commit_training_import(_batch uuid,_provider text,_workouts jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE w jsonb; r jsonb; sid uuid; source_hash text; content_hash text; accepted integer=0; skipped integer=0; total integer=0; activity date; start_time timestamptz; end_time timestamptz;
BEGIN
 IF NOT private.training_enabled('imports') OR _provider NOT IN ('strong','hevy','fitnotes') OR jsonb_typeof(_workouts)<>'array' OR jsonb_array_length(_workouts)>100 THEN RAISE EXCEPTION 'Invalid import batch'; END IF;
 INSERT INTO public.import_batches(id,member_id,provider) VALUES(_batch,auth.uid(),_provider) ON CONFLICT(id) DO NOTHING;
 IF NOT EXISTS(SELECT 1 FROM public.import_batches WHERE id=_batch AND member_id=auth.uid() AND provider=_provider) THEN RAISE EXCEPTION 'Import batch identity mismatch'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':import',0));
 FOR w IN SELECT value FROM jsonb_array_elements(_workouts) LOOP
  IF jsonb_typeof(w->'sets')<>'array' OR jsonb_array_length(w->'sets')=0 THEN RAISE EXCEPTION 'An imported workout needs valid sets'; END IF;
  total=total+jsonb_array_length(w->'sets');IF total>5000 THEN RAISE EXCEPTION 'Import chunk exceeds 5000 sets'; END IF;
  activity=(w->>'activity_date')::date;IF activity>(now() AT TIME ZONE 'Africa/Cairo')::date THEN RAISE EXCEPTION 'Future workout dates are not accepted'; END IF;
  source_hash=md5(jsonb_build_object('date',activity,'title',w->>'title','source',w->'source_rows')::text);
  SELECT md5(jsonb_build_object('date',activity,'sets',jsonb_agg(value - ARRAY['id','pair_id','root_set_id','slot_key'] ORDER BY (value - ARRAY['id','pair_id','root_set_id','slot_key'])::text))::text) INTO content_hash FROM jsonb_array_elements(w->'sets');
  IF EXISTS(SELECT 1 FROM public.import_receipts WHERE member_id=auth.uid() AND (provider=_provider AND fingerprint=source_hash OR content_fingerprint=content_hash)) THEN skipped=skipped+1;CONTINUE; END IF;
  start_time=coalesce((w->>'started_at')::timestamptz,activity::timestamp AT TIME ZONE 'Africa/Cairo');end_time=coalesce((w->>'finished_at')::timestamptz,start_time);
  IF end_time<start_time OR end_time>now() THEN RAISE EXCEPTION 'Invalid workout times'; END IF;
  sid=gen_random_uuid();INSERT INTO public.workout_sessions(id,member_id,title,started_at,origin,activity_date,import_batch_id,time_precision) VALUES(sid,auth.uid(),left(w->>'title',200),start_time,'import',activity,_batch,CASE WHEN w->>'started_at' IS NULL THEN 'date' ELSE 'timestamp' END);
  FOR r IN SELECT value FROM jsonb_array_elements(w->'sets') LOOP
   INSERT INTO public.set_logs(id,session_id,member_id,exercise_id,set_number,reps,weight_kg,rpe,logging_mode,set_role,duration_seconds,side,pair_id,root_set_id,segment_index,load_convention,slot_key,created_at)
   VALUES(coalesce((r->>'id')::uuid,gen_random_uuid()),sid,auth.uid(),(r->>'exercise_id')::uuid,(r->>'set_number')::int,(r->>'reps')::int,(r->>'weight_kg')::numeric,(r->>'rpe')::numeric,coalesce(r->>'logging_mode','weighted_reps'),coalesce(r->>'set_role','working'),(r->>'duration_seconds')::int,coalesce(r->>'side','bilateral'),(r->>'pair_id')::uuid,(r->>'root_set_id')::uuid,coalesce((r->>'segment_index')::int,0),coalesce(r->>'load_convention','external_total'),coalesce(r->>'slot_key',''),start_time);
  END LOOP;
  UPDATE public.workout_sessions SET finished_at=end_time WHERE id=sid;
  INSERT INTO public.import_receipts VALUES(auth.uid(),_provider,source_hash,content_hash,_batch,sid);accepted=accepted+1;
 END LOOP;
 RETURN jsonb_build_object('accepted',accepted,'skipped',skipped,'batch_id',_batch);
END $$;
CREATE FUNCTION private.mark_import_edited() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN UPDATE public.workout_sessions SET import_edited=true WHERE id=coalesce(NEW.session_id,OLD.session_id) AND origin='import' AND finished_at IS NOT NULL;RETURN coalesce(NEW,OLD);END $$;
REVOKE ALL ON FUNCTION private.mark_import_edited() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER mark_import_edited AFTER UPDATE OR DELETE ON public.set_logs FOR EACH ROW EXECUTE FUNCTION private.mark_import_edited();
CREATE FUNCTION private.undo_import(_batch uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE removed integer; edited integer;
BEGIN
 IF NOT private.training_enabled('imports') OR NOT EXISTS(SELECT 1 FROM public.import_batches WHERE id=_batch AND member_id=auth.uid()) THEN RAISE EXCEPTION 'Own import batch required'; END IF;
 SELECT count(*) INTO edited FROM public.workout_sessions WHERE import_batch_id=_batch AND member_id=auth.uid() AND import_edited;
 DELETE FROM public.workout_sessions WHERE import_batch_id=_batch AND member_id=auth.uid() AND NOT import_edited;GET DIAGNOSTICS removed=ROW_COUNT;
 RETURN jsonb_build_object('removed',removed,'edited',edited);
END $$;
REVOKE ALL ON FUNCTION private.undo_import(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.undo_import(uuid) TO authenticated;
CREATE FUNCTION public.undo_training_import(_batch uuid) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.undo_import(_batch) $$;

CREATE TABLE private.member_mutation_receipts(member_id uuid NOT NULL,mutation_id uuid NOT NULL,fingerprint text NOT NULL,result jsonb NOT NULL,PRIMARY KEY(member_id,mutation_id));
CREATE POLICY water_owner_update ON public.water_logs FOR UPDATE TO authenticated USING(member_id=(SELECT auth.uid())) WITH CHECK(member_id=(SELECT auth.uid()) AND (SELECT private.is_active((SELECT auth.uid()))));
CREATE TABLE private.member_sync_tombstones(member_id uuid NOT NULL,entity text NOT NULL,record_id uuid NOT NULL,revision bigint NOT NULL,PRIMARY KEY(member_id,entity,record_id));
ALTER TABLE private.member_mutation_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.member_sync_tombstones ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.member_mutation_receipts,private.member_sync_tombstones FROM PUBLIC,anon,authenticated;
CREATE FUNCTION private.mutation_receipt(_id uuid,_hash text,_result jsonb DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE receipt private.member_mutation_receipts;
BEGIN
 IF auth.uid() IS NULL OR NOT private.is_active(auth.uid()) THEN RAISE EXCEPTION 'Active member required'; END IF;
 SELECT * INTO receipt FROM private.member_mutation_receipts WHERE member_id=auth.uid() AND mutation_id=_id;
 IF receipt.mutation_id IS NOT NULL THEN IF receipt.fingerprint<>_hash THEN RAISE EXCEPTION 'Mutation identity cannot be reused with different content'; END IF;RETURN receipt.result||jsonb_build_object('status','already_applied');END IF;
 IF _result IS NOT NULL THEN INSERT INTO private.member_mutation_receipts VALUES(auth.uid(),_id,_hash,_result);END IF;
 RETURN _result;
END $$;
CREATE FUNCTION private.sync_tombstone(_entity text,_id uuid,_revision bigint DEFAULT NULL) RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result bigint;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
 IF _revision IS NOT NULL THEN INSERT INTO private.member_sync_tombstones VALUES(auth.uid(),_entity,_id,_revision) ON CONFLICT(member_id,entity,record_id) DO UPDATE SET revision=EXCLUDED.revision;END IF;
 SELECT revision INTO result FROM private.member_sync_tombstones WHERE member_id=auth.uid() AND entity=_entity AND record_id=_id;RETURN coalesce(result,0);
END $$;
REVOKE ALL ON FUNCTION private.mutation_receipt(uuid,text,jsonb),private.sync_tombstone(text,uuid,bigint) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.mutation_receipt(uuid,text,jsonb),private.sync_tombstone(text,uuid,bigint) TO authenticated;
DO $$ DECLARE tab text; BEGIN FOREACH tab IN ARRAY ARRAY['food_logs','water_logs','body_measurements','wellness_checkins','saved_meals'] LOOP EXECUTE format('ALTER TABLE public.%I ADD COLUMN revision bigint NOT NULL DEFAULT 1',tab);END LOOP;END $$;
CREATE FUNCTION private.record_revision() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$ BEGIN IF (NEW.id,NEW.member_id) IS DISTINCT FROM (OLD.id,OLD.member_id) THEN RAISE EXCEPTION 'Record identity is immutable';END IF;NEW.revision=OLD.revision+1;RETURN NEW;END $$;
DO $$ DECLARE tab text; BEGIN FOREACH tab IN ARRAY ARRAY['food_logs','water_logs','body_measurements','wellness_checkins','saved_meals'] LOOP EXECUTE format('CREATE TRIGGER record_revision BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION private.record_revision()',tab);END LOOP;END $$;
CREATE FUNCTION public.apply_member_mutations(_mutations jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE m jsonb; p jsonb; tab text; rid uuid; mid uuid; oldrow jsonb; rev bigint; result jsonb; receipt jsonb; results jsonb='[]'; has_conflict boolean=false;
BEGIN
 IF NOT private.training_enabled('offline') OR jsonb_typeof(_mutations)<>'array' OR jsonb_array_length(_mutations)>100 THEN RAISE EXCEPTION 'Offline member access or valid mutation batch required';END IF;
 IF (SELECT count(*) FROM jsonb_array_elements(_mutations))<>(SELECT count(DISTINCT (value->>'entity',value->>'record_id')) FROM jsonb_array_elements(_mutations)) THEN RAISE EXCEPTION 'One change per record per batch required';END IF;
 FOR m IN SELECT value FROM jsonb_array_elements(_mutations) ORDER BY value->>'entity',value->>'record_id' LOOP
  tab=m->>'entity';rid=(m->>'record_id')::uuid;mid=(m->>'id')::uuid;
  IF tab NOT IN ('food_logs','water_logs','body_measurements','wellness_checkins','saved_meals') OR m->>'op' NOT IN ('put','delete') THEN RAISE EXCEPTION 'Unsupported member mutation';END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text||tab||rid::text,0));
  receipt=private.mutation_receipt(mid,md5(m::text));IF receipt IS NOT NULL THEN CONTINUE;END IF;
  EXECUTE format('SELECT to_jsonb(t) FROM public.%I t WHERE id=$1 AND member_id=$2 FOR UPDATE',tab) INTO oldrow USING rid,auth.uid();
  rev=coalesce((oldrow->>'revision')::bigint,private.sync_tombstone(tab,rid));
  IF rev<>coalesce((m->>'base_revision')::bigint,0) THEN results=results||jsonb_build_array(jsonb_build_object('id',mid,'status','conflict','record',oldrow,'revision',rev));has_conflict=true;END IF;
 END LOOP;
 IF has_conflict THEN RETURN results;END IF;
 FOR m IN SELECT value FROM jsonb_array_elements(_mutations) LOOP
  tab=m->>'entity';rid=(m->>'record_id')::uuid;mid=(m->>'id')::uuid;p=m->'payload';
  receipt=private.mutation_receipt(mid,md5(m::text));IF receipt IS NOT NULL THEN results=results||jsonb_build_array(receipt);CONTINUE;END IF;
  rev=coalesce((m->>'base_revision')::bigint,0)+1;
  IF m->>'op'='delete' THEN EXECUTE format('DELETE FROM public.%I WHERE id=$1 AND member_id=$2',tab) USING rid,auth.uid();PERFORM private.sync_tombstone(tab,rid,rev);oldrow=NULL;
  ELSE
   IF coalesce(p->>'log_date',p->>'measured_on') IS NOT NULL AND coalesce(p->>'log_date',p->>'measured_on')::date>(now() AT TIME ZONE 'Africa/Cairo')::date THEN RAISE EXCEPTION 'Future daily entries are not accepted';END IF;
   IF tab='food_logs' THEN INSERT INTO public.food_logs(id,member_id,log_date,meal,name,calories,protein_g,carbs_g,fat_g,revision) VALUES(rid,auth.uid(),(p->>'log_date')::date,p->>'meal',p->>'name',(p->>'calories')::int,coalesce((p->>'protein_g')::numeric,0),coalesce((p->>'carbs_g')::numeric,0),coalesce((p->>'fat_g')::numeric,0),rev) ON CONFLICT(id) DO UPDATE SET log_date=EXCLUDED.log_date,meal=EXCLUDED.meal,name=EXCLUDED.name,calories=EXCLUDED.calories,protein_g=EXCLUDED.protein_g,carbs_g=EXCLUDED.carbs_g,fat_g=EXCLUDED.fat_g;
   ELSIF tab='water_logs' THEN INSERT INTO public.water_logs(id,member_id,log_date,ml,revision) VALUES(rid,auth.uid(),(p->>'log_date')::date,(p->>'ml')::int,rev) ON CONFLICT(id) DO UPDATE SET log_date=EXCLUDED.log_date,ml=EXCLUDED.ml;
   ELSIF tab='body_measurements' THEN INSERT INTO public.body_measurements(id,member_id,measured_on,weight_kg,waist_cm,body_fat_pct,revision) VALUES(rid,auth.uid(),(p->>'measured_on')::date,(p->>'weight_kg')::numeric,(p->>'waist_cm')::numeric,(p->>'body_fat_pct')::numeric,rev) ON CONFLICT(id) DO UPDATE SET measured_on=EXCLUDED.measured_on,weight_kg=EXCLUDED.weight_kg,waist_cm=EXCLUDED.waist_cm,body_fat_pct=EXCLUDED.body_fat_pct;
   ELSIF tab='wellness_checkins' THEN INSERT INTO public.wellness_checkins(id,member_id,log_date,sleep_hours,energy,soreness,notes,revision) VALUES(rid,auth.uid(),(p->>'log_date')::date,(p->>'sleep_hours')::numeric,(p->>'energy')::int,(p->>'soreness')::int,p->>'notes',rev) ON CONFLICT(id) DO UPDATE SET log_date=EXCLUDED.log_date,sleep_hours=EXCLUDED.sleep_hours,energy=EXCLUDED.energy,soreness=EXCLUDED.soreness,notes=EXCLUDED.notes;
   ELSE INSERT INTO public.saved_meals(id,member_id,name,items,revision) VALUES(rid,auth.uid(),p->>'name',p->'items',rev) ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,items=EXCLUDED.items;END IF;
   EXECUTE format('SELECT to_jsonb(t) FROM public.%I t WHERE id=$1 AND member_id=$2',tab) INTO oldrow USING rid,auth.uid();
  END IF;
  result=jsonb_build_object('id',mid,'status','applied','record',oldrow,'revision',rev);PERFORM private.mutation_receipt(mid,md5(m::text),result);results=results||jsonb_build_array(result);
 END LOOP;RETURN results;
END $$;

GRANT ALL ON public.program_schedules,public.session_occurrences,public.import_batches,public.import_receipts TO service_role;
REVOKE ALL ON FUNCTION public.configure_program_schedule(uuid,text,date),public.move_session_occurrence(uuid,date),public.start_session_occurrence(uuid,uuid,timestamptz),public.commit_training_import(uuid,text,jsonb),public.undo_training_import(uuid),public.apply_member_mutations(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.configure_program_schedule(uuid,text,date),public.move_session_occurrence(uuid,date),public.start_session_occurrence(uuid,uuid,timestamptz),public.commit_training_import(uuid,text,jsonb),public.undo_training_import(uuid),public.apply_member_mutations(jsonb) TO authenticated;
