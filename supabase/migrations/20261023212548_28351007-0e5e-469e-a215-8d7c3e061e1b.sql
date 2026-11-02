ALTER TABLE public.profiles ADD COLUMN leaderboard_opt_in boolean NOT NULL DEFAULT false;

CREATE TABLE public.leaderboard_weekly (
  member_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  xp integer NOT NULL DEFAULT 0,
  display_name text,
  opted_in boolean NOT NULL DEFAULT false,
  PRIMARY KEY (member_id, week_start)
);
CREATE INDEX ON public.leaderboard_weekly(week_start, xp DESC);
GRANT SELECT ON public.leaderboard_weekly TO authenticated;
GRANT ALL ON public.leaderboard_weekly TO service_role;
ALTER TABLE public.leaderboard_weekly ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leaderboard read" ON public.leaderboard_weekly FOR SELECT TO authenticated
  USING (opted_in OR member_id = auth.uid());

CREATE OR REPLACE FUNCTION public.leaderboard_on_xp() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p public.profiles;
BEGIN
  SELECT * INTO p FROM public.profiles WHERE id = NEW.member_id;
  INSERT INTO public.leaderboard_weekly(member_id, week_start, xp, display_name, opted_in)
  VALUES (NEW.member_id, date_trunc('week', NEW.created_at AT TIME ZONE 'Africa/Cairo')::date, NEW.amount, p.display_name, coalesce(p.leaderboard_opt_in,false))
  ON CONFLICT (member_id, week_start) DO UPDATE SET xp = leaderboard_weekly.xp + EXCLUDED.xp, display_name = EXCLUDED.display_name, opted_in = EXCLUDED.opted_in;
  RETURN NEW;
END $$;
CREATE TRIGGER leaderboard_on_xp AFTER INSERT ON public.xp_events FOR EACH ROW EXECUTE FUNCTION public.leaderboard_on_xp();

CREATE OR REPLACE FUNCTION public.leaderboard_on_profile() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.leaderboard_opt_in IS DISTINCT FROM OLD.leaderboard_opt_in OR NEW.display_name IS DISTINCT FROM OLD.display_name THEN
    UPDATE public.leaderboard_weekly SET opted_in = NEW.leaderboard_opt_in, display_name = NEW.display_name WHERE member_id = NEW.id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER leaderboard_on_profile AFTER UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.leaderboard_on_profile();

INSERT INTO public.leaderboard_weekly(member_id, week_start, xp, display_name, opted_in)
SELECT e.member_id, date_trunc('week', e.created_at AT TIME ZONE 'Africa/Cairo')::date, sum(e.amount), max(p.display_name), bool_or(p.leaderboard_opt_in)
FROM public.xp_events e JOIN public.profiles p ON p.id = e.member_id GROUP BY 1,2
ON CONFLICT DO NOTHING;

REVOKE EXECUTE ON FUNCTION public.leaderboard_on_xp(), public.leaderboard_on_profile() FROM PUBLIC, anon, authenticated;