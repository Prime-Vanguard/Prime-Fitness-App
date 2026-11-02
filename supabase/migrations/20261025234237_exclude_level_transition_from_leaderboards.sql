-- Level-preservation credits are not newly earned weekly competition points.
SET LOCAL lock_timeout = '5s';
DROP TRIGGER leaderboard_on_xp ON public.xp_events;
CREATE TRIGGER leaderboard_on_xp AFTER INSERT ON public.xp_events
FOR EACH ROW WHEN (NEW.source <> 'level_curve_transition')
EXECUTE FUNCTION public.leaderboard_on_xp();

-- Repair only affected weeks, preserving XP history and leaderboard privacy choices.
WITH affected AS (
  SELECT DISTINCT member_id, date_trunc('week', created_at AT TIME ZONE 'Africa/Cairo')::date AS week_start
  FROM public.xp_events WHERE source = 'level_curve_transition'
)
UPDATE public.leaderboard_weekly b SET xp = (
  SELECT coalesce(sum(e.amount), 0)::integer FROM public.xp_events e
  WHERE e.member_id = b.member_id AND e.source <> 'level_curve_transition'
    AND date_trunc('week', e.created_at AT TIME ZONE 'Africa/Cairo')::date = b.week_start
)
FROM affected a WHERE b.member_id = a.member_id AND b.week_start = a.week_start;
