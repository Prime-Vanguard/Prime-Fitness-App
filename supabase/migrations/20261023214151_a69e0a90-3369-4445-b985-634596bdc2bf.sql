CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind text NOT NULL,
  title_en text NOT NULL, title_ar text NOT NULL,
  link text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.notifications(member_id, created_at DESC);
GRANT SELECT ON public.notifications TO authenticated;
GRANT UPDATE (read_at) ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notifications own read" ON public.notifications FOR SELECT TO authenticated USING (member_id = auth.uid());
CREATE POLICY "notifications own mark read" ON public.notifications FOR UPDATE TO authenticated USING (member_id = auth.uid()) WITH CHECK (member_id = auth.uid());

CREATE OR REPLACE FUNCTION public.notify(_member uuid, _kind text, _en text, _ar text, _link text) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.notifications(member_id, kind, title_en, title_ar, link) VALUES (_member, _kind, _en, _ar, _link);
$$;

CREATE OR REPLACE FUNCTION public.notify_on_program() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n text;
BEGIN
  IF NEW.active AND (TG_OP = 'INSERT' OR NOT OLD.active) THEN
    SELECT name INTO n FROM public.programs WHERE id = NEW.program_id;
    PERFORM public.notify(NEW.member_id, 'program', 'New program assigned: ' || n, 'تم تعيين برنامج جديد: ' || n, '/train');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER notify_on_program AFTER INSERT OR UPDATE ON public.program_assignments FOR EACH ROW EXECUTE FUNCTION public.notify_on_program();

CREATE OR REPLACE FUNCTION public.notify_on_claim() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE tt text;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    SELECT title_en INTO tt FROM public.pv_tasks WHERE id = NEW.task_id;
    PERFORM public.notify(NEW.member_id, 'pv_' || NEW.status,
      CASE NEW.status WHEN 'approved' THEN 'PV claim approved: ' WHEN 'rejected' THEN 'PV claim rejected: ' ELSE 'More info needed for: ' END || tt,
      CASE NEW.status WHEN 'approved' THEN 'تم اعتماد طلب PV: ' WHEN 'rejected' THEN 'تم رفض طلب PV: ' ELSE 'مطلوب معلومات إضافية لـ: ' END || tt,
      '/rewards');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER notify_on_claim AFTER UPDATE ON public.pv_claims FOR EACH ROW EXECUTE FUNCTION public.notify_on_claim();

CREATE OR REPLACE FUNCTION public.notify_on_redemption() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE tt text;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    SELECT title_en INTO tt FROM public.rewards WHERE id = NEW.reward_id;
    PERFORM public.notify(NEW.member_id, 'redemption_' || NEW.status,
      CASE NEW.status WHEN 'fulfilled' THEN 'Reward delivered: ' ELSE 'Reward request rejected (PV refunded): ' END || tt,
      CASE NEW.status WHEN 'fulfilled' THEN 'تم تسليم المكافأة: ' ELSE 'تم رفض طلب المكافأة (أُعيدت النقاط): ' END || tt,
      '/rewards');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER notify_on_redemption AFTER UPDATE ON public.redemptions FOR EACH ROW EXECUTE FUNCTION public.notify_on_redemption();

CREATE OR REPLACE FUNCTION public.notify_on_badge() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b public.badges;
BEGIN
  SELECT * INTO b FROM public.badges WHERE code = NEW.badge_code;
  PERFORM public.notify(NEW.member_id, 'badge', 'Badge unlocked: ' || b.title_en, 'وسام جديد: ' || b.title_ar, '/rewards');
  RETURN NEW;
END $$;
CREATE TRIGGER notify_on_badge AFTER INSERT ON public.member_badges FOR EACH ROW EXECUTE FUNCTION public.notify_on_badge();

REVOKE EXECUTE ON FUNCTION public.notify(uuid,text,text,text,text), public.notify_on_program(), public.notify_on_claim(), public.notify_on_redemption(), public.notify_on_badge() FROM PUBLIC, anon, authenticated;