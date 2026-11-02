import type { NutritionEntryModel } from "./contracts";
import { useRef, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { scaleMealItem, type MealItem } from "@/lib/nutrition-tools";
import {
  foodEntry,
  foodEditAllowsMissing,
  saveFoodEdit,
  deleteFoodEntry,
  restoreFoodEntry,
  dismissFoodUndo,
  finishFoodDeletion,
  type FoodEntry,
  type FoodUndo,
} from "@/lib/nutrition-entries";
import { supabase } from "@/integrations/supabase/client";
import { queueMemberWrites, syncMemberEntries, type MemberRecord } from "@/lib/member-store";
import { addDays } from "@/lib/dates";
import { haptic, primeAudio, waterSound } from "@/lib/device-feedback";
import type { FoodDraft, FoodPick, NutritionSearch } from "./contracts";

/** Owns form drafts and serialized writes; storage protocols remain in domain services. */
export function useNutritionWorkflow({
  userId,
  day,
  search,
  offline,
  localFood,
  refresh,
  navigate,
}: {
  userId: string;
  day: string;
  search: NutritionSearch;
  offline: boolean;
  localFood: MemberRecord[];
  refresh: () => Promise<unknown>;
  navigate: (options: { search: NutritionSearch; replace?: boolean }) => unknown;
}) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [waterPulse, setWaterPulse] = useState(0);
  const [adding, setAdding] = useState(false);
  const mutationLock = useRef(false);
  const [editing, setEditing] = useState<{ record: FoodEntry; allowMissing: boolean } | null>(null);
  const savedAddDraft = useRef<FoodDraft | null>(null);
  const savedAddError = useRef("");
  const [mutationError, setMutationError] = useState("");
  const openEntry = (
    entry: NonNullable<NutritionSearch["entry"]>,
    meal = search.meal ?? f.meal,
  ) => {
    if (mutationLock.current) return;
    setEditing(null);
    if (editing) setEntryError(savedAddError.current);
    setF((current) => ({
      ...(editing && savedAddDraft.current ? savedAddDraft.current : current),
      meal,
    }));
    void navigate({ search: { ...search, entry, meal } });
  };
  const closeEntry = () => {
    if (editing && savedAddDraft.current) {
      setF(savedAddDraft.current);
      setEntryError(savedAddError.current);
    }
    setEditing(null);
    void navigate({ search: { ...search, entry: undefined }, replace: true });
  };
  const [entryError, setEntryError] = useState("");
  const [f, setF] = useState<FoodDraft>({
    portion: "1",
    serving: "",
    meal: search.meal ?? "breakfast",
    name: "",
    calories: "",
    protein_g: "",
    carbs_g: "",
    fat_g: "",
  });
  const selectedMeal = search.meal ?? f.meal;
  let portionTotals: MealItem | undefined;
  try {
    portionTotals = scaleMealItem(f, f.portion);
  } catch {
    /* Keep incomplete inputs visible until submission. */
  }
  async function writeLocal(
    writes: { entity: "food_logs" | "water_logs"; op: "put" | "delete"; record: MemberRecord }[],
  ) {
    try {
      await queueMemberWrites(userId, writes);
      void syncMemberEntries(userId).catch(() => {});
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  }
  function choose(x: FoodPick) {
    setF({
      ...f,
      portion: "1",
      serving: x.serving ?? "",
      name: x.name,
      calories: String(x.calories),
      protein_g: String(Number(x.protein_g)),
      carbs_g: String(Number(x.carbs_g)),
      fat_g: String(Number(x.fat_g)),
    });
    void navigate({ search: { ...search, entry: "quick" }, replace: true });
  }
  async function copyYesterday() {
    const y = addDays(day, -1);
    const { data: rows, error } =
      offline && !navigator.onLine
        ? {
            data: localFood.filter((r) => r.log_date === y) as FoodEntry[],
            error: null,
          }
        : await supabase
            .from("food_logs")
            .select("meal,name,calories,protein_g,carbs_g,fat_g")
            .eq("member_id", userId)
            .eq("log_date", y);
    if (error) return void toast.error(error.message);
    if (!rows.length) return void toast.error(t("nothingYesterday"));
    const ins = offline
      ? await writeLocal(
          rows.map((r) => ({
            entity: "food_logs",
            op: "put",
            record: { ...r, id: crypto.randomUUID(), log_date: day },
          })),
        )
      : await supabase
          .from("food_logs")
          .insert(rows.map((r) => ({ ...r, member_id: userId, log_date: day })));
    if (ins.error) return void toast.error(ins.error.message);
    toast.success(t("saved"));
    refresh();
  }
  async function entryAction(action: () => Promise<void>) {
    if (mutationLock.current) return;
    mutationLock.current = true;
    setAdding(true);
    setMutationError("");
    try {
      await action();
      void refresh();
      void qc.invalidateQueries({ queryKey: ["food-lib", userId] });
    } catch (error) {
      setMutationError(
        error instanceof Error
          ? error.message
          : String((error as { message?: string }).message ?? error),
      );
    } finally {
      mutationLock.current = false;
      setAdding(false);
    }
  }
  async function beginEdit(row: Record<string, unknown>) {
    if (mutationLock.current) return;
    try {
      const record = foodEntry(row, userId),
        allowMissing = await foodEditAllowsMissing(userId, record.id);
      savedAddDraft.current = f;
      savedAddError.current = entryError;
      setEditing({ record, allowMissing });
      setEntryError("");
      setF({
        portion: "1",
        serving: "",
        meal: record.meal,
        name: record.name,
        calories: String(record.calories),
        protein_g: String(record.protein_g),
        carbs_g: String(record.carbs_g),
        fat_g: String(record.fat_g),
      });
      void navigate({ search: { ...search, entry: "quick", meal: record.meal } });
    } catch (error) {
      setMutationError((error as Error).message);
    }
  }

  async function add(e: FormEvent) {
    e.preventDefault();
    if (mutationLock.current) return;
    setEntryError("");
    let item;
    try {
      item = scaleMealItem(f, f.portion);
    } catch (error) {
      return void setEntryError((error as Error).message);
    }
    setAdding(true);
    mutationLock.current = true;
    try {
      if (editing) {
        await saveFoodEdit(
          userId,
          editing.record,
          item,
          selectedMeal,
          offline === true,
          editing.allowMissing,
        );
        if (offline) void syncMemberEntries(userId).catch(() => {});
        void refresh();
        closeEntry();
        return;
      }
      const { error } = offline
        ? await writeLocal([
            {
              entity: "food_logs",
              op: "put",
              record: { ...item, id: crypto.randomUUID(), log_date: day, meal: selectedMeal },
            },
          ])
        : await supabase
            .from("food_logs")
            .insert({ ...item, member_id: userId, log_date: day, meal: selectedMeal });
      if (error) return void setEntryError(error.message);
      setF({
        ...f,
        portion: "1",
        serving: "",
        name: "",
        calories: "",
        protein_g: "",
        carbs_g: "",
        fat_g: "",
      });
      refresh();
      qc.invalidateQueries({ queryKey: ["food-lib", userId] });
      closeEntry();
    } catch (error) {
      setEntryError(
        error instanceof Error
          ? error.message
          : String((error as { message?: string }).message ?? error),
      );
    } finally {
      mutationLock.current = false;
      setAdding(false);
    }
  }
  async function del(row: Record<string, unknown>) {
    await entryAction(async () => {
      const record = foodEntry(row, userId);
      await deleteFoodEntry(
        userId,
        record,
        offline === true,
        await foodEditAllowsMissing(userId, record.id),
      );
      if (offline) void syncMemberEntries(userId).catch(() => {});
    });
  }
  async function addWater(ml: number) {
    if (mutationLock.current) return;
    mutationLock.current = true;
    setAdding(true);
    primeAudio();
    try {
      const { error } = offline
        ? await writeLocal([
            {
              entity: "water_logs",
              op: "put",
              record: { id: crypto.randomUUID(), log_date: day, ml },
            },
          ])
        : await supabase.from("water_logs").insert({ member_id: userId, log_date: day, ml });
      if (error) return void toast.error(error.message);
      setWaterPulse((n) => n + 1);
      haptic();
      waterSound();
      refresh();
    } catch (error) {
      setMutationError((error as { message?: string }).message ?? "Could not log water.");
    } finally {
      mutationLock.current = false;
      setAdding(false);
    }
  }

  function onLogged() {
    closeEntry();
    void refresh();
    void qc.invalidateQueries({ queryKey: ["food-lib", userId] });
  }
  const updateDraft = (patch: Partial<FoodDraft>) => setF((current) => ({ ...current, ...patch }));
  const finishDeletion = (undo: FoodUndo) => entryAction(() => finishFoodDeletion(userId, undo));
  const restore = (undo: FoodUndo) =>
    entryAction(async () => {
      await restoreFoodEntry(userId, undo);
      if (undo.mode === "queued") void syncMemberEntries(userId).catch(() => {});
    });
  const dismiss = (undo: FoodUndo) => entryAction(() => dismissFoodUndo(userId, undo.token));
  function changeMeal(meal: string) {
    updateDraft({ meal });
    void navigate({ search: { ...search, meal }, replace: true });
  }
  const entry: NutritionEntryModel = {
    adding,
    editing,
    entryError,
    f,
    selectedMeal,
    portionTotals,
    updateDraft,
    changeMeal,
    closeEntry,
    choose,
    copyYesterday,
    add,
    onLogged,
  };
  return {
    entry,
    waterPulse,
    adding,
    mutationError,
    openEntry,
    beginEdit,
    del,
    addWater,
    finishDeletion,
    restore,
    dismiss,
  };
}
