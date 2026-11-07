SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='120s';

ALTER TABLE public.training_rollout DROP CONSTRAINT training_rollout_feature_check;
ALTER TABLE public.training_rollout ADD CONSTRAINT training_rollout_feature_check CHECK(feature IN ('guidance','logging','progression','scheduling','imports','offline','food_scanning','cardio','social'));
INSERT INTO public.training_rollout(feature) VALUES ('food_scanning'),('cardio'),('social');

CREATE TABLE private.feature_request_limits(member_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,bucket text,period timestamptz NOT NULL,calls integer NOT NULL,PRIMARY KEY(member_id,bucket));
ALTER TABLE private.feature_request_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.feature_request_limits FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION private.feature_allowance(_bucket text,_max integer) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid=auth.uid(); stamp timestamptz=date_trunc('hour',now()); n integer;
BEGIN
 IF actor IS NULL OR NOT private.is_active(actor) THEN RAISE EXCEPTION 'Active membership required'; END IF;
 INSERT INTO private.feature_request_limits VALUES(actor,_bucket,stamp,1) ON CONFLICT(member_id,bucket) DO UPDATE SET period=stamp,calls=CASE WHEN feature_request_limits.period=stamp THEN feature_request_limits.calls+1 ELSE 1 END RETURNING calls INTO n;
 IF n>_max THEN RAISE EXCEPTION 'Hourly request limit reached. Try again later.'; END IF;
END $$;
REVOKE ALL ON FUNCTION private.feature_allowance(text,integer) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.food_scan_allowance() RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN IF NOT private.training_enabled('food_scanning') THEN RAISE EXCEPTION 'Food scanning is not enabled'; END IF; PERFORM private.food_scan_budget(); END $$;
CREATE FUNCTION private.food_scan_budget() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN IF NOT private.training_enabled('food_scanning') THEN RAISE EXCEPTION 'Food scanning is not enabled'; END IF; PERFORM private.feature_allowance('barcode',60); END $$;
REVOKE ALL ON FUNCTION private.food_scan_budget() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.food_scan_budget() TO authenticated;
REVOKE ALL ON FUNCTION public.food_scan_allowance() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.food_scan_allowance() TO authenticated;

CREATE TABLE public.cardio_logs(
 id uuid PRIMARY KEY,member_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 activity text NOT NULL CHECK(activity IN ('walk','run','cycle','row','elliptical','stairs','other','hiit')),
 log_date date NOT NULL,duration_seconds integer NOT NULL CHECK(duration_seconds BETWEEN 1 AND 86400),
 distance_m numeric CHECK(distance_m>=0 AND distance_m<=1000000),incline_pct numeric CHECK(incline_pct BETWEEN -20 AND 40),
 resistance text CHECK(length(resistance)<=80),heart_rate integer CHECK(heart_rate BETWEEN 30 AND 240),
 notes text NOT NULL DEFAULT '' CHECK(length(notes)<=2000),intervals jsonb,
 revision bigint NOT NULL DEFAULT 1,deleted_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX cardio_logs_member_date_idx ON public.cardio_logs(member_id,log_date DESC,id);
ALTER TABLE public.cardio_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cardio_logs FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.cardio_logs TO authenticated;
CREATE POLICY cardio_history ON public.cardio_logs FOR SELECT TO authenticated USING((SELECT private.is_active((SELECT auth.uid()))) AND (member_id=(SELECT auth.uid()) OR private.can_coach_member(member_id)));
CREATE TABLE private.cardio_receipts(member_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,mutation_id uuid,payload jsonb NOT NULL,result jsonb NOT NULL,PRIMARY KEY(member_id,mutation_id));
ALTER TABLE private.cardio_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.cardio_receipts FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION private.write_cardio(_id uuid,_expected bigint,_data jsonb,_mutation uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid=auth.uid(); old public.cardio_logs; saved public.cardio_logs; receipt private.cardio_receipts; fingerprint jsonb=jsonb_build_object('id',_id,'revision',_expected,'data',_data); result jsonb;
BEGIN
 IF actor IS NULL OR NOT private.is_active(actor) OR NOT private.training_enabled('cardio') OR _id IS NULL OR _mutation IS NULL OR _expected IS NULL OR _expected<0 OR octet_length(_data::text)>12000 THEN RAISE EXCEPTION 'Valid active cardio access required'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor::text||_id::text,0));
 SELECT * INTO receipt FROM private.cardio_receipts WHERE member_id=actor AND mutation_id=_mutation;
 IF receipt.mutation_id IS NOT NULL THEN IF receipt.payload<>fingerprint THEN RAISE EXCEPTION 'Mutation identity cannot be reused';END IF;RETURN receipt.result;END IF;
 SELECT * INTO old FROM public.cardio_logs WHERE id=_id FOR UPDATE;
 IF old.id IS NOT NULL AND old.member_id<>actor THEN RAISE EXCEPTION 'Cardio ownership mismatch';END IF;
 IF coalesce(old.revision,0)<>_expected THEN RETURN jsonb_build_object('status','conflict','record',to_jsonb(old),'revision',coalesce(old.revision,0)); END IF;
 IF _data IS NULL THEN
  IF old.id IS NULL THEN RAISE EXCEPTION 'Cannot delete missing cardio entry';END IF;
  UPDATE public.cardio_logs SET deleted_at=now(),updated_at=now(),revision=revision+1 WHERE id=_id RETURNING * INTO saved;
 ELSE
  IF jsonb_typeof(_data)<>'object' OR NOT (_data ?& ARRAY['activity','log_date','duration_seconds']) OR (_data->>'log_date')::date>(now() AT TIME ZONE 'Africa/Cairo')::date OR (_data->>'log_date')::date<'2000-01-01'::date THEN RAISE EXCEPTION 'Valid cardio activity date required';END IF;
  IF _data->>'activity'='hiit' THEN
   IF jsonb_typeof(_data->'intervals') IS DISTINCT FROM 'object' OR coalesce((_data#>>'{intervals,work}')::int,0) NOT BETWEEN 1 AND 3600 OR coalesce((_data#>>'{intervals,rest}')::int,-1) NOT BETWEEN 0 AND 3600 OR coalesce((_data#>>'{intervals,rounds}')::int,0) NOT BETWEEN 1 AND 100 OR coalesce((_data#>>'{intervals,prepare}')::int,-1) NOT BETWEEN 0 AND 600 THEN RAISE EXCEPTION 'Valid HIIT intervals required';END IF;
   IF (_data->>'duration_seconds')::int IS DISTINCT FROM ((_data#>>'{intervals,prepare}')::int + (_data#>>'{intervals,work}')::int * (_data#>>'{intervals,rounds}')::int + (_data#>>'{intervals,rest}')::int * ((_data#>>'{intervals,rounds}')::int-1)) THEN RAISE EXCEPTION 'HIIT duration must match its interval plan'; END IF;
  END IF;
  INSERT INTO public.cardio_logs(id,member_id,activity,log_date,duration_seconds,distance_m,incline_pct,resistance,heart_rate,notes,intervals,revision)
  VALUES(_id,actor,_data->>'activity',(_data->>'log_date')::date,(_data->>'duration_seconds')::int,(_data->>'distance_m')::numeric,(_data->>'incline_pct')::numeric,nullif(_data->>'resistance',''),(_data->>'heart_rate')::int,coalesce(_data->>'notes',''),_data->'intervals',_expected+1)
  ON CONFLICT(id) DO UPDATE SET activity=EXCLUDED.activity,log_date=EXCLUDED.log_date,duration_seconds=EXCLUDED.duration_seconds,distance_m=EXCLUDED.distance_m,incline_pct=EXCLUDED.incline_pct,resistance=EXCLUDED.resistance,heart_rate=EXCLUDED.heart_rate,notes=EXCLUDED.notes,intervals=EXCLUDED.intervals,revision=EXCLUDED.revision,updated_at=now(),deleted_at=NULL RETURNING * INTO saved;
 END IF;
 result=jsonb_build_object('status','applied','record',to_jsonb(saved),'revision',saved.revision);
 INSERT INTO private.cardio_receipts VALUES(actor,_mutation,fingerprint,result);RETURN result;
END $$;
REVOKE ALL ON FUNCTION private.write_cardio(uuid,bigint,jsonb,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.write_cardio(uuid,bigint,jsonb,uuid) TO authenticated;
CREATE FUNCTION public.save_cardio_log(_id uuid,_expected bigint,_data jsonb,_mutation uuid) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.write_cardio(_id,_expected,_data,_mutation) $$;
REVOKE ALL ON FUNCTION public.save_cardio_log(uuid,bigint,jsonb,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_cardio_log(uuid,bigint,jsonb,uuid) TO authenticated;
CREATE FUNCTION public.get_cardio_history(_from date,_to date) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 IF NOT private.training_enabled('cardio') OR NOT private.is_active(auth.uid()) OR _from IS NULL OR _to IS NULL OR _to<_from OR _to-_from>365 THEN RAISE EXCEPTION 'Valid cardio history range required';END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(l) ORDER BY l.log_date DESC,l.id),'[]') INTO result FROM public.cardio_logs l WHERE l.member_id=auth.uid() AND l.log_date BETWEEN _from AND _to;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.get_cardio_history(date,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_cardio_history(date,date) TO authenticated;

CREATE TABLE public.social_accounts(member_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,code text NOT NULL UNIQUE DEFAULT ('PF-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,16))),discoverable boolean NOT NULL DEFAULT false,sharing boolean NOT NULL DEFAULT false,CHECK(code ~ '^PF-[A-F0-9]{16}$'));
INSERT INTO public.social_accounts(member_id) SELECT id FROM public.profiles;
CREATE FUNCTION private.new_social_account() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN INSERT INTO public.social_accounts(member_id) VALUES(NEW.id) ON CONFLICT DO NOTHING; RETURN NEW; END $$;
REVOKE ALL ON FUNCTION private.new_social_account() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER create_social_account AFTER INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION private.new_social_account();
CREATE TABLE public.friendships(a uuid REFERENCES public.profiles(id) ON DELETE CASCADE,b uuid REFERENCES public.profiles(id) ON DELETE CASCADE,requested_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,status text NOT NULL CHECK(status IN ('pending','accepted','declined')),created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(a,b),CHECK(a<b AND requested_by IN (a,b)));
CREATE INDEX friendships_b_idx ON public.friendships(b,status);
CREATE INDEX friendships_requester_idx ON public.friendships(requested_by);
CREATE TABLE public.member_blocks(member_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,blocked_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,PRIMARY KEY(member_id,blocked_id),CHECK(member_id<>blocked_id));
CREATE INDEX member_blocks_target_idx ON public.member_blocks(blocked_id);
CREATE TABLE public.friend_challenges(id uuid PRIMARY KEY,owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,title text NOT NULL CHECK(length(btrim(title)) BETWEEN 1 AND 100),metric text NOT NULL CHECK(metric IN ('cardio_minutes','workout_days')),goal integer NOT NULL CHECK(goal BETWEEN 1 AND 10000),starts_on date NOT NULL,ends_on date NOT NULL,status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','completed','cancelled')),completed_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),CHECK(ends_on>=starts_on AND ends_on-starts_on<=90));
CREATE INDEX friend_challenges_owner_idx ON public.friend_challenges(owner_id,created_at DESC);
CREATE TABLE public.challenge_members(challenge_id uuid REFERENCES public.friend_challenges(id) ON DELETE CASCADE,member_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,status text NOT NULL CHECK(status IN ('invited','accepted')),PRIMARY KEY(challenge_id,member_id));
CREATE INDEX challenge_members_member_idx ON public.challenge_members(member_id,challenge_id);
CREATE TABLE private.cancelled_challenge_requests(member_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,request_id uuid,PRIMARY KEY(member_id,request_id));
ALTER TABLE private.cancelled_challenge_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.cancelled_challenge_requests FROM PUBLIC,anon,authenticated,service_role;
DO $$ DECLARE t text;BEGIN FOREACH t IN ARRAY ARRAY['social_accounts','friendships','member_blocks','friend_challenges','challenge_members'] LOOP EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);END LOOP;END $$;
-- All social reads and writes use the guarded invoker operation. No REST bypass grants.
CREATE FUNCTION private.social_blocked(_a uuid,_b uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT EXISTS(SELECT 1 FROM public.member_blocks WHERE (member_id=_a AND blocked_id=_b) OR (member_id=_b AND blocked_id=_a)) $$;
REVOKE ALL ON FUNCTION private.social_blocked(uuid,uuid) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION private.social_friends(_a uuid,_b uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT NOT private.social_blocked(_a,_b) AND EXISTS(SELECT 1 FROM public.friendships WHERE a=least(_a,_b) AND b=greatest(_a,_b) AND status='accepted') AND private.is_active(_a) AND private.is_active(_b) $$;
REVOKE ALL ON FUNCTION private.social_friends(uuid,uuid) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION private.challenge_total(_id uuid) RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(sum(CASE WHEN c.metric='workout_days' THEN (SELECT count(DISTINCT (w.finished_at AT TIME ZONE 'Africa/Cairo')::date) FROM public.workout_sessions w WHERE w.member_id=p.member_id AND w.finished_at IS NOT NULL AND w.origin='native' AND (w.finished_at AT TIME ZONE 'Africa/Cairo')::date BETWEEN c.starts_on AND least(c.ends_on,(now() AT TIME ZONE 'Africa/Cairo')::date) AND EXISTS(SELECT 1 FROM public.set_logs s WHERE s.session_id=w.id AND s.set_role='working' AND ((s.reps>0) OR s.duration_seconds>0))) ELSE (SELECT coalesce(sum(d.minutes),0) FROM (SELECT least(180,floor(sum(CASE WHEN l.activity='hiit' THEN (l.intervals->>'work')::int*(l.intervals->>'rounds')::int ELSE l.duration_seconds END)/60.0)) minutes FROM public.cardio_logs l WHERE l.member_id=p.member_id AND l.deleted_at IS NULL AND l.log_date BETWEEN c.starts_on AND least(c.ends_on,(now() AT TIME ZONE 'Africa/Cairo')::date) GROUP BY l.log_date) d) END),0)::integer
 FROM public.friend_challenges c JOIN public.challenge_members p ON p.challenge_id=c.id AND p.status='accepted' JOIN public.social_accounts a ON a.member_id=p.member_id AND a.sharing WHERE c.id=_id AND private.is_active(p.member_id)
$$;
REVOKE ALL ON FUNCTION private.challenge_total(uuid) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION private.social_action(_op text,_data jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid=auth.uid(); other uuid; cid uuid; relationship public.friendships; challenge public.friend_challenges; result jsonb; total integer; today date=(now() AT TIME ZONE 'Africa/Cairo')::date;
BEGIN
 IF actor IS NULL OR NOT private.is_active(actor) OR NOT private.training_enabled('social') OR _op IS NULL OR octet_length(coalesce(_data,'{}')::text)>5000 THEN RAISE EXCEPTION 'Active social access required';END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('social',0));
 IF _op='preferences' THEN
  IF NOT (_data ?| ARRAY['discoverable','sharing']) OR (_data ? 'discoverable' AND jsonb_typeof(_data->'discoverable') IS DISTINCT FROM 'boolean') OR (_data ? 'sharing' AND jsonb_typeof(_data->'sharing') IS DISTINCT FROM 'boolean') THEN RAISE EXCEPTION 'Explicit sharing preferences required';END IF;
  UPDATE public.social_accounts SET discoverable=CASE WHEN _data ? 'discoverable' THEN (_data->>'discoverable')::boolean ELSE discoverable END,sharing=CASE WHEN _data ? 'sharing' THEN (_data->>'sharing')::boolean ELSE sharing END WHERE member_id=actor;
  IF _data ? 'sharing' AND NOT (_data->>'sharing')::boolean THEN DELETE FROM public.challenge_members WHERE member_id=actor;UPDATE public.friend_challenges SET status='cancelled' WHERE owner_id=actor AND status='active';END IF;
 ELSIF _op='lookup' THEN
  PERFORM private.feature_allowance('member-code',20);
  IF NOT EXISTS(SELECT 1 FROM public.social_accounts WHERE member_id=actor AND discoverable) THEN RAISE EXCEPTION 'Enable discovery before searching';END IF;
  SELECT jsonb_build_object('member_id',s.member_id,'name',p.display_name) INTO result FROM public.social_accounts s JOIN public.profiles p ON p.id=s.member_id WHERE s.code=upper(btrim(_data->>'code')) AND s.discoverable AND p.access_active AND s.member_id<>actor AND NOT private.social_blocked(actor,s.member_id);
  RETURN result;
 ELSIF _op IN ('request','accept','decline','remove','block','unblock') THEN
  PERFORM private.feature_allowance('friend-actions',120);
  other=(_data->>'member_id')::uuid;
  IF other IS NULL OR other=actor THEN RAISE EXCEPTION 'Choose another member';END IF;
  IF _op='block' THEN
   INSERT INTO public.member_blocks VALUES(actor,other) ON CONFLICT DO NOTHING;
   DELETE FROM public.friendships WHERE a=least(actor,other) AND b=greatest(actor,other);
   DELETE FROM public.challenge_members m USING public.friend_challenges c WHERE m.challenge_id=c.id AND ((c.owner_id=actor AND m.member_id=other) OR (m.member_id=actor AND EXISTS(SELECT 1 FROM public.challenge_members x WHERE x.challenge_id=c.id AND x.member_id=other)));
  ELSIF _op='unblock' THEN DELETE FROM public.member_blocks WHERE member_id=actor AND blocked_id=other;
  ELSE
   IF private.social_blocked(actor,other) OR NOT private.is_active(other) THEN RAISE EXCEPTION 'Member unavailable';END IF;
   SELECT * INTO relationship FROM public.friendships WHERE a=least(actor,other) AND b=greatest(actor,other) FOR UPDATE;
   IF _op='request' THEN
    IF NOT EXISTS(SELECT 1 FROM public.social_accounts WHERE member_id=actor AND discoverable) OR NOT EXISTS(SELECT 1 FROM public.social_accounts WHERE member_id=other AND discoverable) THEN RAISE EXCEPTION 'Member unavailable';END IF;
    IF relationship.status='declined' THEN RAISE EXCEPTION 'Request not available';END IF;
    INSERT INTO public.friendships VALUES(least(actor,other),greatest(actor,other),actor,'pending') ON CONFLICT DO NOTHING;
   ELSIF _op='remove' THEN
    DELETE FROM public.friendships WHERE a=least(actor,other) AND b=greatest(actor,other);
    DELETE FROM public.challenge_members m USING public.friend_challenges c WHERE m.challenge_id=c.id AND ((c.owner_id=actor AND m.member_id=other) OR (c.owner_id=other AND m.member_id=actor));
   ELSE
    IF relationship.requested_by=actor OR relationship.status IS NULL OR relationship.status NOT IN ('pending','accepted') OR (_op='decline' AND relationship.status<>'pending') THEN RAISE EXCEPTION 'Only the recipient can respond';END IF;
    UPDATE public.friendships SET status=CASE WHEN _op='accept' THEN 'accepted' ELSE 'declined' END WHERE a=relationship.a AND b=relationship.b;
   END IF;
  END IF;
 ELSIF _op='cancel_creation' THEN
  cid=(_data->>'id')::uuid;
  IF cid IS NULL OR EXISTS(SELECT 1 FROM public.friend_challenges WHERE id=cid AND owner_id<>actor) THEN RAISE EXCEPTION 'Challenge unavailable';END IF;
  INSERT INTO private.cancelled_challenge_requests VALUES(actor,cid) ON CONFLICT DO NOTHING;
  UPDATE public.friend_challenges SET status='cancelled' WHERE id=cid AND owner_id=actor;
 ELSIF _op='create_challenge' THEN
  PERFORM private.feature_allowance('challenge-actions',60);
  cid=(_data->>'id')::uuid;
  IF EXISTS(SELECT 1 FROM private.cancelled_challenge_requests WHERE member_id=actor AND request_id=cid) THEN RAISE EXCEPTION 'This challenge request was cancelled';END IF;
  IF NOT EXISTS(SELECT 1 FROM public.social_accounts WHERE member_id=actor AND sharing) THEN RAISE EXCEPTION 'Enable challenge sharing first';END IF;
  SELECT * INTO challenge FROM public.friend_challenges WHERE id=cid;
  IF challenge.id IS NOT NULL THEN
   IF challenge.owner_id<>actor OR challenge.title<>btrim(_data->>'title') OR challenge.metric<>_data->>'metric' OR challenge.goal<>(_data->>'goal')::int OR challenge.starts_on<>(_data->>'starts_on')::date OR challenge.ends_on<>(_data->>'ends_on')::date THEN RAISE EXCEPTION 'Challenge identity already used';END IF;
  ELSE
   IF (_data->>'starts_on')::date<today OR (_data->>'starts_on')::date>today+90 OR (SELECT count(*) FROM public.friend_challenges WHERE owner_id=actor AND status='active')>=20 THEN RAISE EXCEPTION 'Choose a current or future start; at most 20 active challenges';END IF;
   INSERT INTO public.friend_challenges(id,owner_id,title,metric,goal,starts_on,ends_on) VALUES(cid,actor,btrim(_data->>'title'),_data->>'metric',(_data->>'goal')::int,(_data->>'starts_on')::date,(_data->>'ends_on')::date);
   INSERT INTO public.challenge_members VALUES(cid,actor,'accepted');
  END IF;
 ELSIF _op IN ('invite','join','leave','refresh_challenge','cancel_challenge') THEN
  cid=(_data->>'id')::uuid;
  SELECT * INTO challenge FROM public.friend_challenges WHERE id=cid FOR UPDATE;
  IF challenge.id IS NULL OR (challenge.owner_id<>actor AND NOT EXISTS(SELECT 1 FROM public.challenge_members WHERE challenge_id=cid AND member_id=actor)) THEN RAISE EXCEPTION 'Challenge unavailable';END IF;
  IF _op='invite' THEN
   other=(_data->>'member_id')::uuid;
   IF challenge.owner_id<>actor OR challenge.status<>'active' OR challenge.ends_on<today OR NOT private.social_friends(actor,other) OR NOT EXISTS(SELECT 1 FROM public.social_accounts WHERE member_id=other AND sharing) OR (SELECT count(*) FROM public.challenge_members WHERE challenge_id=cid)>=10 THEN RAISE EXCEPTION 'Friend invitation unavailable';END IF;
   INSERT INTO public.challenge_members VALUES(cid,other,'invited') ON CONFLICT DO NOTHING;
  ELSIF _op='join' THEN
   IF challenge.status<>'active' OR challenge.ends_on<today OR NOT private.social_friends(actor,challenge.owner_id) OR NOT EXISTS(SELECT 1 FROM public.social_accounts WHERE member_id=actor AND sharing) THEN RAISE EXCEPTION 'Challenge invitation unavailable';END IF;
   UPDATE public.challenge_members SET status='accepted' WHERE challenge_id=cid AND member_id=actor;
  ELSIF _op='leave' THEN
   DELETE FROM public.challenge_members WHERE challenge_id=cid AND member_id=actor;
   IF challenge.owner_id=actor THEN UPDATE public.friend_challenges SET status='cancelled' WHERE id=cid;END IF;
  ELSIF _op='cancel_challenge' THEN
   IF challenge.owner_id<>actor THEN RAISE EXCEPTION 'Challenge owner required';END IF;
   UPDATE public.friend_challenges SET status='cancelled' WHERE id=cid;
  ELSE
   total=private.challenge_total(cid);
   IF challenge.status<>'cancelled' AND today>=challenge.starts_on THEN UPDATE public.friend_challenges SET status=CASE WHEN total>=challenge.goal THEN 'completed' ELSE 'active' END,completed_at=CASE WHEN total>=challenge.goal THEN coalesce(completed_at,now()) ELSE NULL END WHERE id=cid;END IF;
  END IF;
 ELSIF _op<>'state' THEN RAISE EXCEPTION 'Unknown social operation';END IF;
 RETURN jsonb_build_object(
  'account',(SELECT to_jsonb(s) FROM public.social_accounts s WHERE member_id=actor),
  'friends',coalesce((SELECT jsonb_agg(jsonb_build_object('member_id',p.id,'name',p.display_name,'status',f.status,'incoming',f.requested_by<>actor)) FROM public.friendships f JOIN public.profiles p ON p.id=CASE WHEN f.a=actor THEN f.b ELSE f.a END WHERE actor IN(f.a,f.b) AND p.access_active AND f.status<>'declined' AND NOT private.social_blocked(actor,p.id)),'[]'),
  'blocked',coalesce((SELECT jsonb_agg(jsonb_build_object('member_id',blocked_id)) FROM public.member_blocks WHERE member_id=actor),'[]'),
  'challenges',coalesce((SELECT jsonb_agg(to_jsonb(c)||jsonb_build_object('progress',private.challenge_total(c.id),'participation',m.status,'participants',(SELECT count(*) FROM public.challenge_members WHERE challenge_id=c.id AND status='accepted'))) FROM public.friend_challenges c LEFT JOIN public.challenge_members m ON m.challenge_id=c.id AND m.member_id=actor WHERE (c.owner_id=actor OR m.member_id=actor) AND NOT private.social_blocked(actor,c.owner_id)),'[]')
 );
END $$;
REVOKE ALL ON FUNCTION private.social_action(text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.social_action(text,jsonb) TO authenticated;
CREATE FUNCTION public.social_action(_op text,_data jsonb DEFAULT '{}') RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.social_action(_op,_data) $$;
REVOKE ALL ON FUNCTION public.social_action(text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.social_action(text,jsonb) TO authenticated;
