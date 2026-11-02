-- Keep rank ranges in src/lib/levels.ts unchanged. Preserve existing levels and ledger rows.
SET LOCAL lock_timeout = '5s';
LOCK TABLE public.xp_events, public.level_thresholds IN SHARE ROW EXCLUSIVE MODE;
CREATE TEMP TABLE xp_transition ON COMMIT DROP AS
SELECT p.id AS member_id, coalesce(sum(e.amount), 0)::bigint AS xp,
  coalesce((SELECT max(t.level) FROM public.level_thresholds t
    WHERE t.xp_required <= coalesce(sum(e.amount), 0)), 1) AS level
FROM public.profiles p LEFT JOIN public.xp_events e ON e.member_id = p.id GROUP BY p.id;

UPDATE public.level_thresholds SET xp_required =
  (round(10000 * power((level - 1)::numeric / 99, 1.8)) * 100)::integer,
  provisional = false;
INSERT INTO public.xp_events(member_id, amount, source, source_ref)
SELECT x.member_id, (t.xp_required - x.xp)::integer, 'level_curve_transition', 'million-xp-v1'
FROM xp_transition x JOIN public.level_thresholds t USING (level)
WHERE t.xp_required > x.xp ON CONFLICT DO NOTHING;

-- Immutable policy constants: both the UI and internal triggers read this view.
-- Freeze the launch date so old backups cannot mint rewards at the new rate.
DO $$ BEGIN
  EXECUTE format($view$
    CREATE VIEW public.xp_rules WITH (security_invoker = true) AS SELECT
      'million-xp-v1'::text AS policy_version, 1000000::integer AS level_100_xp,
      3500::integer AS workout_xp, 5::integer AS workout_weekly_cap,
      650::integer AS nutrition_day_xp, 600::integer AS body_week_xp,
      7::integer AS offline_grace_days, %L::date AS effective_from
  $view$, (now() AT TIME ZONE 'Africa/Cairo')::date - 7);
END $$;
REVOKE ALL ON public.xp_rules FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.xp_rules TO authenticated, service_role;

CREATE TABLE private.xp_activity_credits (
  member_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('workout', 'nutrition_day', 'body_check')),
  credit_date date NOT NULL,
  PRIMARY KEY (member_id, kind, credit_date)
);
ALTER TABLE private.xp_activity_credits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.xp_activity_credits FROM PUBLIC, anon, authenticated;
-- Receipts survive deletion of their source log. Preserve historical awards too.
INSERT INTO private.xp_activity_credits(member_id, kind, credit_date)
SELECT e.member_id, e.source,
  CASE WHEN e.source = 'workout' THEN
    (coalesce(s.started_at, e.created_at) AT TIME ZONE 'Africa/Cairo')::date
  WHEN e.source = 'body_check' THEN date_trunc('week', e.source_ref::date)::date
  ELSE e.source_ref::date END
FROM public.xp_events e LEFT JOIN public.workout_sessions s
  ON e.source = 'workout' AND s.id::text = e.source_ref
WHERE e.source IN ('workout', 'nutrition_day', 'body_check') ON CONFLICT DO NOTHING;

CREATE FUNCTION private.claim_activity_xp(_member uuid, _kind text, _day date, _ref text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE rules public.xp_rules%ROWTYPE; period date; claimed integer;
BEGIN
  IF NOT private.is_active(_member) THEN RETURN false; END IF;
  SELECT * INTO rules FROM public.xp_rules;
  IF _day > (now() AT TIME ZONE 'Africa/Cairo')::date
    OR _day < greatest(rules.effective_from,
      (now() AT TIME ZONE 'Africa/Cairo')::date - rules.offline_grace_days)
    THEN RETURN false; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('pf-xp:' || _member::text, 0));
  IF EXISTS (SELECT 1 FROM public.xp_events WHERE member_id = _member
    AND source = _kind AND source_ref = _ref) THEN RETURN false; END IF;
  period := CASE WHEN _kind = 'body_check' THEN date_trunc('week', _day)::date ELSE _day END;
  IF _kind = 'workout' AND (SELECT count(*) FROM private.xp_activity_credits
    WHERE member_id = _member AND kind = 'workout'
    AND credit_date >= date_trunc('week', _day)::date
    AND credit_date < date_trunc('week', _day)::date + 7) >= rules.workout_weekly_cap
    THEN RETURN false; END IF;
  INSERT INTO private.xp_activity_credits VALUES (_member, _kind, period) ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS claimed = ROW_COUNT;
  RETURN claimed > 0;
END $$;
REVOKE ALL ON FUNCTION private.claim_activity_xp(uuid,text,date,text) FROM PUBLIC, anon, authenticated;

UPDATE public.badges SET xp_bonus = CASE code
  WHEN 'first_workout' THEN 500 WHEN 'workouts_10' THEN 1500
  WHEN 'workouts_50' THEN 4000 WHEN 'workouts_100' THEN 7500
  WHEN 'first_food' THEN 250 WHEN 'food_30' THEN 3000
  WHEN 'first_body' THEN 250 WHEN 'first_pv' THEN 1000 ELSE xp_bonus END;

CREATE OR REPLACE FUNCTION public.grant_badge(_member uuid, _code text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE bonus integer; n integer;
BEGIN
  IF NOT private.is_active(_member) THEN RETURN; END IF;
  INSERT INTO public.member_badges(member_id, badge_code) VALUES (_member, _code) ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n > 0 THEN
    SELECT xp_bonus INTO bonus FROM public.badges WHERE code = _code;
    IF coalesce(bonus,0) > 0 THEN PERFORM public.award_xp(_member, bonus, 'badge', _code); END IF;
  END IF;
END $$;

-- Count rewarded days, not repeatedly created/deleted rows, for milestone badges.
DROP TRIGGER badges_on_workout ON public.workout_sessions;
DROP TRIGGER badges_on_food ON public.food_logs;
DROP TRIGGER badges_on_body ON public.body_measurements;
CREATE OR REPLACE FUNCTION public.xp_on_workout() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE c integer;
BEGIN
  IF OLD.finished_at IS NULL AND NEW.finished_at IS NOT NULL
    AND NEW.finished_at >= NEW.started_at AND NEW.finished_at <= now()
    AND EXISTS (SELECT 1 FROM public.set_logs WHERE session_id = NEW.id AND reps > 0)
    AND private.claim_activity_xp(NEW.member_id, 'workout',
      (NEW.started_at AT TIME ZONE 'Africa/Cairo')::date, NEW.id::text) THEN
    PERFORM public.award_xp(NEW.member_id, (SELECT workout_xp FROM public.xp_rules), 'workout', NEW.id::text);
    SELECT count(*) INTO c FROM private.xp_activity_credits WHERE member_id = NEW.member_id AND kind = 'workout';
    IF c >= 1 THEN PERFORM public.grant_badge(NEW.member_id, 'first_workout'); END IF;
    IF c >= 10 THEN PERFORM public.grant_badge(NEW.member_id, 'workouts_10'); END IF;
    IF c >= 50 THEN PERFORM public.grant_badge(NEW.member_id, 'workouts_50'); END IF;
    IF c >= 100 THEN PERFORM public.grant_badge(NEW.member_id, 'workouts_100'); END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.xp_on_food() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE c integer;
BEGIN
  IF (NEW.calories > 0 OR NEW.protein_g > 0 OR NEW.carbs_g > 0 OR NEW.fat_g > 0)
    AND private.claim_activity_xp(NEW.member_id, 'nutrition_day', NEW.log_date, NEW.log_date::text) THEN
    PERFORM public.award_xp(NEW.member_id, (SELECT nutrition_day_xp FROM public.xp_rules), 'nutrition_day', NEW.log_date::text);
    PERFORM public.grant_badge(NEW.member_id, 'first_food');
    SELECT count(*) INTO c FROM private.xp_activity_credits WHERE member_id = NEW.member_id AND kind = 'nutrition_day';
    IF c >= 30 THEN PERFORM public.grant_badge(NEW.member_id, 'food_30'); END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.xp_on_body() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF coalesce(NEW.weight_kg > 0 OR NEW.waist_cm > 0 OR NEW.body_fat_pct > 0, false)
    AND private.claim_activity_xp(NEW.member_id, 'body_check', NEW.measured_on, NEW.measured_on::text) THEN
    PERFORM public.award_xp(NEW.member_id, (SELECT body_week_xp FROM public.xp_rules), 'body_check', NEW.measured_on::text);
    PERFORM public.grant_badge(NEW.member_id, 'first_body');
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.grant_badge(uuid,text), public.xp_on_workout(),
  public.xp_on_food(), public.xp_on_body() FROM PUBLIC, anon, authenticated;
