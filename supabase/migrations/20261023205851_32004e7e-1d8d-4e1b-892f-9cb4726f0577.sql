CREATE TABLE public.xp_events (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, member_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE, amount integer NOT NULL, source text NOT NULL, source_ref text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (member_id, source, source_ref));
CREATE TABLE public.level_thresholds (level integer PRIMARY KEY, xp_required integer NOT NULL, provisional boolean NOT NULL DEFAULT true);
INSERT INTO public.level_thresholds (level, xp_required) SELECT n, round(100 * power(n - 1, 1.5))::int FROM generate_series(1, 100) n;
CREATE TABLE public.pv_tasks (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title_en text NOT NULL, title_ar text, description text, points integer NOT NULL CHECK (points > 0), active boolean NOT NULL DEFAULT true, created_by uuid, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.pv_claims (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), task_id uuid NOT NULL REFERENCES public.pv_tasks(id), member_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE, note text, status text NOT NULL DEFAULT 'pending', review_note text, reviewed_by uuid, reviewed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.pv_ledger (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, member_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE, points integer NOT NULL, source text NOT NULL, claim_id uuid UNIQUE REFERENCES public.pv_claims(id), approved_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now());

GRANT SELECT ON public.xp_events, public.level_thresholds, public.pv_ledger TO authenticated;
GRANT UPDATE ON public.level_thresholds TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pv_tasks TO authenticated;
GRANT SELECT, INSERT ON public.pv_claims TO authenticated;
GRANT ALL ON public.xp_events, public.level_thresholds, public.pv_tasks, public.pv_claims, public.pv_ledger TO service_role;
ALTER TABLE public.xp_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.level_thresholds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pv_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pv_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pv_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "xp read" ON public.xp_events FOR SELECT TO authenticated USING (member_id = auth.uid() OR public.is_admin(auth.uid()) OR public.manages_member(auth.uid(), member_id));
CREATE POLICY "levels read" ON public.level_thresholds FOR SELECT TO authenticated USING (true);
CREATE POLICY "levels admin update" ON public.level_thresholds FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "tasks read" ON public.pv_tasks FOR SELECT TO authenticated USING (active OR public.is_admin(auth.uid()));
CREATE POLICY "tasks admin write" ON public.pv_tasks FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "claims read" ON public.pv_claims FOR SELECT TO authenticated USING (member_id = auth.uid() OR public.is_admin(auth.uid()) OR public.manages_member(auth.uid(), member_id));
CREATE POLICY "claims own insert" ON public.pv_claims FOR INSERT TO authenticated WITH CHECK (member_id = auth.uid() AND status = 'pending' AND reviewed_by IS NULL AND reviewed_at IS NULL AND EXISTS (SELECT 1 FROM public.pv_tasks t WHERE t.id = task_id AND t.active));
CREATE POLICY "ledger read" ON public.pv_ledger FOR SELECT TO authenticated USING (member_id = auth.uid() OR public.is_admin(auth.uid()) OR public.manages_member(auth.uid(), member_id));

CREATE OR REPLACE FUNCTION public.award_xp(_member uuid, _amount int, _source text, _ref text) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.xp_events (member_id, amount, source, source_ref) VALUES (_member, _amount, _source, _ref) ON CONFLICT DO NOTHING;
$$;
REVOKE EXECUTE ON FUNCTION public.award_xp(uuid, int, text, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.xp_on_workout() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.finished_at IS NULL AND NEW.finished_at IS NOT NULL AND EXISTS (SELECT 1 FROM public.set_logs WHERE session_id = NEW.id) THEN
    PERFORM public.award_xp(NEW.member_id, 50, 'workout', NEW.id::text);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER workout_xp AFTER UPDATE ON public.workout_sessions FOR EACH ROW EXECUTE FUNCTION public.xp_on_workout();

CREATE OR REPLACE FUNCTION public.xp_on_food() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN PERFORM public.award_xp(NEW.member_id, 10, 'nutrition_day', NEW.log_date::text); RETURN NEW; END $$;
CREATE TRIGGER food_xp AFTER INSERT ON public.food_logs FOR EACH ROW EXECUTE FUNCTION public.xp_on_food();

CREATE OR REPLACE FUNCTION public.xp_on_body() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN PERFORM public.award_xp(NEW.member_id, 10, 'body_check', NEW.measured_on::text); RETURN NEW; END $$;
CREATE TRIGGER body_xp AFTER INSERT ON public.body_measurements FOR EACH ROW EXECUTE FUNCTION public.xp_on_body();
REVOKE EXECUTE ON FUNCTION public.xp_on_workout(), public.xp_on_food(), public.xp_on_body() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.review_pv_claim(_claim uuid, _status text, _note text DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.pv_claims; pts int;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'not allowed'; END IF;
  IF _status NOT IN ('approved','rejected','needs_info') THEN RAISE EXCEPTION 'invalid status'; END IF;
  SELECT * INTO c FROM public.pv_claims WHERE id = _claim FOR UPDATE;
  IF c.id IS NULL THEN RAISE EXCEPTION 'claim not found'; END IF;
  IF c.member_id = auth.uid() THEN RAISE EXCEPTION 'cannot review your own claim'; END IF;
  IF c.status = 'approved' OR c.status = 'rejected' THEN RAISE EXCEPTION 'claim already decided'; END IF;
  UPDATE public.pv_claims SET status = _status, review_note = _note, reviewed_by = auth.uid(), reviewed_at = now() WHERE id = _claim;
  IF _status = 'approved' THEN
    SELECT points INTO pts FROM public.pv_tasks WHERE id = c.task_id;
    INSERT INTO public.pv_ledger (member_id, points, source, claim_id, approved_by) VALUES (c.member_id, pts, 'task_claim', c.id, auth.uid());
  END IF;
  INSERT INTO public.audit_log (actor_id, action, target_type, target_id, details) VALUES (auth.uid(), 'pv_claim_' || _status, 'pv_claims', _claim::text, jsonb_build_object('member', c.member_id, 'note', _note));
END $$;
REVOKE EXECUTE ON FUNCTION public.review_pv_claim(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_pv_claim(uuid, text, text) TO authenticated;