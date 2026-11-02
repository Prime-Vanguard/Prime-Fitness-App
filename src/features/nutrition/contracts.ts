import type { FormEvent } from "react";
import type { MealItem } from "@/lib/nutrition-tools";
import type { FoodEntry } from "@/lib/nutrition-entries";
export type NutritionSearch = {
  day?: string | undefined;
  entry?: "search" | "recent" | "favorites" | "quick" | undefined;
  meal?: string | undefined;
};

export type FoodEntryMode = NonNullable<NutritionSearch["entry"]>;
export const MEALS = ["breakfast", "lunch", "dinner", "snack"] as const;
export type FoodDraft = {
  portion: string;
  serving: string;
  meal: string;
  name: string;
  calories: string;
  protein_g: string;
  carbs_g: string;
  fat_g: string;
};
export type FoodPick = {
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  serving?: string;
};

export type NutritionEntryModel = {
  f: FoodDraft;
  editing: { record: FoodEntry } | null;
  adding: boolean;
  entryError: string;
  selectedMeal: string;
  portionTotals: MealItem | undefined;
  updateDraft: (patch: Partial<FoodDraft>) => void;
  changeMeal: (meal: string) => void;
  closeEntry: () => void;
  choose: (food: FoodPick) => void;
  copyYesterday: () => Promise<void>;
  add: (event: FormEvent) => Promise<void>;
  onLogged: () => void;
};
