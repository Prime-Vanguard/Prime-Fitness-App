SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';
ALTER TABLE public.food_logs ADD CONSTRAINT food_logs_macros_valid CHECK (
  protein_g BETWEEN 0 AND 10000 AND carbs_g BETWEEN 0 AND 10000 AND fat_g BETWEEN 0 AND 10000
);
ALTER TABLE public.water_logs ADD CONSTRAINT water_logs_amount_valid CHECK (ml BETWEEN 1 AND 10000);
ALTER TABLE public.body_measurements ADD CONSTRAINT body_measurements_values_valid CHECK (
  (weight_kg IS NULL OR (weight_kg>0 AND weight_kg<'Infinity'::numeric))
  AND (waist_cm IS NULL OR (waist_cm>0 AND waist_cm<'Infinity'::numeric))
  AND (body_fat_pct IS NULL OR body_fat_pct BETWEEN 0 AND 100)
);
ALTER TABLE public.nutrition_targets ADD CONSTRAINT nutrition_targets_values_valid CHECK (
  (calories IS NULL OR calories BETWEEN 0 AND 100000)
  AND (protein_g IS NULL OR protein_g BETWEEN 0 AND 10000)
  AND (carbs_g IS NULL OR carbs_g BETWEEN 0 AND 10000)
  AND (fat_g IS NULL OR fat_g BETWEEN 0 AND 10000)
  AND (water_ml IS NULL OR water_ml BETWEEN 1 AND 100000)
);
CREATE INDEX workout_sessions_member_finished_idx ON public.workout_sessions(member_id,finished_at)
  WHERE finished_at IS NOT NULL;

-- One JSON value avoids REST row caps; all totals and roster rows share one statement snapshot.
-- Invoker rights retain RLS. This is not a privileged public RPC.
CREATE FUNCTION public.get_admin_analytics() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $$
DECLARE result jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT private.is_admin(auth.uid()) OR NOT private.is_active(auth.uid()) THEN
    RAISE EXCEPTION 'Only active admins can view organization analytics';
  END IF;
  WITH bounds AS (
    SELECT statement_timestamp() AS stamp,(statement_timestamp() AT TIME ZONE 'Africa/Cairo')::date AS day
  ), workouts AS (
    SELECT s.member_id,
      count(*) FILTER (WHERE s.finished_at>=((b.day-6)::timestamp AT TIME ZONE 'Africa/Cairo')) AS w7,
      count(*) AS w30
    FROM public.workout_sessions s CROSS JOIN bounds b
    WHERE s.finished_at>=((b.day-29)::timestamp AT TIME ZONE 'Africa/Cairo') AND s.finished_at<=b.stamp
    GROUP BY s.member_id
  ), fuel AS (
    SELECT DISTINCT f.member_id FROM public.food_logs f CROSS JOIN bounds b
    WHERE f.log_date BETWEEN b.day-6 AND b.day
  ), xp AS (
    SELECT member_id,sum(amount) AS xp FROM public.xp_events GROUP BY member_id
  ), pv AS (
    SELECT member_id,sum(points) AS balance,
      coalesce(sum(points) FILTER (WHERE points>0 AND source<>'refund'),0) AS issued
    FROM public.pv_ledger GROUP BY member_id
  ), members AS (
    SELECT p.id,p.display_name,p.email,p.access_active,p.created_at,
      coalesce(x.xp,0) AS xp,coalesce(v.balance,0) AS pv,coalesce(v.issued,0) AS issued,
      coalesce(w.w7,0) AS w7,coalesce(w.w30,0) AS w30,
      (coalesce(w.w7,0)>0 OR f.member_id IS NOT NULL) AS engaged
    FROM public.profiles p LEFT JOIN xp x ON x.member_id=p.id LEFT JOIN pv v ON v.member_id=p.id
      LEFT JOIN workouts w ON w.member_id=p.id LEFT JOIN fuel f ON f.member_id=p.id
  ) SELECT jsonb_build_object(
    'asOf',(SELECT stamp FROM bounds),
    'period',jsonb_build_object('from7',(SELECT day-6 FROM bounds),'from30',(SELECT day-29 FROM bounds),'to',(SELECT day FROM bounds)),
    'kpi',jsonb_build_object(
      'members',count(*),'activeMembers',count(*) FILTER (WHERE access_active),
      'engaged7',count(*) FILTER (WHERE engaged),'workouts7',coalesce(sum(w7),0),
      'workouts30',coalesce(sum(w30),0),'pvIssued',coalesce(sum(issued),0),
      'pendingClaims',(SELECT count(*) FROM public.pv_claims WHERE status IN ('pending','needs_info')),
      'pendingRedemptions',(SELECT count(*) FROM public.redemptions WHERE status='pending')
    ),
    'rows',coalesce(jsonb_agg(jsonb_build_object('id',id,'display_name',display_name,'email',email,
      'access_active',access_active,'created_at',created_at,'xp',xp,'pv',pv,'w7',w7,'w30',w30) ORDER BY id),'[]'::jsonb)
  ) INTO result FROM members;
  RETURN result;
END $$;
REVOKE EXECUTE ON FUNCTION public.get_admin_analytics() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_admin_analytics() TO authenticated;
