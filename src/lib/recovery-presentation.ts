import type { MemberEntity, MemberMutation, MemberRecord } from "./member-store";
export function entityLabel(entity: MemberEntity, ar: boolean) {
  return {
    food_logs: ["Food entries", "سجلات الطعام"],
    water_logs: ["Water entries", "سجلات الماء"],
    body_measurements: ["Measurements", "القياسات"],
    wellness_checkins: ["Wellness check-ins", "الحالة اليومية"],
    saved_meals: ["Meal favorites", "الوجبات المفضلة"],
  }[entity][ar ? 1 : 0]!;
}
const labels: Record<string, [string, string]> = {
  name: ["Name", "الاسم"],
  meal: ["Meal", "الوجبة"],
  meal_type: ["Meal", "الوجبة"],
  log_date: ["Activity date", "تاريخ السجل"],
  measured_on: ["Measurement date", "تاريخ القياس"],
  date: ["Date", "التاريخ"],
  calories: ["Calories (kcal)", "السعرات"],
  protein_g: ["Protein (g)", "البروتين (جم)"],
  carbs_g: ["Carbohydrates (g)", "الكربوهيدرات (جم)"],
  fat_g: ["Fat (g)", "الدهون (جم)"],
  ml: ["Water (ml)", "الماء (مل)"],
  weight_kg: ["Weight (kg)", "الوزن (كجم)"],
  waist_cm: ["Waist (cm)", "الخصر (سم)"],
  body_fat_pct: ["Body fat (%)", "دهون الجسم (%)"],
  sleep_hours: ["Sleep (hours)", "النوم (ساعات)"],
  energy: ["Energy (1–5)", "الطاقة (١–٥)"],
  soreness: ["Soreness (1–5)", "الإجهاد العضلي (١–٥)"],
  notes: ["Notes", "الملاحظات"],
  ingredients: ["Ingredients", "المكونات"],
  items: ["Meal ingredients", "مكونات الوجبة"],
  kind: ["Meal type", "نوع الوجبة"],
  quantity: ["Quantity", "الكمية"],
  grams: ["Grams", "جرامات"],
};
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
      .join(",")}}`;
  return JSON.stringify(value ?? null);
}
export function conflictFields(
  local: MemberRecord,
  server: MemberRecord | null | undefined,
  ar: boolean,
) {
  return Object.entries(labels)
    .filter(([key]) => Object.hasOwn(local, key) || (!!server && Object.hasOwn(server, key)))
    .map(([key, label]) => ({
      key,
      label: label[ar ? 1 : 0],
      local: local[key],
      server: server?.[key],
      changed: canonical(local[key]) !== canonical(server?.[key]),
    }));
}
export function mutationSummary(queue: MemberMutation[]) {
  return {
    queued: queue.filter((m) => m.status === "queued").length,
    sending: queue.filter((m) => m.status === "sending").length,
    conflict: queue.filter((m) => m.status === "conflict").length,
    rejected: queue.filter((m) => m.status === "rejected").length,
  };
}
