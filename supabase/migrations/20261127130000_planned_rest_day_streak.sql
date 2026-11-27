SET LOCAL lock_timeout = '5s';

-- Planned rest days keep the streak (founder decision 3). A rest day is a date in an active
-- calendar schedule, up to today in Cairo, whose program week and day have no exercises.
-- It comes from the coach's plan, not from due dates, so moving a session cannot create one.
CREATE OR REPLACE VIEW public.member_activity_days WITH (security_invoker = true) AS
  SELECT member_id, (started_at AT TIME ZONE 'Africa/Cairo')::date AS activity_date
  FROM public.workout_sessions WHERE finished_at IS NOT NULL AND origin = 'native'
  UNION SELECT member_id, log_date FROM public.food_logs
  UNION SELECT member_id, shield_date FROM public.streak_shields
  UNION SELECT s.member_id, g.d::date
  FROM public.program_schedules s
  JOIN public.program_assignments a ON a.id = s.assignment_id AND a.active
  JOIN public.program_versions v ON v.id = a.program_version_id
  CROSS JOIN LATERAL generate_series(
    s.start_date,
    LEAST(s.start_date + v.weeks * 7 - 1, (now() AT TIME ZONE 'Africa/Cairo')::date),
    interval '1 day'
  ) g(d)
  WHERE s.mode = 'calendar'
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(v.items) i
      WHERE (i->>'week')::int = (g.d::date - s.start_date) / 7 + 1
        AND (i->>'day')::int = (g.d::date - s.start_date) % 7 + 1
    );

-- Shields use the same activity rule as the streak: no shield on a day that already counts
-- (including a planned rest day), and a shield may continue from a rest day.
CREATE OR REPLACE FUNCTION private.validate_streak_shield() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE d date := (now() AT TIME ZONE 'Africa/Cairo')::date; used integer;
BEGIN
  IF NEW.member_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF NEW.shield_date NOT IN (d, d - 1) THEN RAISE EXCEPTION 'Shields protect today or yesterday only (Cairo time)'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(NEW.member_id::text), pg_catalog.hashtext(to_char(NEW.shield_date,'YYYY-MM')));
  SELECT count(*) INTO used FROM public.streak_shields WHERE member_id = NEW.member_id AND shield_date >= date_trunc('month',NEW.shield_date)::date AND shield_date < (date_trunc('month',NEW.shield_date) + interval '1 month')::date;
  IF used >= 2 THEN RAISE EXCEPTION 'Both monthly shields have been used'; END IF;
  IF EXISTS (SELECT 1 FROM public.member_activity_days WHERE member_id = NEW.member_id AND activity_date = NEW.shield_date)
  THEN RAISE EXCEPTION 'This day already has activity'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.member_activity_days WHERE member_id = NEW.member_id AND activity_date = NEW.shield_date - 1)
  THEN RAISE EXCEPTION 'A shield can only continue an existing streak'; END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION private.validate_streak_shield() FROM PUBLIC, anon, authenticated;
