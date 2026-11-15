import { SelectionIndicator } from "@/components/selection-indicator";
import { NativeSelect } from "@/components/ui/native-select";
import { useState } from "react";
import { Search } from "lucide-react";
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
import { FoodScanner } from "@/features/food-scanning/food-scanner";
import { PortionControl } from "./portion-control";

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
        side="bottom"
        className="mx-auto max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl p-4 sm:max-w-2xl"
        dir={locale === "ar" ? "rtl" : "ltr"}
      >
        <div aria-hidden className="mx-auto mb-4 h-1 w-10 rounded-full bg-border" />
        <SheetHeader className="pe-10">
          <SheetTitle>
            {editing ? (locale === "ar" ? "تعديل الطعام" : "Edit food") : t("addFood")}
          </SheetTitle>
          <SheetDescription>
            {editing?.record.log_date ?? day} · {t(selectedMeal as TKey)}
          </SheetDescription>
        </SheetHeader>
        <nav
          className="sliding-selection mt-4 grid grid-cols-4 gap-2"
          aria-label={locale === "ar" ? "اختيار الوجبة" : "Choose meal"}
        >
          {/* Meal selection remains draft-owned; the moving surface is decorative. */}
          <SelectionIndicator />
          {MEALS.map((meal) => (
            <Button
              key={meal}
              type="button"
              variant="secondary"
              className={
                "min-w-0 px-1 text-xs " +
                (selectedMeal === meal
                  ? "bg-raised text-foreground"
                  : "bg-card text-muted-foreground")
              }
              disabled={adding}
              aria-pressed={selectedMeal === meal}
              onClick={() => changeMeal(meal)}
            >
              {t(meal as TKey)}
            </Button>
          ))}
        </nav>
        <nav
          className="sliding-selection mt-4 flex gap-2 overflow-x-auto pb-1"
          aria-label={locale === "ar" ? "طرق إضافة الطعام" : "Food entry methods"}
        >
          <SelectionIndicator />
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
                variant="secondary"
                className={
                  "shrink-0 rounded-full px-4 " +
                  (mode === entry ? "bg-raised text-foreground" : "bg-card text-muted-foreground")
                }
                aria-pressed={mode === entry}
                disabled={adding}
                onClick={() => onMode(entry)}
              >
                {label}
              </Button>
            ))}
        </nav>
        {!editing && mode !== "favorites" && mode !== "recent" && !!lib?.recent.length && (
          <section
            className="mt-3"
            aria-label={locale === "ar" ? "أطعمة حديثة سريعة" : "Quick recent foods"}
          >
            <p className="text-xs text-muted-foreground">{t("recentFoods")}</p>
            <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
              {lib.recent.slice(0, 4).map((r, index) => (
                <Button
                  key={index}
                  type="button"
                  variant="outline"
                  className="shrink-0"
                  disabled={adding}
                  onClick={() => choose(r)}
                >
                  {r.name} · {r.calories} kcal
                </Button>
              ))}
            </div>
          </section>
        )}
        {!editing && <FoodScanner userId={userId} onReviewed={choose} compact />}
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
            <div className="mt-4 rounded-xl bg-card p-4">
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
              </div>
              {mode === "search" && matches.length > 0 && (
                <ul className="mt-3 space-y-3 text-sm">
                  {matches.map((x) => (
                    <li key={x.id}>
                      <button
                        type="button"
                        className="flex min-h-16 w-full items-start justify-between gap-3 rounded-xl bg-background p-4 text-start hover:bg-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                        onClick={() =>
                          choose({ ...x, name: (locale === "ar" && x.name_ar) || x.name_en })
                        }
                      >
                        <span className="min-w-0 break-words font-semibold">
                          {(locale === "ar" && x.name_ar) || x.name_en}
                          <span className="mt-1 block text-xs font-normal text-muted-foreground">
                            {x.serving}
                          </span>
                          <span className="mt-2 block text-xs font-normal text-muted-foreground">
                            <bdi dir="ltr">
                              {x.protein_g}g P · {x.carbs_g}g C · {x.fat_g}g F
                            </bdi>
                          </span>
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
              className="mt-5 grid grid-cols-2 gap-4 rounded-xl bg-raised p-4 sm:p-5"
            >
              <fieldset disabled={adding} className="contents">
                {f.serving && (
                  <p className="col-span-2 text-sm text-muted-foreground">
                    {locale === "ar" ? "الحصة الأساسية" : "Base portion"}: {f.serving}
                  </p>
                )}
                <PortionControl
                  portion={f.portion}
                  serving={f.serving}
                  onChange={(portion) => updateDraft({ portion })}
                />
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
                    <span className="block font-semibold">
                      {locale === "ar" ? "الإجمالي الذي سيُحفظ" : "Total to save"}:
                    </span>
                    <span className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
                      <bdi dir="ltr">{portionTotals.calories} kcal</bdi>
                      <span>
                        {t("protein")} <bdi dir="ltr">{portionTotals.protein_g} g</bdi>
                      </span>
                      <span>
                        {t("carbs")} <bdi dir="ltr">{portionTotals.carbs_g} g</bdi>
                      </span>
                      <span>
                        {t("fat")} <bdi dir="ltr">{portionTotals.fat_g} g</bdi>
                      </span>
                    </span>
                  </p>
                )}
                <label className="col-span-2 text-sm min-w-0 max-w-full block">
                  {locale === "ar" ? "الوجبة" : "Meal"}
                  <NativeSelect
                    aria-label={locale === "ar" ? "الوجبة" : "Meal"}
                    className="mt-2"
                    value={selectedMeal}
                    onChange={(e) => changeMeal(e.target.value)}
                  >
                    {MEALS.map((m) => (
                      <option key={m} value={m}>
                        {t(m as TKey)}
                      </option>
                    ))}
                  </NativeSelect>
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
                <Button
                  type="submit"
                  disabled={adding}
                  className="col-span-2 min-h-12 w-full font-heading text-base font-bold"
                >
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
