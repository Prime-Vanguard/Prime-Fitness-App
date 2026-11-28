SET LOCAL lock_timeout = '5s';

-- Automatic rest days (founder decision 3, 2026-11-28): a member without an active calendar
-- program (no program, or a rotation program, which has no dates) gets
-- up to 3 rest days in any Monday–Sunday week (Cairo) that has a finished native workout.
-- They are the earliest days of that week, up to today, with no other activity. The shield
-- trigger reads this view, so it needs no change: no shield on a rest day, and a shield may
-- follow one.
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
    )
  UNION SELECT r.member_id, r.d FROM (
    SELECT w.member_id, g.d::date AS d,
      row_number() OVER (PARTITION BY w.member_id, w.week ORDER BY g.d) AS n
    FROM (
      SELECT DISTINCT member_id,
        date_trunc('week', (started_at AT TIME ZONE 'Africa/Cairo')::date)::date AS week
      FROM public.workout_sessions WHERE finished_at IS NOT NULL AND origin = 'native'
    ) w
    CROSS JOIN LATERAL generate_series(
      w.week, LEAST(w.week + 6, (now() AT TIME ZONE 'Africa/Cairo')::date), interval '1 day'
    ) g(d)
    WHERE NOT EXISTS (
        SELECT 1 FROM public.program_schedules s
        JOIN public.program_assignments a ON a.id = s.assignment_id AND a.active
        WHERE s.member_id = w.member_id AND s.mode = 'calendar'
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.workout_sessions x
        WHERE x.member_id = w.member_id AND x.finished_at IS NOT NULL AND x.origin = 'native'
          AND (x.started_at AT TIME ZONE 'Africa/Cairo')::date = g.d::date
      )
      AND NOT EXISTS (SELECT 1 FROM public.food_logs f WHERE f.member_id = w.member_id AND f.log_date = g.d::date)
      AND NOT EXISTS (SELECT 1 FROM public.streak_shields x WHERE x.member_id = w.member_id AND x.shield_date = g.d::date)
  ) r WHERE r.n <= 3;
