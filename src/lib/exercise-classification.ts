const labels: Record<string, readonly [string, string]> = {
  chest: ["Chest", "الصدر"],
  back: ["Back", "الظهر"],
  shoulders: ["Shoulders", "الأكتاف"],
  biceps: ["Biceps", "البايسبس"],
  triceps: ["Triceps", "الترايسبس"],
  core: ["Core", "الجذع"],
  quads: ["Quads", "الفخذ الأمامي"],
  hamstrings: ["Hamstrings", "الفخذ الخلفي"],
  glutes: ["Glutes", "الأرداف"],
  calves: ["Calves", "السمانة"],
  forearms: ["Forearms", "الساعدان"],
  full_body: ["Full body", "الجسم بالكامل"],
  barbell: ["Barbell", "بار"],
  dumbbell: ["Dumbbell", "دمبل"],
  cable: ["Cable", "كابل"],
  machine: ["Machine", "جهاز"],
  bodyweight: ["Bodyweight", "وزن الجسم"],
  kettlebell: ["Kettlebell", "كيتل بيل"],
  band: ["Band", "حبل مقاومة"],
  smith_machine: ["Smith machine", "جهاز سميث"],
};
export const exerciseClassification = (value: string, locale: "en" | "ar") =>
  labels[value]?.[locale === "ar" ? 1 : 0] ?? value;
