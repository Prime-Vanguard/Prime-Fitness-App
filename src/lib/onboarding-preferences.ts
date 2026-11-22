import { z } from "zod";

// Preferences inform a coach; they never rewrite a program or award XP.
export const trainingPreferenceSchema = z
  .object({
    goals: z.array(z.enum(["hypertrophy", "strength", "conditioning", "recomposition"])).max(4),
    experience: z.enum(["novice", "intermediate", "advanced"]).nullable(),
    weekly_days: z.number().int().min(1).max(7).nullable(),
    equipment: z.array(z.enum(["full_gym", "barbell", "dumbbells", "bodyweight"])).max(4),
  })
  .strict()
  .refine(
    (p) =>
      new Set(p.goals).size === p.goals.length && new Set(p.equipment).size === p.equipment.length,
  );
export type TrainingPreferences = z.infer<typeof trainingPreferenceSchema>;
export const emptyTrainingPreferences = (): TrainingPreferences => ({
  goals: [],
  experience: null,
  weekly_days: null,
  equipment: [],
});
export function parseTrainingPreferences(value: unknown): TrainingPreferences {
  const parsed = trainingPreferenceSchema.parse(value);
  // Stable set ordering also makes uncertain-save receipt comparison reliable.
  return { ...parsed, goals: [...parsed.goals].sort(), equipment: [...parsed.equipment].sort() };
}
export const trainingPreferenceLabels = {
  hypertrophy: ["Muscle growth", "بناء العضلات"],
  strength: ["Strength", "القوة"],
  conditioning: ["Conditioning", "اللياقة"],
  recomposition: ["Body recomposition", "تحسين تكوين الجسم"],
  novice: ["Novice (0–1 year)", "مبتدئ (0–1 سنة)"],
  intermediate: ["Intermediate (1–3 years)", "متوسط (1–3 سنوات)"],
  advanced: ["Advanced (3+ years)", "متقدم (3 سنوات فأكثر)"],
  full_gym: ["Full gym", "نادٍ متكامل"],
  barbell: ["Barbell & rack", "بار وحامل"],
  dumbbells: ["Dumbbells", "دمبل"],
  bodyweight: ["Bodyweight", "وزن الجسم"],
} as const;
