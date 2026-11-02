import { z } from "zod";
export const versionItemSchema = z.object({
  id: z.string().uuid(),
  exercise_id: z.string().uuid(),
  week: z.number().int().min(1).max(52),
  day: z.number().int().min(1).max(7),
  target_sets: z.number().int().min(1).max(100),
  target_reps: z.string().min(1).max(64),
  position: z.number().int(),
  name_en: z.string(),
  name_ar: z.string().nullable(),
  muscle: z.string(),
  equipment: z.string().nullable(),
  logging_mode: z.enum(["weighted_reps", "bodyweight_reps", "timed"]).optional(),
  load_convention: z.enum(["external_total", "per_hand", "bodyweight"]).optional(),
});
export type VersionItem = z.infer<typeof versionItemSchema>;
export const parseVersionItems = (value: unknown): VersionItem[] =>
  z.array(versionItemSchema).parse(value);
