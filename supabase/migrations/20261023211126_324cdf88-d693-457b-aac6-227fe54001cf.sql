CREATE OR REPLACE FUNCTION private.is_active(_user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((SELECT access_active FROM public.profiles WHERE id = _user_id), false)
$$;
REVOKE EXECUTE ON FUNCTION private.is_active(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_active(uuid) TO authenticated;
CREATE POLICY "active members only" ON public.workout_sessions AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (private.is_active(auth.uid()));
CREATE POLICY "active members only" ON public.set_logs AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (private.is_active(auth.uid()));
CREATE POLICY "active members only" ON public.food_logs AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (private.is_active(auth.uid()));
CREATE POLICY "active members only" ON public.water_logs AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (private.is_active(auth.uid()));
CREATE POLICY "active members only" ON public.body_measurements AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (private.is_active(auth.uid()));
CREATE POLICY "active members only" ON public.pv_claims AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (private.is_active(auth.uid()));