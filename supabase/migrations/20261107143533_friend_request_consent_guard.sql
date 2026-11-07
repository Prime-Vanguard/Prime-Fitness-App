-- Preserve recipient consent across removal and block/unblock retries.
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='120s';
CREATE OR REPLACE FUNCTION private.social_action(_op text,_data jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
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
   DELETE FROM public.friendships WHERE a=least(actor,other) AND b=greatest(actor,other) AND status<>'declined';
   DELETE FROM public.challenge_members m USING public.friend_challenges c WHERE m.challenge_id=c.id AND ((c.owner_id=actor AND m.member_id=other) OR (m.member_id=actor AND EXISTS(SELECT 1 FROM public.challenge_members x WHERE x.challenge_id=c.id AND x.member_id=other)));
  ELSIF _op='unblock' THEN DELETE FROM public.member_blocks WHERE member_id=actor AND blocked_id=other;
  ELSE
   IF private.social_blocked(actor,other) OR NOT private.is_active(other) THEN RAISE EXCEPTION 'Member unavailable';END IF;
   SELECT * INTO relationship FROM public.friendships WHERE a=least(actor,other) AND b=greatest(actor,other) FOR UPDATE;
   IF _op='request' THEN
    IF NOT EXISTS(SELECT 1 FROM public.social_accounts WHERE member_id=actor AND discoverable) OR NOT EXISTS(SELECT 1 FROM public.social_accounts WHERE member_id=other AND discoverable) THEN RAISE EXCEPTION 'Member unavailable';END IF;
    IF relationship.status='declined' THEN
     IF relationship.requested_by=actor THEN RAISE EXCEPTION 'Only the recipient can reopen a declined request';END IF;
     UPDATE public.friendships SET requested_by=actor,status='pending',created_at=now() WHERE a=relationship.a AND b=relationship.b;
    ELSE
     INSERT INTO public.friendships VALUES(least(actor,other),greatest(actor,other),actor,'pending') ON CONFLICT DO NOTHING;
    END IF;
   ELSIF _op='remove' THEN
    IF relationship.status='declined' AND relationship.requested_by=actor THEN RAISE EXCEPTION 'Only the recipient can clear a declined request';END IF;
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
