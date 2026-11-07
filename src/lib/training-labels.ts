const labels: Record<string, [string, string]> = {
  food_scanning: ["Food scanning", "مسح الطعام"],
  cardio: ["Cardio and HIIT", "الكارديو وHIIT"],
  social: ["Friends and challenges", "الأصدقاء والتحديات"],
  weighted_reps: ["Weighted repetitions", "تكرارات بأوزان"],
  bodyweight_reps: ["Bodyweight repetitions", "تكرارات بوزن الجسم"],
  timed: ["Timed hold", "ثبات بالوقت"],
  external_total: ["Total external weight", "إجمالي الحمل الخارجي"],
  per_hand: ["Weight per dumbbell / hand", "الوزن لكل دمبل / يد"],
  bodyweight: ["Bodyweight; added load only", "وزن الجسم؛ الحمل الإضافي فقط"],
  working: ["Working set", "مجموعة عمل"],
  warmup: ["Warm-up", "إحماء"],
  drop: ["Drop segment", "جزء دروب"],
  bilateral: ["Both sides", "الجانبان"],
  left: ["Left", "يسار"],
  right: ["Right", "يمين"],
  scheduled: ["Scheduled", "مجدولة"],
  in_progress: ["In progress", "قيد التنفيذ"],
  completed: ["Completed", "مكتملة"],
  cancelled: ["Cancelled", "ملغاة"],
  guidance: ["Exercise guidance", "شرح التمارين"],
  logging: ["Advanced logging", "التسجيل المتقدم"],
  progression: ["Training progression", "تدرج التدريب"],
  scheduling: ["Scheduling", "جدولة التدريب"],
  imports: ["History imports", "استيراد السجل"],
  offline: ["Offline logs and check-ins", "السجلات والمتابعة دون اتصال"],
};
export const trainingLabel = (value: string, locale: "en" | "ar") =>
  labels[value]?.[locale === "ar" ? 1 : 0] ?? value;
const reasons: Record<string, string> = {
  "No comparable baseline for this measurement convention. Record an initial working performance.":
    "لا توجد مقارنة سابقة بنفس طريقة القياس. سجّل أداءً أولياً لمجموعة عمل.",
  "Coach has not enabled progression.": "لم يفعّل المدرب التدرج.",
  "Record an initial working performance; no load is invented.":
    "سجّل أداءً أولياً لمجموعة عمل؛ لن نفترض وزناً.",
  "A unilateral pair is incomplete.": "مجموعة الجانب الواحد غير مكتملة.",
  "Complete both sides of every prescribed working set.": "أكمل الجانبين لكل مجموعة عمل مقررة.",
  "Complete every prescribed working set.": "أكمل جميع مجموعات العمل المقررة.",
  "Hold: an effort rating is missing.": "ثبّت الهدف: يوجد تقييم جهد مفقود.",
  "Hold: effort exceeded the coach's RPE ceiling.": "ثبّت الهدف: تجاوز الجهد حد المدرب.",
  "Mixed working loads require coach review.": "اختلاف أوزان العمل يتطلب مراجعة المدرب.",
  "Hold: a duration target was missed.": "ثبّت الهدف: لم تكتمل مدة إحدى المجموعات.",
  "Coach's upper duration limit reached.": "وصلت إلى الحد الأعلى للمدة الذي حدده المدرب.",
  "Every working hold reached its target within the effort ceiling.":
    "اكتملت كل مدد الثبات ضمن حد الجهد.",
  "Hold: a rep target was missed.": "ثبّت الهدف: لم تكتمل تكرارات إحدى المجموعات.",
  "Enter an initial load before increasing it.": "أدخل وزناً أولياً قبل زيادته.",
  "Coach's upper load limit reached.": "وصلت إلى الحد الأعلى للوزن الذي حدده المدرب.",
  "Every working set reached the top of the rep range within the effort ceiling.":
    "بلغت كل مجموعة عمل أعلى نطاق التكرارات ضمن حد الجهد.",
  "Keep the load and add one rep toward the top of the range.":
    "ثبّت الوزن وأضف تكراراً نحو الحد الأعلى للنطاق.",
};
export const trainingReason = (value: string, locale: "en" | "ar") =>
  locale === "ar" ? (reasons[value] ?? value) : value;
