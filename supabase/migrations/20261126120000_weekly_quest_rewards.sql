-- Phase 5.1: weekly quest rewards, awarded from durable activity credits.
-- Credits already enforce one workout and one nutrition day per date, one body check per
-- week, imports excluded and paused members blocked, so quests count credits rather than logs.
SET LOCAL lock_timeout = '5s';

-- Append quest constants; existing columns and the frozen effective_from keep their values.
-- Quests pay from the first Monday after release, so no week is paid for part-way.
DO $$
DECLARE frozen date := (SELECT effective_from FROM public.xp_rules);
BEGIN
  EXECUTE format($view$
    CREATE OR REPLACE VIEW public.xp_rules WITH (security_invoker = true) AS SELECT
      'million-xp-v1'::text AS policy_version, 1000000::integer AS level_100_xp,
      3500::integer AS workout_xp, 5::integer AS workout_weekly_cap,
      650::integer AS nutrition_day_xp, 600::integer AS body_week_xp,
      7::integer AS offline_grace_days, %L::date AS effective_from,
      3::integer AS quest_workout_goal, 5::integer AS quest_nutrition_goal,
      1::integer AS quest_body_goal, 250::integer AS quest_xp, 750::integer AS quest_week_xp,
      %L::date AS quest_effective_from
  $view$, frozen, date_trunc('week', (now() AT TIME ZONE 'Africa/Cairo')::date)::date + 7);
END $$;

CREATE FUNCTION private.award_weekly_quests() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  rules public.xp_rules%ROWTYPE;
  week date := date_trunc('week', NEW.credit_date)::date;
  workouts integer; nutrition integer; body integer;
BEGIN
  SELECT * INTO rules FROM public.xp_rules;
  IF week < rules.quest_effective_from OR NOT private.is_active(NEW.member_id) THEN RETURN NULL; END IF;
  -- Body credits are stored on the week's Monday, so one date range covers all three kinds.
  SELECT count(*) FILTER (WHERE kind = 'workout'), count(*) FILTER (WHERE kind = 'nutrition_day'),
    count(*) FILTER (WHERE kind = 'body_check')
  INTO workouts, nutrition, body
  FROM private.xp_activity_credits
  WHERE member_id = NEW.member_id AND credit_date >= week AND credit_date < week + 7;
  -- award_xp ignores repeats (unique member, source, ref), so re-checking every credit is safe.
  IF workouts >= rules.quest_workout_goal THEN
    PERFORM public.award_xp(NEW.member_id, rules.quest_xp, 'quest', week::text || ':workouts');
  END IF;
  IF nutrition >= rules.quest_nutrition_goal THEN
    PERFORM public.award_xp(NEW.member_id, rules.quest_xp, 'quest', week::text || ':nutrition');
  END IF;
  IF body >= rules.quest_body_goal THEN
    PERFORM public.award_xp(NEW.member_id, rules.quest_xp, 'quest', week::text || ':body');
  END IF;
  IF workouts >= rules.quest_workout_goal AND nutrition >= rules.quest_nutrition_goal
    AND body >= rules.quest_body_goal THEN
    PERFORM public.award_xp(NEW.member_id, rules.quest_week_xp, 'quest_week', week::text);
  END IF;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION private.award_weekly_quests() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER award_weekly_quests AFTER INSERT ON private.xp_activity_credits
FOR EACH ROW EXECUTE FUNCTION private.award_weekly_quests();

-- Members cannot read credits, so this returns only the caller's own current-week counts.
-- The "week" row is the campaign: progress is the number of quests done.
CREATE FUNCTION private.weekly_quests()
RETURNS TABLE (week_start date, quest text, progress integer, goal integer, xp integer,
  awarded boolean, pays boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH rules AS (SELECT * FROM public.xp_rules),
  week AS (SELECT date_trunc('week', (now() AT TIME ZONE 'Africa/Cairo')::date)::date AS d),
  counts AS (
    SELECT c.kind, count(*)::integer AS n FROM private.xp_activity_credits c, week
    WHERE c.member_id = (SELECT auth.uid()) AND c.credit_date >= week.d AND c.credit_date < week.d + 7
    GROUP BY c.kind
  ),
  quests AS (
    SELECT k.quest, k.ord, least(coalesce(counts.n, 0), k.goal) AS progress, k.goal
    FROM (VALUES
      ('workouts', 'workout', 1, (SELECT quest_workout_goal FROM rules)),
      ('nutrition', 'nutrition_day', 2, (SELECT quest_nutrition_goal FROM rules)),
      ('body', 'body_check', 3, (SELECT quest_body_goal FROM rules))
    ) AS k(quest, kind, ord, goal)
    LEFT JOIN counts ON counts.kind = k.kind
  ),
  items AS (
    SELECT quest, ord, progress, goal, (SELECT quest_xp FROM rules) AS xp, 'quest' AS source,
      quest AS suffix FROM quests
    UNION ALL
    SELECT 'week', 4, (SELECT count(*)::integer FROM quests WHERE progress >= goal), 3,
      (SELECT quest_week_xp FROM rules), 'quest_week', NULL
  )
  SELECT week.d, r.quest, r.progress, r.goal, r.xp,
    EXISTS (SELECT 1 FROM public.xp_events e WHERE e.member_id = (SELECT auth.uid())
      AND e.source = r.source
      AND e.source_ref = week.d::text || coalesce(':' || r.suffix, '')),
    week.d >= (SELECT quest_effective_from FROM rules)
  FROM items r, week ORDER BY r.ord
$$;
REVOKE ALL ON FUNCTION private.weekly_quests() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.weekly_quests() TO authenticated;

CREATE FUNCTION public.my_weekly_quests()
RETURNS TABLE (week_start date, quest text, progress integer, goal integer, xp integer,
  awarded boolean, pays boolean)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT * FROM private.weekly_quests()
$$;
REVOKE ALL ON FUNCTION public.my_weekly_quests() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_weekly_quests() TO authenticated;
