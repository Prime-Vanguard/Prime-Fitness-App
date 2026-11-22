import { FoodSaveState } from "@/components/food-save-state";
import { useRecordFeedback } from "@/hooks/use-record-feedback";
import { createFileRoute } from "@tanstack/react-router";
import { Droplet, Trash2, Pencil, Plus } from "lucide-react";
import { WaterTank } from "@/components/water-tank";
import { WaterEntries } from "@/components/water-entries";
import { foodUndoEntries, type FoodUndo } from "@/lib/nutrition-entries";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n, type TKey } from "@/lib/i18n";
import { useTrainingFeatures } from "@/hooks/use-training-features";
import { activityDay } from "@/lib/dates";
import { useActivityDay } from "@/hooks/use-activity-day";
import { validActivityDate } from "@/lib/training-search";
import { MEALS, type NutritionSearch } from "@/features/nutrition/contracts";
import { useNutritionData } from "@/features/nutrition/use-nutrition-data";
import { useNutritionWorkflow } from "@/features/nutrition/use-nutrition-workflow";
import { NutritionSummary } from "@/features/nutrition/nutrition-summary";
import { NutritionLoading } from "@/features/nutrition/nutrition-loading";
import { NutritionDateNav } from "@/features/nutrition/nutrition-date-nav";
import { NutritionEntrySheet } from "@/features/nutrition/nutrition-entry-sheet";
import { MealCopyReview } from "@/features/nutrition/meal-copy-review";

export const Route = createFileRoute("/_authenticated/_shell/nutrition")({
  validateSearch: (raw: Record<string, unknown>): NutritionSearch => ({
    day: validActivityDate(raw["day"]) && raw["day"] <= activityDay() ? raw["day"] : undefined,
    entry: ["search", "recent", "favorites", "quick"].includes(String(raw["entry"]))
      ? (raw["entry"] as NutritionSearch["entry"])
      : undefined,
    meal: ["breakfast", "lunch", "dinner", "snack"].includes(String(raw["meal"]))
      ? String(raw["meal"])
      : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Nutrition — Prime Fitness" },
      { name: "description", content: "Log meals, macros and water against your daily targets." },
      { property: "og:title", content: "Nutrition — Prime Fitness" },
      {
        property: "og:description",
        content: "Log meals, macros and water against your daily targets.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

const today = activityDay;

function Page() {
  const { user } = Route.useRouteContext();
  const { data: features } = useTrainingFeatures(user.id);
  const currentDay = useActivityDay();
  const { t, locale } = useI18n();
  const search = Route.useSearch(),
    navigate = Route.useNavigate();
  const day = search.day ?? currentDay;
  const offline = features?.offline === true;
  const {
    local,
    data,
    dayStates,
    totalsAvailable,
    loadError,
    isFetching,
    retryNutrition,
    refresh,
  } = useNutritionData(user.id, day, currentDay, offline);
  const workflow = useNutritionWorkflow({
    userId: user.id,
    day,
    search,
    offline,
    refresh,
    navigate: (options) => navigate(options),
  });
  const { waterPulse, adding, mutationError, openEntry, beginEdit, del, addWater } = workflow;
  const setDay = (next: string) =>
    void navigate({
      search: { ...search, day: next === currentDay ? undefined : next, entry: undefined },
    });
  const sum = (k: "calories" | "protein_g" | "carbs_g" | "fat_g") =>
    (data?.food ?? []).reduce((a, x) => a + Number(x[k]), 0);
  const water = (data?.water ?? []).reduce((a, x) => a + x.ml, 0);
  const tg = data?.targets;
  const hasEntries = !!data?.food.length || !!data?.water.length;
  // Keep partial device records visible while a network read is in progress.
  const loadingTotals = !totalsAvailable && isFetching && !loadError;
  const feedbackRef = useRecordFeedback(
    `${user.id}:${day}`,
    data?.food.map((row) => ({
      id: row.id,
      value: JSON.stringify([
        row.name,
        row.calories,
        row.protein_g,
        row.carbs_g,
        row.fat_g,
        row.meal,
      ]),
    })),
  );
  let undos: FoodUndo[] = [];
  let recoveryError = "";
  try {
    undos = foodUndoEntries(local.references);
  } catch {
    recoveryError =
      locale === "ar"
        ? "تعذر قراءة بيانات الاستعادة. صدّر نسخة الجهاز قبل إزالتها."
        : "Could not read recovery data. Export device data before removing it.";
  }

  return (
    <div ref={feedbackRef} className="app-page-flow">
      <PageHeader title={t("nutrition")} />
      {(mutationError || recoveryError) && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {locale === "ar"
            ? recoveryError || "تعذر تنفيذ التغيير. حدّث البيانات وأعد المحاولة."
            : mutationError || recoveryError}
        </p>
      )}
      {!!undos.length && (
        <section
          aria-label={locale === "ar" ? "استعادة الطعام المحذوف" : "Deleted food recovery"}
          className="mt-4 space-y-3 rounded-xl border border-gold/40 p-4"
        >
          {undos.map((undo) => (
            <div key={undo.token} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="min-w-0 flex-1 break-words">
                {undo.record.name} · {undo.record.log_date} ·{" "}
                {undo.status === "deleting"
                  ? locale === "ar"
                    ? "حالة الحذف غير مؤكدة"
                    : "Deletion status unconfirmed"
                  : undo.mode === "queued"
                    ? locale === "ar"
                      ? "أُزيل من الجهاز؛ الاستعادة متاحة"
                      : "Removed on device; Undo available"
                    : locale === "ar"
                      ? "حُذف؛ الاستعادة متاحة"
                      : "Deleted; Undo available"}
              </span>
              {undo.status === "deleting" && (
                <Button
                  variant="outline"
                  disabled={adding}
                  onClick={() => void workflow.finishDeletion(undo)}
                >
                  {locale === "ar" ? "تحقق من الحذف" : "Check deletion"}
                </Button>
              )}
              <Button
                variant="outline"
                disabled={adding}
                aria-label={`${locale === "ar" ? "استعادة" : "Undo delete"} ${undo.record.name}`}
                onClick={() => void workflow.restore(undo)}
              >
                {locale === "ar" ? "استعادة" : "Undo"}
              </Button>
              <Button
                variant="ghost"
                disabled={adding}
                aria-label={`${locale === "ar" ? "تجاهل الاستعادة" : "Dismiss undo"} ${undo.record.name}`}
                onClick={() => void workflow.dismiss(undo)}
              >
                {locale === "ar" ? "تجاهل" : "Dismiss"}
              </Button>
            </div>
          ))}
        </section>
      )}
      {loadError && (
        <p role="alert">
          {locale === "ar"
            ? "تعذر تحديث البيانات؛ النسخة المحلية قديمة."
            : "Could not refresh data; cached entries may be out of date."}
          <Button variant="outline" onClick={() => void retryNutrition()}>
            {locale === "ar" ? "إعادة المحاولة" : "Retry nutrition"}
          </Button>
        </p>
      )}
      {features?.offline && (
        <p className="mt-2 text-xs text-muted-foreground">
          {locale === "ar"
            ? "نسخة الجهاز لآخر 7 أيام؛ الأهداف مخزنة والمكافآت بعد المزامنة."
            : "7-day device cache · cached targets · rewards after sync."}{" "}
          {local.lastSync
            ? new Date(local.lastSync).toLocaleString(
                locale === "ar" ? "ar-EG-u-nu-latn" : "en-GB",
                {
                  timeZone: "Africa/Cairo",
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                },
              )
            : locale === "ar"
              ? "لم تتم المزامنة"
              : "Not yet synced"}
        </p>
      )}
      <NutritionDateNav day={day} today={currentDay} onSelect={setDay} days={dayStates} />
      <Button
        className="mt-4 min-h-12 w-full font-heading text-base font-bold"
        onClick={() => openEntry("quick")}
      >
        <Plus aria-hidden className="size-5" />
        {t("addFood")}
      </Button>
      {!tg && totalsAvailable && (
        <p className="mt-4 text-sm text-muted-foreground">{t("noTargets")}</p>
      )}
      <div className="mt-4">
        {loadingTotals && !hasEntries ? (
          <NutritionLoading
            label={locale === "ar" ? "جارٍ تحميل إجماليات التغذية…" : "Loading nutrition totals…"}
          />
        ) : (
          !totalsAvailable && (
            <p role="status" className="col-span-full text-sm">
              {locale === "ar"
                ? loadingTotals
                  ? "جارٍ تحميل إجماليات التغذية…"
                  : "الإجماليات الكاملة غير متاحة؛ تُعرض سجلات الجهاز فقط."
                : loadingTotals
                  ? "Loading nutrition totals…"
                  : "Complete totals are unavailable; only device entries are shown."}
            </p>
          )
        )}
        {(totalsAvailable || hasEntries) && (
          <NutritionSummary
            complete={totalsAvailable}
            totals={{
              calories: sum("calories"),
              protein_g: sum("protein_g"),
              carbs_g: sum("carbs_g"),
              fat_g: sum("fat_g"),
            }}
            targets={tg}
          />
        )}
      </div>

      <section
        id="water"
        className="mt-4 scroll-mt-24 space-y-3 rounded-xl bg-card p-4"
        aria-label={t("water")}
      >
        {(totalsAvailable || !!data?.water.length) && (
          <WaterTank value={water} target={tg?.water_ml} pulse={waterPulse} inline />
        )}
        <div className="grid grid-cols-3 gap-2">
          {[250, 500, 750].map((ml) => (
            <Button
              key={ml}
              variant="secondary"
              className="min-w-0 gap-1 px-1 text-xs"
              disabled={adding}
              onClick={() => addWater(ml)}
            >
              <Droplet aria-hidden className="h-4 w-4 shrink-0" />+{ml} ml
            </Button>
          ))}
        </div>
        <div className="col-span-2">
          <WaterEntries
            user={user.id}
            rows={data?.water ?? []}
            references={local.references}
            queued={features?.offline === true}
            onChanged={refresh}
          />
        </div>
      </section>
      <NutritionEntrySheet
        userId={user.id}
        day={day}
        mode={search.entry}
        food={data?.food ?? []}
        model={workflow.entry}
        onMode={(entry) => void navigate({ search: { ...search, entry }, replace: true })}
      />
      <div className="mt-6" data-stitch-meals>
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 className="font-heading text-base font-bold">
            {locale === "ar" ? "الوجبات" : "Meals"}
          </h2>
          {/* Optional copying stays beside meal records as a secondary action. */}
          <MealCopyReview
            userId={user.id}
            day={day}
            meal={workflow.entry.selectedMeal}
            offline={offline}
            localFood={local.records.food_logs ?? []}
            onLogged={workflow.entry.onLogged}
            disabled={adding}
          />
        </div>
        <div className="divide-y divide-border rounded-xl bg-card px-3">
          {MEALS.map((m) => {
            const rows = data?.food.filter((x) => x.meal === m) ?? [];

            return (
              <section key={m} className="py-2">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="flex items-center gap-2 text-sm font-semibold">
                    <span
                      aria-hidden
                      className={
                        "size-2 rounded-full " +
                        (rows.length ? "bg-emerald-400" : "bg-muted-foreground")
                      }
                    />
                    {t(m as TKey)}
                  </h3>
                  <div className="flex items-center gap-1">
                    <p className="text-sm tabular-nums text-muted-foreground">
                      <bdi dir="ltr">
                        {totalsAvailable
                          ? rows.reduce((sum, row) => sum + row.calories, 0) + " kcal"
                          : "—"}
                      </bdi>
                    </p>
                    {/* One add control per meal; empty meals need no separate placeholder. */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-gold"
                      aria-label={`${t("addFood")} ${t(m as TKey)}`}
                      onClick={() => openEntry("search", m)}
                    >
                      <Plus aria-hidden className="size-5" />
                    </Button>
                  </div>
                </div>
                <ul className="space-y-3 empty:hidden [&:not(:empty)]:mt-3">
                  {rows.map((x) => (
                    <li
                      key={x.id}
                      data-feedback-record={x.id}
                      className="space-y-2 rounded-lg bg-background p-3 text-sm"
                    >
                      <FoodSaveState
                        sending={local.queue.some(
                          (change) =>
                            change.entity === "food_logs" &&
                            change.record_id === x.id &&
                            change.status === "sending",
                        )}
                        pending={local.queue.some(
                          (change) => change.entity === "food_logs" && change.record_id === x.id,
                        )}
                        review={local.queue.some(
                          (change) =>
                            change.entity === "food_logs" &&
                            change.record_id === x.id &&
                            (change.status === "conflict" || change.status === "rejected"),
                        )}
                      />
                      <div className="flex items-start justify-between gap-3">
                        <span className="min-w-0 break-words font-medium">{x.name}</span>
                        <span className="shrink-0 tabular-nums">{x.calories} kcal</span>
                      </div>
                      <span className="flex flex-wrap items-center gap-2 text-xs tabular-nums text-muted-foreground">
                        P{Number(x.protein_g)} C{Number(x.carbs_g)} F{Number(x.fat_g)}
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={adding}
                          aria-label={`${locale === "ar" ? "تعديل" : "Edit"} ${x.name}`}
                          onClick={() => void beginEdit(x)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`${t("delete")} ${x.name}`}
                          disabled={adding || !!recoveryError}
                          onClick={() => void del(x)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      </div>
      <p className="mt-8 text-xs text-muted-foreground">{t("nutritionSafety")}</p>
    </div>
  );
}
