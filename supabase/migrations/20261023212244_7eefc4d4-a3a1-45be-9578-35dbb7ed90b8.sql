CREATE TABLE public.badges (
  code text PRIMARY KEY, title_en text NOT NULL, title_ar text NOT NULL,
  description_en text, description_ar text, xp_bonus integer NOT NULL DEFAULT 0, position integer NOT NULL DEFAULT 0
);
GRANT SELECT ON public.badges TO authenticated;
GRANT ALL ON public.badges TO service_role;
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "badges read" ON public.badges FOR SELECT TO authenticated USING (true);

CREATE TABLE public.member_badges (
  member_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  badge_code text NOT NULL REFERENCES public.badges(code),
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (member_id, badge_code)
);
GRANT SELECT ON public.member_badges TO authenticated;
GRANT ALL ON public.member_badges TO service_role;
ALTER TABLE public.member_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "member badges read" ON public.member_badges FOR SELECT TO authenticated
  USING (member_id = auth.uid() OR private.is_admin(auth.uid()) OR private.manages_member(auth.uid(), member_id));

INSERT INTO public.badges(code,title_en,title_ar,description_en,description_ar,xp_bonus,position) VALUES
('first_workout','First Rep','أول تكرار','Finish your first workout','أنهِ تمرينك الأول',25,1),
('workouts_10','Committed','ملتزم','Finish 10 workouts','أنهِ 10 تمارين',50,2),
('workouts_50','Forged in Iron','مصقول بالحديد','Finish 50 workouts','أنهِ 50 تمرينًا',150,3),
('workouts_100','Centurion','المئوي','Finish 100 workouts','أنهِ 100 تمرين',300,4),
('first_food','Fuel Aware','واعٍ بوقوده','Log food for the first time','سجّل طعامك لأول مرة',10,5),
('food_30','Nutrition Discipline','انضباط غذائي','Log food on 30 different days','سجّل طعامك في 30 يومًا مختلفًا',100,6),
('first_body','Baseline Set','نقطة البداية','Record your first body check','سجّل أول قياس للجسم',10,7),
('first_pv','Vanguard Contributor','مساهم الطليعة','Get your first PV task approved','احصل على اعتماد أول مهمة PV',25,8);

CREATE OR REPLACE FUNCTION public.grant_badge(_member uuid, _code text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE bonus integer; n integer;
BEGIN
  INSERT INTO public.member_badges(member_id, badge_code) VALUES (_member, _code) ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n > 0 THEN
    SELECT xp_bonus INTO bonus FROM public.badges WHERE code = _code;
    IF coalesce(bonus,0) > 0 THEN PERFORM public.award_xp(_member, bonus, 'badge', _code); END IF;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.badges_on_workout() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c integer;
BEGIN
  IF OLD.finished_at IS NULL AND NEW.finished_at IS NOT NULL THEN
    SELECT count(*) INTO c FROM public.workout_sessions s WHERE s.member_id = NEW.member_id AND s.finished_at IS NOT NULL
      AND EXISTS (SELECT 1 FROM public.set_logs l WHERE l.session_id = s.id);
    IF c >= 1 THEN PERFORM public.grant_badge(NEW.member_id,'first_workout'); END IF;
    IF c >= 10 THEN PERFORM public.grant_badge(NEW.member_id,'workouts_10'); END IF;
    IF c >= 50 THEN PERFORM public.grant_badge(NEW.member_id,'workouts_50'); END IF;
    IF c >= 100 THEN PERFORM public.grant_badge(NEW.member_id,'workouts_100'); END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER badges_on_workout AFTER UPDATE ON public.workout_sessions FOR EACH ROW EXECUTE FUNCTION public.badges_on_workout();

CREATE OR REPLACE FUNCTION public.badges_on_food() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d integer;
BEGIN
  PERFORM public.grant_badge(NEW.member_id,'first_food');
  SELECT count(DISTINCT log_date) INTO d FROM public.food_logs WHERE member_id = NEW.member_id;
  IF d >= 30 THEN PERFORM public.grant_badge(NEW.member_id,'food_30'); END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER badges_on_food AFTER INSERT ON public.food_logs FOR EACH ROW EXECUTE FUNCTION public.badges_on_food();

CREATE OR REPLACE FUNCTION public.badges_on_body() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN PERFORM public.grant_badge(NEW.member_id,'first_body'); RETURN NEW; END $$;
CREATE TRIGGER badges_on_body AFTER INSERT ON public.body_measurements FOR EACH ROW EXECUTE FUNCTION public.badges_on_body();

CREATE OR REPLACE FUNCTION public.badges_on_pv() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN IF NEW.claim_id IS NOT NULL AND NEW.points > 0 THEN PERFORM public.grant_badge(NEW.member_id,'first_pv'); END IF; RETURN NEW; END $$;
CREATE TRIGGER badges_on_pv AFTER INSERT ON public.pv_ledger FOR EACH ROW EXECUTE FUNCTION public.badges_on_pv();

REVOKE EXECUTE ON FUNCTION public.grant_badge(uuid,text), public.badges_on_workout(), public.badges_on_food(), public.badges_on_body(), public.badges_on_pv() FROM PUBLIC, anon, authenticated;