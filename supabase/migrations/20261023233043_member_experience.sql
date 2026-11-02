-- Member-owned favorites, server-enforced monthly shields, opt-in Pod activity.
CREATE TABLE public.saved_meals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 100),
  kind text NOT NULL CHECK (kind IN ('food','meal')),
  items jsonb NOT NULL CHECK (jsonb_typeof(items) = 'array' AND jsonb_array_length(items) BETWEEN 1 AND 50),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX saved_meals_member_created_idx ON public.saved_meals(member_id, created_at DESC);
ALTER TABLE public.saved_meals ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_meals TO authenticated;
GRANT ALL ON public.saved_meals TO service_role;
CREATE POLICY "favorites own read" ON public.saved_meals FOR SELECT TO authenticated USING (member_id = (SELECT auth.uid()));
CREATE POLICY "favorites own insert" ON public.saved_meals FOR INSERT TO authenticated WITH CHECK (member_id = (SELECT auth.uid()) AND private.is_active((SELECT auth.uid())));
CREATE POLICY "favorites own update" ON public.saved_meals FOR UPDATE TO authenticated USING (member_id = (SELECT auth.uid())) WITH CHECK (member_id = (SELECT auth.uid()) AND private.is_active((SELECT auth.uid())));
CREATE POLICY "favorites own delete" ON public.saved_meals FOR DELETE TO authenticated USING (member_id = (SELECT auth.uid()));

CREATE TABLE public.streak_shields (
  member_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  shield_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(member_id, shield_date)
);
ALTER TABLE public.streak_shields ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.streak_shields TO authenticated;
GRANT INSERT(member_id, shield_date) ON public.streak_shields TO authenticated;
GRANT ALL ON public.streak_shields TO service_role;
CREATE POLICY "shields own read" ON public.streak_shields FOR SELECT TO authenticated USING (member_id = (SELECT auth.uid()));
CREATE POLICY "shields own insert" ON public.streak_shields FOR INSERT TO authenticated WITH CHECK (member_id = (SELECT auth.uid()) AND private.is_active((SELECT auth.uid())));

CREATE FUNCTION private.validate_streak_shield() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE d date := (now() AT TIME ZONE 'Africa/Cairo')::date; used integer;
BEGIN
  IF NEW.member_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF NEW.shield_date NOT IN (d, d - 1) THEN RAISE EXCEPTION 'Shields protect today or yesterday only (Cairo time)'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(NEW.member_id::text), pg_catalog.hashtext(to_char(NEW.shield_date,'YYYY-MM')));
  SELECT count(*) INTO used FROM public.streak_shields WHERE member_id = NEW.member_id AND shield_date >= date_trunc('month',NEW.shield_date)::date AND shield_date < (date_trunc('month',NEW.shield_date) + interval '1 month')::date;
  IF used >= 2 THEN RAISE EXCEPTION 'Both monthly shields have been used'; END IF;
  IF EXISTS (SELECT 1 FROM public.food_logs WHERE member_id = NEW.member_id AND log_date = NEW.shield_date)
    OR EXISTS (SELECT 1 FROM public.workout_sessions WHERE member_id = NEW.member_id AND finished_at IS NOT NULL AND (started_at AT TIME ZONE 'Africa/Cairo')::date = NEW.shield_date)
  THEN RAISE EXCEPTION 'This day already has activity'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.food_logs WHERE member_id = NEW.member_id AND log_date = NEW.shield_date - 1)
    AND NOT EXISTS (SELECT 1 FROM public.workout_sessions WHERE member_id = NEW.member_id AND finished_at IS NOT NULL AND (started_at AT TIME ZONE 'Africa/Cairo')::date = NEW.shield_date - 1)
    AND NOT EXISTS (SELECT 1 FROM public.streak_shields WHERE member_id = NEW.member_id AND shield_date = NEW.shield_date - 1)
  THEN RAISE EXCEPTION 'A shield can only continue an existing streak'; END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION private.validate_streak_shield() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER validate_streak_shield BEFORE INSERT ON public.streak_shields FOR EACH ROW EXECUTE FUNCTION private.validate_streak_shield();

ALTER TABLE public.profiles ADD COLUMN pod_feed_opt_in boolean NOT NULL DEFAULT false;
CREATE INDEX pod_members_member_pod_idx ON public.pod_members(member_id, pod_id);

-- These narrow helpers reveal no health data and always validate the caller.
-- They live outside the exposed API schema to avoid public privileged RPCs.
CREATE FUNCTION private.shares_pod(_pod uuid, _member uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT auth.uid() IS NOT NULL AND
    (EXISTS (SELECT 1 FROM public.pod_members WHERE pod_id = _pod AND member_id = auth.uid()) OR EXISTS (SELECT 1 FROM public.pods WHERE id = _pod AND leader_id = auth.uid())) AND
    (EXISTS (SELECT 1 FROM public.pod_members WHERE pod_id = _pod AND member_id = _member) OR EXISTS (SELECT 1 FROM public.pods WHERE id = _pod AND leader_id = _member));
$$;
CREATE FUNCTION private.pod_feed_visible(_member uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM public.profiles WHERE id = _member AND pod_feed_opt_in AND access_active);
$$;
REVOKE EXECUTE ON FUNCTION private.shares_pod(uuid,uuid), private.pod_feed_visible(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.shares_pod(uuid,uuid), private.pod_feed_visible(uuid) TO authenticated;

CREATE FUNCTION private.leads_pod(_pod uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM public.pods WHERE id = _pod AND leader_id = auth.uid());
$$;
REVOKE EXECUTE ON FUNCTION private.leads_pod(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.leads_pod(uuid) TO authenticated;
-- Avoid the existing pods -> pod_members -> pods policy recursion while
-- retaining member/self and leader/roster visibility.
DROP POLICY "pods read" ON public.pods;
CREATE POLICY "pods read" ON public.pods FOR SELECT TO authenticated USING (private.is_admin((SELECT auth.uid())) OR private.shares_pod(id,(SELECT auth.uid())));
DROP POLICY "pod members read" ON public.pod_members;
CREATE POLICY "pod members read" ON public.pod_members FOR SELECT TO authenticated USING (private.is_admin((SELECT auth.uid())) OR member_id = (SELECT auth.uid()) OR private.leads_pod(pod_id));

CREATE VIEW public.member_xp_totals WITH (security_invoker = true) AS
  SELECT member_id, sum(amount)::bigint AS xp FROM public.xp_events GROUP BY member_id;
REVOKE ALL ON public.member_xp_totals FROM anon;
GRANT SELECT ON public.member_xp_totals TO authenticated;

CREATE VIEW public.pod_leaderboard WITH (security_invoker = true) AS
  SELECT p.id AS pod_id, b.member_id, b.week_start, b.xp, b.display_name, b.opted_in
  FROM public.leaderboard_weekly b CROSS JOIN public.pods p
  WHERE b.opted_in AND private.shares_pod(p.id, b.member_id);
REVOKE ALL ON public.pod_leaderboard FROM anon;
GRANT SELECT ON public.pod_leaderboard TO authenticated;

CREATE TABLE public.pod_activity (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  pod_id uuid NOT NULL REFERENCES public.pods(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  title text NOT NULL,
  xp integer NOT NULL,
  event_id bigint NOT NULL REFERENCES public.xp_events(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(pod_id,event_id)
);
CREATE INDEX pod_activity_pod_time_idx ON public.pod_activity(pod_id,created_at DESC);
CREATE INDEX pod_activity_member_idx ON public.pod_activity(member_id);
CREATE INDEX pod_activity_event_idx ON public.pod_activity(event_id);
ALTER TABLE public.pod_activity ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.pod_activity TO authenticated;
GRANT ALL ON public.pod_activity TO service_role;
CREATE POLICY "feed current pod opted in" ON public.pod_activity FOR SELECT TO authenticated USING (private.shares_pod(pod_id,member_id) AND private.pod_feed_visible(member_id));

CREATE FUNCTION private.publish_workout_activity() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  -- Only trusted XP events publish; clients cannot write XP or feed entries.
  IF NEW.source <> 'workout' THEN RETURN NEW; END IF;
  INSERT INTO public.pod_activity(pod_id,member_id,display_name,title,xp,event_id,created_at)
    SELECT p.id, NEW.member_id, coalesce(pr.display_name,'Member'), left(coalesce(s.title,'Workout'),150), NEW.amount, NEW.id, NEW.created_at
    FROM public.pods p
    JOIN public.profiles pr ON pr.id = NEW.member_id AND pr.pod_feed_opt_in AND pr.access_active
    JOIN public.workout_sessions s ON s.id::text = NEW.source_ref AND s.member_id = NEW.member_id AND s.finished_at IS NOT NULL
    WHERE auth.uid() IS NOT NULL AND (auth.uid() = NEW.member_id OR private.is_admin(auth.uid()))
      AND (p.leader_id = NEW.member_id OR EXISTS (SELECT 1 FROM public.pod_members pm WHERE pm.pod_id = p.id AND pm.member_id = NEW.member_id))
    ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION private.publish_workout_activity() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER publish_workout_activity AFTER INSERT ON public.xp_events FOR EACH ROW EXECUTE FUNCTION private.publish_workout_activity();
