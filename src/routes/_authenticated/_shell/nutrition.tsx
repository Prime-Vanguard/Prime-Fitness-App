import { createFileRoute } from "@tanstack/react-router";
import { Droplet, Trash2, Pencil } from "lucide-react";
import { WaterTank } from "@/components/water-tank";
import { WaterEntries } from "@/components/water-entries";
import { foodUndoEntries, type FoodUndo } from "@/lib/nutrition-entries";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n, type TKey } from "@/lib/i18n";
import { useTrainingFeatures } from "@/hooks/use-training-features";
import { activityDay, addDays } from "@/lib/dates";
import { useActivityDay } from "@/hooks/use-activity-day";
import { validActivityDate } from "@/lib/training-search";
import { MEALS, type NutritionSearch } from "@/features/nutrition/contracts";
import { useNutritionData } from "@/features/nutrition/use-nutrition-data";
import { useNutritionWorkflow } from "@/features/nutrition/use-nutrition-workflow";
import { NutritionEntrySheet } from "@/features/nutrition/nutrition-entry-sheet";

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

function Ring({
  label,
  value,
  target,
  unit,
}: {
  label: string;
  value: number;
  target?: number | null | undefined;
  unit: string;
}) {
  const pct = target ? Math.min(1, value / target) : 0;
  const r = 30,
    c = 2 * Math.PI * r;
  return (
    <div className="flex flex-col items-center rounded-xl border border-border bg-card p-3">
      <svg aria-hidden="true" viewBox="0 0 72 72" className="h-8 w-8 -rotate-90">
        <circle cx="36" cy="36" r={r} fill="none" stroke="var(--muted)" strokeWidth="6" />
        <circle
          cx="36"
          cy="36"
          r={r}
          fill="none"
          stroke={pct >= 1 ? "var(--success)" : "var(--gold)"}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
        />
      </svg>
      <p className="mt-2 text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold tabular-nums">
        {Math.round(value)}
        {target ? ` / ${target}` : ""} {unit}
      </p>
    </div>
  );
}

function Page() {
  const { user } = Route.useRouteContext();
  const { data: features } = useTrainingFeatures(user.id);
  const currentDay = useActivityDay();
  const { t, locale } = useI18n();
  const search = Route.useSearch(),
    navigate = Route.useNavigate();
  const day = search.day ?? currentDay;
  const offline = features?.offline === true;
  const { local, data, totalsAvailable, loadError, retryNutrition, refresh } = useNutritionData(
    user.id,
    day,
    currentDay,
    offline,
  );
  const workflow = useNutritionWorkflow({
    userId: user.id,
    day,
    search,
    offline,
    localFood: local.records.food_logs ?? [],
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
    <>
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
            ? "نسخة الجهاز لآخر ٧ أيام؛ الأهداف مخزنة والمكافآت بعد المزامنة."
            : "7-day device cache · cached targets · rewards after sync."}{" "}
          {local.lastSync
            ? new Date(local.lastSync).toLocaleString(locale === "ar" ? "ar-EG" : "en-GB", {
                timeZone: "Africa/Cairo",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })
            : locale === "ar"
              ? "لم تتم المزامنة"
              : "Not yet synced"}
        </p>
      )}
      <div className="mt-4 flex flex-wrap items-end gap-2">
        <Button
          variant="outline"
          aria-label={locale === "ar" ? "اليوم السابق" : "Previous day"}
          onClick={() => setDay(addDays(day, -1))}
        >
          −1
        </Button>
        <label className="min-w-40 flex-1 text-sm">
          {locale === "ar" ? "تاريخ السجل" : "Log date"}
          <Input
            type="date"
            className="mt-1 w-full"
            value={day}
            max={today()}
            onChange={(e) => setDay(e.target.value || today())}
          />
        </label>
        <Button
          variant="outline"
          aria-label={locale === "ar" ? "اليوم التالي" : "Next day"}
          disabled={day >= currentDay}
          onClick={() => setDay(addDays(day, 1))}
        >
          +1
        </Button>
        <Button variant="outline" onClick={() => setDay(currentDay)}>
          {t("today")}
        </Button>
        <Button onClick={() => openEntry("quick")}>{t("addFood")}</Button>
      </div>
      {!tg && totalsAvailable && (
        <p className="mt-4 text-sm text-muted-foreground">{t("noTargets")}</p>
      )}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {!totalsAvailable && (
          <p role="status" className="col-span-full text-sm">
            {locale === "ar"
              ? navigator.onLine && !loadError
                ? "جارٍ تحميل إجماليات التغذية…"
                : "الإجماليات الكاملة غير متاحة؛ تُعرض سجلات الجهاز فقط."
              : navigator.onLine && !loadError
                ? "Loading nutrition totals…"
                : "Complete totals are unavailable; only device entries are shown."}
          </p>
        )}
        {(totalsAvailable || !!data?.food.length || !!data?.water.length) && (
          <>
            <Ring label={t("calories")} value={sum("calories")} target={tg?.calories} unit="kcal" />
            <Ring label={t("protein")} value={sum("protein_g")} target={tg?.protein_g} unit="g" />
            <Ring label={t("carbs")} value={sum("carbs_g")} target={tg?.carbs_g} unit="g" />
            <Ring label={t("fat")} value={sum("fat_g")} target={tg?.fat_g} unit="g" />
          </>
        )}
      </div>

      <section
        id="water"
        className="mt-4 grid scroll-mt-6 grid-cols-[1fr_1fr] gap-3 rounded-xl border border-border bg-card p-3"
        aria-label={t("water")}
      >
        {(totalsAvailable || !!data?.water.length) && (
          <WaterTank value={water} target={tg?.water_ml} pulse={waterPulse} />
        )}
        <div className="flex flex-wrap content-center items-center gap-2">
          {[250, 500].map((ml) => (
            <Button key={ml} variant="outline" disabled={adding} onClick={() => addWater(ml)}>
              <Droplet className="h-4 w-4" />+{ml} ml
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
      <div className="mt-6 space-y-4">
        {MEALS.map((m) => {
          const rows = data?.food.filter((x) => x.meal === m) ?? [];

          return (
            <section key={m} className="rounded-xl border border-border bg-card">
              <div className="flex items-center justify-between gap-2 px-4 py-3">
                <h2 className="text-sm font-semibold text-gold">{t(m as TKey)}</h2>
                <Button
                  variant="outline"
                  size="sm"
                  aria-label={`${t("addFood")} ${t(m as TKey)}`}
                  onClick={() => openEntry("search", m)}
                >
                  {t("addFood")}
                </Button>
              </div>
              {totalsAvailable && !rows.length && (
                <p className="px-4 pb-3 text-sm text-muted-foreground">{t("noFood")}</p>
              )}
              <ul className="divide-y divide-border">
                {rows.map((x) => (
                  <li
                    key={x.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-2 text-sm"
                  >
                    <span className="min-w-0 break-words">{x.name}</span>
                    <span className="flex flex-wrap items-center gap-3 tabular-nums text-muted-foreground">
                      {x.calories} kcal · P{Number(x.protein_g)} C{Number(x.carbs_g)} F
                      {Number(x.fat_g)}
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
      <p className="mt-8 text-xs text-muted-foreground">{t("nutritionSafety")}</p>
    </>
  );
}
