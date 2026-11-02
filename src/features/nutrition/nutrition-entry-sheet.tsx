import { useState } from "react";
import { Copy, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { SavedMeals } from "@/components/saved-meals";
import { useI18n, type TKey } from "@/lib/i18n";
import type { MealItem } from "@/lib/nutrition-tools";
import { MEALS, type NutritionEntryModel, type FoodPick, type FoodEntryMode } from "./contracts";
import { useFoodLibrary } from "./use-food-library";

/** Entry presentation uses explicit data/actions, with no route or mutation controller. */
export function NutritionEntrySheet({
  userId,
  day,
  mode,
  food,
  model,
  onMode,
}: {
  userId: string;
  day: string;
  mode: FoodEntryMode | undefined;
  food: (MealItem & { meal: string })[];
  model: NutritionEntryModel;
  onMode: (mode: FoodEntryMode) => void;
}) {
  const { t, locale } = useI18n();
  const [q, setQ] = useState("");
  const { lib, libraryPending, libraryError, retryLibrary } = useFoodLibrary(userId, mode);
  const {
    f,
    editing,
    adding,
    entryError,
    selectedMeal,
    portionTotals,
    updateDraft,
    changeMeal,
    closeEntry,
    choose: chooseFood,
    copyYesterday,
    add,
    onLogged,
  } = model;
  function choose(food: FoodPick) {
    setQ("");
    chooseFood(food);
  }
  const ql = q.trim().toLowerCase();
  const matches = ql
    ? (lib?.foods ?? [])
        .filter((x) => x.name_en.toLowerCase().includes(ql) || (x.name_ar ?? "").includes(q.trim()))
        .slice(0, 8)
    : [];
  return (
    <Sheet
      open={!!mode}
      onOpenChange={(open) => {
        if (!open && !adding) closeEntry();
      }}
    >
      <SheetContent
        side={locale === "ar" ? "left" : "right"}
        className="w-full overflow-y-auto sm:max-w-lg"
        dir={locale === "ar" ? "rtl" : "ltr"}
      >
        <SheetHeader className="pe-10">
          <SheetTitle>
            {editing ? (locale === "ar" ? "تعديل الطعام" : "Edit food") : t("addFood")}
          </SheetTitle>
          <SheetDescription>
            {editing?.record.log_date ?? day} · {t(selectedMeal as TKey)}
          </SheetDescription>
        </SheetHeader>
        <nav
          className="mt-4 grid grid-cols-2 gap-2"
          aria-label={locale === "ar" ? "طرق إضافة الطعام" : "Food entry methods"}
        >
          {(
            [
              ["search", locale === "ar" ? "بحث" : "Search"],
              ["recent", locale === "ar" ? "الأخيرة" : "Recent"],
              ["favorites", locale === "ar" ? "المفضلة" : "Favorites"],
              ["quick", locale === "ar" ? "إضافة سريعة" : "Quick macros"],
            ] as const
          )
            .filter(([entry]) => !editing || entry !== "favorites")
            .map(([entry, label]) => (
              <Button
                key={entry}
                variant={mode === entry ? "default" : "outline"}
                aria-pressed={mode === entry}
                disabled={adding}
                onClick={() => onMode(entry)}
              >
                {label}
              </Button>
            ))}
        </nav>
        {(mode === "search" || mode === "recent") && (
          <>
            {libraryPending && (
              <p role="status" className="mt-3 text-sm">
                {navigator.onLine
                  ? locale === "ar"
                    ? "جارٍ تحميل مكتبة الطعام…"
                    : "Loading food library…"
                  : locale === "ar"
                    ? "المكتبة غير متاحة دون اتصال. يمكنك استخدام الإضافة السريعة أو المفضلة المخزنة."
                    : "Library unavailable offline. Use Quick macros or cached Favorites."}
              </p>
            )}
            {libraryError && (
              <div role="alert" className="mt-3 text-sm">
                {locale === "ar" ? "تعذر تحميل مكتبة الطعام." : "Could not load the food library."}
                <Button variant="outline" onClick={() => void retryLibrary()}>
                  {locale === "ar" ? "إعادة المحاولة" : "Retry library"}
                </Button>
              </div>
            )}
            {lib && mode === "search" && ql && !matches.length && (
              <p role="status" className="mt-3 text-sm">
                {locale === "ar" ? "لا توجد أطعمة مطابقة." : "No matching foods."}
              </p>
            )}
            {lib && mode === "recent" && !lib.recent.length && (
              <p className="mt-3 text-sm">
                {locale === "ar" ? "لا توجد أطعمة حديثة بعد." : "No recent foods yet."}
              </p>
            )}
            <div className="mt-6 rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-center gap-2">
                {mode === "search" && (
                  <div className="relative min-w-0 flex-1">
                    <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      className="ps-9"
                      aria-label={t("searchFood")}
                      placeholder={t("searchFood")}
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                    />
                  </div>
                )}
                <Button type="button" variant="outline" onClick={copyYesterday}>
                  <Copy className="h-4 w-4" />
                  {t("copyYesterday")}
                </Button>
              </div>
              {mode === "search" && matches.length > 0 && (
                <ul className="mt-2 divide-y divide-border rounded-md border border-border text-sm">
                  {matches.map((x) => (
                    <li key={x.id}>
                      <button
                        type="button"
                        className="flex min-h-11 w-full justify-between gap-3 px-3 py-2 text-start hover:bg-muted"
                        onClick={() =>
                          choose({ ...x, name: (locale === "ar" && x.name_ar) || x.name_en })
                        }
                      >
                        <span>
                          {(locale === "ar" && x.name_ar) || x.name_en}{" "}
                          <span className="text-xs text-muted-foreground">· {x.serving}</span>
                        </span>
                        <span className="tabular-nums text-muted-foreground">
                          {x.calories} kcal
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {mode === "recent" && !!lib?.recent.length && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="text-xs text-muted-foreground">{t("recentFoods")}:</span>
                  {lib.recent.map((r) => (
                    <button
                      key={r.name}
                      type="button"
                      className="min-h-11 rounded-full border border-border px-2.5 py-0.5 text-xs hover:border-gold"
                      onClick={() => choose(r)}
                    >
                      {r.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
        {mode !== "favorites" && (
          <>
            <p className="mt-3 text-xs text-muted-foreground">
              {locale === "ar"
                ? "أدخل القيم لحصة واحدة واستخدم المضاعف للكمية التي تناولتها. الاسم اختياري للإضافة السريعة."
                : "Enter values for one portion and use the multiplier for the amount consumed. A name is optional for quick macros."}
            </p>
            <form
              onSubmit={add}
              className="mt-3 grid gap-3 rounded-xl border border-border bg-card p-4 grid-cols-2"
            >
              <fieldset disabled={adding} className="contents">
                {f.serving && (
                  <p className="col-span-2 text-sm text-muted-foreground">
                    {locale === "ar" ? "الحصة الأساسية" : "Base portion"}: {f.serving}
                  </p>
                )}
                <label className="col-span-2 text-sm">
                  {locale === "ar" ? "مضاعف الحصة" : "Portion multiplier"}
                  <Input
                    inputMode="decimal"
                    value={f.portion}
                    onChange={(event) => updateDraft({ portion: event.target.value })}
                  />
                </label>
                <p className="col-span-2 text-xs text-muted-foreground">
                  {locale === "ar"
                    ? "القيم أدناه لحصة واحدة. تُحفظ الإجماليات حسب الكمية التي تناولتها."
                    : "Values below describe one portion. Totals are saved for the amount you consumed."}
                </p>
                {portionTotals && (
                  <p
                    role="status"
                    className="col-span-2 rounded-md border border-gold/40 p-3 text-sm"
                  >
                    {locale === "ar" ? "الإجمالي الذي سيُحفظ" : "Total to save"}:{" "}
                    {portionTotals.calories} kcal · {portionTotals.protein_g} g {t("protein")} ·{" "}
                    {portionTotals.carbs_g} g {t("carbs")} · {portionTotals.fat_g} g {t("fat")}
                  </p>
                )}
                <label className="col-span-2 text-sm">
                  {locale === "ar" ? "الوجبة" : "Meal"}
                  <select
                    aria-label={locale === "ar" ? "الوجبة" : "Meal"}
                    className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={selectedMeal}
                    onChange={(e) => changeMeal(e.target.value)}
                  >
                    {MEALS.map((m) => (
                      <option key={m} value={m}>
                        {t(m as TKey)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="col-span-2 text-sm">
                  {t("foodName")}
                  <Input
                    placeholder={t("foodName")}
                    aria-label={t("foodName")}
                    value={f.name}
                    onChange={(e) => updateDraft({ name: e.target.value })}
                  />
                </label>
                <label className="text-sm">
                  {t("calories")}
                  <Input
                    inputMode="numeric"
                    placeholder="kcal"
                    aria-label={t("calories")}
                    value={f.calories}
                    onChange={(e) => updateDraft({ calories: e.target.value })}
                  />
                </label>
                <label className="text-sm">
                  {t("protein")} (g)
                  <Input
                    inputMode="decimal"
                    placeholder="P g"
                    aria-label={t("protein")}
                    value={f.protein_g}
                    onChange={(e) => updateDraft({ protein_g: e.target.value })}
                  />
                </label>
                <label className="text-sm">
                  {t("carbs")} (g)
                  <Input
                    inputMode="decimal"
                    placeholder="C g"
                    aria-label={t("carbs")}
                    value={f.carbs_g}
                    onChange={(e) => updateDraft({ carbs_g: e.target.value })}
                  />
                </label>
                <label className="text-sm">
                  {t("fat")} (g)
                  <Input
                    inputMode="decimal"
                    placeholder="F g"
                    aria-label={t("fat")}
                    value={f.fat_g}
                    onChange={(e) => updateDraft({ fat_g: e.target.value })}
                  />
                </label>
                <Button type="submit" disabled={adding}>
                  {editing ? (locale === "ar" ? "حفظ التغييرات" : "Save changes") : t("addFood")}
                </Button>
                {entryError && (
                  <p role="alert" className="col-span-2 text-sm text-destructive">
                    {locale === "ar" ? "تعذر الحفظ. تحقق من البيانات وأعد المحاولة." : entryError}
                  </p>
                )}
              </fieldset>
            </form>
          </>
        )}
        {mode === "favorites" && !editing && (
          <>
            <SavedMeals
              userId={userId}
              day={day}
              meal={selectedMeal}
              draft={f}
              logged={food.filter((row) => row.meal === selectedMeal)}
              onLogged={onLogged}
            />
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
