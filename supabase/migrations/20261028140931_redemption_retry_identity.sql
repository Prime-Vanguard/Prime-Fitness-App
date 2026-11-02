SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='120s';
CREATE FUNCTION public.request_redemption(_member uuid,_request uuid,_reward uuid,_expected_cost integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE receipt public.redemptions; previous_cost text;
BEGIN
 IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM _member OR NOT private.is_active(auth.uid()) OR _request IS NULL OR _reward IS NULL OR _expected_cost IS NULL OR _expected_cost<=0 THEN RAISE EXCEPTION 'Active member and valid redemption request required';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('redemption:'||auth.uid()::text||':'||_request::text,0));
 SELECT * INTO receipt FROM public.redemptions WHERE id=_request AND member_id=auth.uid();
 IF FOUND THEN
  IF receipt.reward_id<>_reward THEN RAISE EXCEPTION 'Request ID already belongs to a different reward';END IF;
  RETURN to_jsonb(receipt);
 END IF;
 previous_cost:=current_setting('prime.redemption_expected_cost',true);
 PERFORM set_config('prime.redemption_expected_cost',_expected_cost::text,true);
 INSERT INTO public.redemptions(id,member_id,reward_id) VALUES(_request,auth.uid(),_reward) RETURNING * INTO receipt;
 PERFORM set_config('prime.redemption_expected_cost',coalesce(previous_cost,''),true);
 RETURN to_jsonb(receipt);
END $$;
REVOKE ALL ON FUNCTION public.request_redemption(uuid,uuid,uuid,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.request_redemption(uuid,uuid,uuid,integer) TO authenticated;
-- Compare the confirmed price under the existing reward/stock lock.
DO $$ DECLARE definition text;needle text='NEW.cost_pv := r.cost_pv;';BEGIN
 SELECT pg_get_functiondef('public.redemption_before_insert()'::regprocedure) INTO definition;
 IF strpos(definition,needle)=0 THEN RAISE EXCEPTION 'Redemption trigger changed; review price guard';END IF;
 definition:=replace(definition,needle,E'IF nullif(current_setting(''prime.redemption_expected_cost'',true),'''') IS NOT NULL AND r.cost_pv<>current_setting(''prime.redemption_expected_cost'',true)::integer THEN RAISE EXCEPTION ''Reward price changed; review the current price before starting another request'' USING ERRCODE=''PF001'';END IF;\n  '||needle);
 EXECUTE definition;
END $$;
