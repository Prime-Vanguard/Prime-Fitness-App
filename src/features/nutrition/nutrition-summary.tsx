import { Flame } from "lucide-react";
import { useI18n } from "@/lib/i18n";

type Macros = { calories: number; protein_g: number; carbs_g: number; fat_g: number };
type Targets = { [K in keyof Macros]?: number | null };
export function NutritionSummary({
  totals,
  targets,
  complete,
}: {
  totals: Macros;
  targets: Targets | null | undefined;
  complete: boolean;
}) {
  const { t, locale } = useI18n();
  const l = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const target = targets?.calories;
  const hasTarget = target != null && target > 0;
  // A partial device cache cannot establish a remaining budget or final percentage.
  const remaining = hasTarget && complete ? target - totals.calories : null;
  return (
    <section
      className="space-y-4 rounded-xl bg-card p-4"
      aria-label={l("Daily nutrition summary", "ملخص التغذية اليومية")}
      data-stitch-nutrition-summary
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="mb-2 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <Flame aria-hidden className="size-3 shrink-0 text-gold" />
            {l("Daily nutrition", "التغذية اليومية")}
          </p>
          <h2 className="font-heading text-base font-bold">
            {l("Daily calorie target", "هدف السعرات اليومي")}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {complete
              ? l("Logged food", "الطعام المسجل")
              : l("Device entries · partial totals", "إدخالات الجهاز · إجماليات جزئية")}
          </p>
        </div>
        <div className="shrink-0 text-end">
          <p className="text-3xl font-bold tabular-nums" dir="ltr">
            {Math.round(totals.calories).toLocaleString(locale === "ar" ? "ar-EG" : "en-GB")}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {hasTarget
              ? `/ ${target.toLocaleString()} kcal`
              : l("kcal · no target", "سعرة · دون هدف")}
          </p>
        </div>
      </div>
      <div>
        {/* A partial cache is not a meaningful fraction of the full daily target. */}
        {complete && hasTarget && (
          <div className="h-2 overflow-hidden rounded-full bg-background" aria-hidden="true">
            <div
              className="fuel-fill h-full rounded-full bg-gold"
              style={{ width: `${Math.min(100, (totals.calories / target) * 100)}%` }}
            />
          </div>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          {remaining == null
            ? !complete
              ? l(
                  "Remaining budget unavailable until complete totals load.",
                  "المتبقي غير متاح حتى تحميل الإجماليات الكاملة.",
                )
              : l("Ask your coach to configure targets.", "اطلب من مدربك تحديد الأهداف.")
            : `${Math.round(Math.abs(remaining))} kcal ${remaining >= 0 ? l("remaining", "متبقية") : l("over target", "فوق الهدف")}`}
        </p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {(
          [
            ["protein_g", t("protein"), "bg-emerald-400"],
            ["carbs_g", t("carbs"), "bg-sky-300"],
            ["fat_g", t("fat"), "bg-gold"],
          ] as const
        ).map(([key, label, color]) => {
          const goal = targets?.[key];
          return (
            <div key={key} className="min-w-0 rounded-lg bg-background p-2">
              <div className="flex flex-wrap items-baseline justify-between gap-1 text-[10px]">
                <p className="break-words text-muted-foreground">{label}</p>
                {complete && goal != null && goal > 0 && (
                  <span className="font-medium tabular-nums">
                    {Math.round((totals[key] / goal) * 100)}%
                  </span>
                )}
              </div>
              {/* Keep a target/unit together when large values need a second line. */}
              <p className="mt-2 flex min-h-10 flex-wrap content-start items-baseline gap-1 text-sm font-semibold tabular-nums sm:text-base">
                <bdi>{Math.round(totals[key])}</bdi>
                <span className="whitespace-nowrap text-[10px] font-normal text-muted-foreground">
                  {goal != null && goal > 0 ? ` / ${goal}` : ""} g
                </span>
              </p>
              {complete && goal != null && goal > 0 && (
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-border" aria-hidden="true">
                  <div
                    className={"fuel-fill h-full rounded-full " + color}
                    style={{ width: `${Math.min(100, (totals[key] / goal) * 100)}%` }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
