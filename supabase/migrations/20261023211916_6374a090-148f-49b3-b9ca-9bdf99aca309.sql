CREATE TABLE public.rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title_en text NOT NULL, title_ar text, description text,
  cost_pv integer NOT NULL CHECK (cost_pv > 0),
  stock integer CHECK (stock IS NULL OR stock >= 0),
  active boolean NOT NULL DEFAULT true,
  created_by uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.rewards TO authenticated;
GRANT ALL ON public.rewards TO service_role;
ALTER TABLE public.rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rewards read" ON public.rewards FOR SELECT TO authenticated USING (active OR private.is_admin(auth.uid()));
CREATE POLICY "rewards admin insert" ON public.rewards FOR INSERT TO authenticated WITH CHECK (private.is_admin(auth.uid()));
CREATE POLICY "rewards admin update" ON public.rewards FOR UPDATE TO authenticated USING (private.is_admin(auth.uid())) WITH CHECK (private.is_admin(auth.uid()));
CREATE TRIGGER rewards_updated BEFORE UPDATE ON public.rewards FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reward_id uuid NOT NULL REFERENCES public.rewards(id),
  member_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  cost_pv integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  review_note text, reviewed_by uuid, reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.redemptions(member_id);
CREATE INDEX ON public.redemptions(status);
GRANT SELECT, INSERT ON public.redemptions TO authenticated;
GRANT UPDATE (status, review_note) ON public.redemptions TO authenticated;
GRANT ALL ON public.redemptions TO service_role;
ALTER TABLE public.redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "redemptions read" ON public.redemptions FOR SELECT TO authenticated
  USING (member_id = auth.uid() OR private.is_admin(auth.uid()) OR private.manages_member(auth.uid(), member_id));
CREATE POLICY "redemptions own insert" ON public.redemptions FOR INSERT TO authenticated
  WITH CHECK (member_id = auth.uid() AND status = 'pending');
CREATE POLICY "redemptions active only" ON public.redemptions AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (private.is_active(auth.uid()));
CREATE POLICY "redemptions admin update" ON public.redemptions FOR UPDATE TO authenticated
  USING (private.is_admin(auth.uid())) WITH CHECK (private.is_admin(auth.uid()));

ALTER TABLE public.pv_ledger ADD COLUMN redemption_id uuid REFERENCES public.redemptions(id);

CREATE OR REPLACE FUNCTION public.redemption_before_insert() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.rewards; bal integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('pv:' || NEW.member_id::text));
  SELECT * INTO r FROM public.rewards WHERE id = NEW.reward_id FOR UPDATE;
  IF r.id IS NULL OR NOT r.active THEN RAISE EXCEPTION 'Reward not available'; END IF;
  IF r.stock IS NOT NULL AND r.stock <= 0 THEN RAISE EXCEPTION 'Out of stock'; END IF;
  SELECT coalesce(sum(points),0) INTO bal FROM public.pv_ledger WHERE member_id = NEW.member_id;
  IF bal < r.cost_pv THEN RAISE EXCEPTION 'Not enough PV Points'; END IF;
  NEW.cost_pv := r.cost_pv; NEW.status := 'pending';
  NEW.review_note := NULL; NEW.reviewed_by := NULL; NEW.reviewed_at := NULL;
  IF r.stock IS NOT NULL THEN UPDATE public.rewards SET stock = stock - 1 WHERE id = r.id; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER redemption_before_insert BEFORE INSERT ON public.redemptions FOR EACH ROW EXECUTE FUNCTION public.redemption_before_insert();

CREATE OR REPLACE FUNCTION public.redemption_after_insert() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.pv_ledger(member_id, points, source, redemption_id, approved_by)
  VALUES (NEW.member_id, -NEW.cost_pv, 'redemption', NEW.id, NEW.member_id);
  RETURN NEW;
END $$;
CREATE TRIGGER redemption_after_insert AFTER INSERT ON public.redemptions FOR EACH ROW EXECUTE FUNCTION public.redemption_after_insert();

CREATE OR REPLACE FUNCTION public.redemption_guard_review() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT private.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Admins only'; END IF;
  IF OLD.status <> 'pending' THEN RAISE EXCEPTION 'Already decided'; END IF;
  IF NEW.status NOT IN ('fulfilled','rejected') THEN RAISE EXCEPTION 'Invalid status'; END IF;
  NEW.reward_id := OLD.reward_id; NEW.member_id := OLD.member_id; NEW.cost_pv := OLD.cost_pv; NEW.created_at := OLD.created_at;
  NEW.reviewed_by := auth.uid(); NEW.reviewed_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER redemption_guard_review BEFORE UPDATE ON public.redemptions FOR EACH ROW EXECUTE FUNCTION public.redemption_guard_review();

CREATE OR REPLACE FUNCTION public.redemption_after_review() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'rejected' THEN
    INSERT INTO public.pv_ledger(member_id, points, source, redemption_id, approved_by)
    VALUES (NEW.member_id, NEW.cost_pv, 'refund', NEW.id, NEW.reviewed_by);
    UPDATE public.rewards SET stock = stock + 1 WHERE id = NEW.reward_id AND stock IS NOT NULL;
  END IF;
  INSERT INTO public.audit_log(actor_id, action, target_type, target_id, details)
  VALUES (NEW.reviewed_by, 'redemption_' || NEW.status, 'redemption', NEW.id::text,
          jsonb_build_object('member_id', NEW.member_id, 'cost_pv', NEW.cost_pv, 'note', NEW.review_note));
  RETURN NEW;
END $$;
CREATE TRIGGER redemption_after_review AFTER UPDATE ON public.redemptions FOR EACH ROW EXECUTE FUNCTION public.redemption_after_review();

REVOKE EXECUTE ON FUNCTION public.redemption_before_insert(), public.redemption_after_insert(), public.redemption_guard_review(), public.redemption_after_review() FROM PUBLIC, anon, authenticated;