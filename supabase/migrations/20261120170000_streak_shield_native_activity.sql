-- Streak shields follow the same activity rule as public.member_activity_days: only
-- finished in-app (native) workouts count, so imported history neither blocks a shield
-- nor lets one continue a streak the app does not show.
CREATE OR REPLACE FUNCTION private.validate_streak_shield() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE d date := (now() AT TIME ZONE 'Africa/Cairo')::date; used integer;
BEGIN
  IF NEW.member_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF NEW.shield_date NOT IN (d, d - 1) THEN RAISE EXCEPTION 'Shields protect today or yesterday only (Cairo time)'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(NEW.member_id::text), pg_catalog.hashtext(to_char(NEW.shield_date,'YYYY-MM')));
  SELECT count(*) INTO used FROM public.streak_shields WHERE member_id = NEW.member_id AND shield_date >= date_trunc('month',NEW.shield_date)::date AND shield_date < (date_trunc('month',NEW.shield_date) + interval '1 month')::date;
  IF used >= 2 THEN RAISE EXCEPTION 'Both monthly shields have been used'; END IF;
  IF EXISTS (SELECT 1 FROM public.food_logs WHERE member_id = NEW.member_id AND log_date = NEW.shield_date)
    OR EXISTS (SELECT 1 FROM public.workout_sessions WHERE member_id = NEW.member_id AND origin = 'native' AND finished_at IS NOT NULL AND (started_at AT TIME ZONE 'Africa/Cairo')::date = NEW.shield_date)
  THEN RAISE EXCEPTION 'This day already has activity'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.food_logs WHERE member_id = NEW.member_id AND log_date = NEW.shield_date - 1)
    AND NOT EXISTS (SELECT 1 FROM public.workout_sessions WHERE member_id = NEW.member_id AND origin = 'native' AND finished_at IS NOT NULL AND (started_at AT TIME ZONE 'Africa/Cairo')::date = NEW.shield_date - 1)
    AND NOT EXISTS (SELECT 1 FROM public.streak_shields WHERE member_id = NEW.member_id AND shield_date = NEW.shield_date - 1)
  THEN RAISE EXCEPTION 'A shield can only continue an existing streak'; END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION private.validate_streak_shield() FROM PUBLIC, anon, authenticated;
