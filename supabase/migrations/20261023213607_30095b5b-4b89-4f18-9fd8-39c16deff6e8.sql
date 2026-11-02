CREATE TABLE public.foods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_en text NOT NULL, name_ar text, serving text NOT NULL,
  calories integer NOT NULL, protein_g numeric NOT NULL DEFAULT 0, carbs_g numeric NOT NULL DEFAULT 0, fat_g numeric NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.foods TO authenticated;
GRANT ALL ON public.foods TO service_role;
ALTER TABLE public.foods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "foods read" ON public.foods FOR SELECT TO authenticated USING (active OR private.is_admin(auth.uid()));
CREATE POLICY "foods admin insert" ON public.foods FOR INSERT TO authenticated WITH CHECK (private.is_admin(auth.uid()));
CREATE POLICY "foods admin update" ON public.foods FOR UPDATE TO authenticated USING (private.is_admin(auth.uid())) WITH CHECK (private.is_admin(auth.uid()));
INSERT INTO public.foods(name_en,name_ar,serving,calories,protein_g,carbs_g,fat_g) VALUES
('Egg (whole)','بيضة','1 large',72,6.3,0.4,4.8),
('Ful medames','فول مدمس','1 cup (250g)',290,19,47,2.5),
('Taameya (falafel)','طعمية','3 pieces',200,7,18,11),
('Baladi bread','عيش بلدي','1 loaf (90g)',250,8,50,1.5),
('White rice, cooked','أرز أبيض مطبوخ','1 cup (160g)',205,4.3,45,0.4),
('Koshari','كشري','1 plate (400g)',650,20,115,12),
('Chicken breast, grilled','صدر دجاج مشوي','150g',248,46,0,5.4),
('Beef, lean, cooked','لحم بقري قليل الدهن','150g',320,40,0,17),
('Tuna, canned in water','تونة معلبة بالماء','1 can (120g)',130,29,0,1),
('Greek yogurt, plain','زبادي يوناني','170g',100,17,6,0.7),
('Milk, full fat','حليب كامل الدسم','1 cup (240ml)',150,8,12,8),
('Oats','شوفان','50g dry',190,6.5,33,3.4),
('Banana','موز','1 medium',105,1.3,27,0.4),
('Dates','تمر','3 pieces',200,1.5,54,0.2),
('Apple','تفاح','1 medium',95,0.5,25,0.3),
('Lentil soup','شوربة عدس','1 bowl (300ml)',230,14,36,3),
('Molokhia','ملوخية','1 bowl (250g)',120,5,10,7),
('White cheese (gibna beda)','جبنة بيضاء','50g',130,7,1,11),
('Peanut butter','زبدة الفول السوداني','2 tbsp',190,7,7,16),
('Whey protein','واي بروتين','1 scoop (30g)',120,24,3,1.5),
('Olive oil','زيت زيتون','1 tbsp',120,0,0,14),
('Sweet potato, baked','بطاطا مشوية','1 medium (150g)',135,3,31,0.2);