import { z } from "zod";
import { mealItem, type MealItem } from "./nutrition-tools";
import { validActivityDate } from "./training-search";
import { entryRecovery, type EntryUndo } from "./entry-recovery";
export type FoodEntry = MealItem & {
  id: string;
  member_id: string;
  log_date: string;
  meal: "breakfast" | "lunch" | "dinner" | "snack";
  revision: number;
};
const undoSchema = z.object({
  record: z.object({
    id: z.string().uuid(),
    member_id: z.string().uuid(),
    log_date: z.string().refine(validActivityDate),
    meal: z.enum(["breakfast", "lunch", "dinner", "snack"]),
    name: z.string(),
    calories: z.number(),
    protein_g: z.number(),
    carbs_g: z.number(),
    fat_g: z.number(),
    revision: z.number().int().nonnegative(),
  }),
});
export type FoodUndo = EntryUndo<FoodEntry>;
export function foodEntry(row: Record<string, unknown>, user: string): FoodEntry {
  if (
    row["member_id"] !== user ||
    !validActivityDate(row["log_date"]) ||
    !["breakfast", "lunch", "dinner", "snack"].includes(String(row["meal"])) ||
    typeof row["id"] !== "string" ||
    !Number.isSafeInteger(row["revision"]) ||
    Number(row["revision"]) < 0
  )
    throw new Error("Refresh this entry before changing it.");
  const macros = mealItem(row as Parameters<typeof mealItem>[0]);
  return undoSchema.shape.record.parse({
    ...macros,
    id: row["id"],
    member_id: user,
    log_date: row["log_date"],
    meal: String(row["meal"]),
    revision: Number(row["revision"]),
  });
}
const recovery = entryRecovery<FoodEntry>("food_logs", "nutritionUndo", foodEntry, (row) => ({
  ...mealItem(row),
  meal: row.meal,
  log_date: row.log_date,
}));
export const foodUndoEntries = recovery.entries,
  mergeFoodRecovery = recovery.merge,
  dismissFoodUndo = recovery.dismiss,
  deleteFoodEntry = recovery.del,
  finishFoodDeletion = recovery.finish,
  restoreFoodEntry = recovery.restore,
  foodEditAllowsMissing = recovery.allowsMissing;
export function saveFoodEdit(
  user: string,
  original: FoodEntry,
  macros: MealItem,
  meal: string,
  queued: boolean,
  allowMissing: boolean,
) {
  return recovery.edit(
    user,
    original,
    foodEntry({ ...original, ...macros, meal }, user),
    queued,
    allowMissing,
  );
}
