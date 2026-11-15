import { Link } from "@tanstack/react-router";
import { Dumbbell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ExerciseHero } from "@/components/exercise-hero";
import { useI18n } from "@/lib/i18n";
import { exerciseWithSnapshot, type ExerciseGuidance } from "@/lib/exercise-guidance";
import { trainingLabel } from "@/lib/training-labels";
import type { PlanItem } from "@/lib/training-tools";

/** Read-only dashboard presentation. Starting/synchronizing stays in Train. */
export function TodaySessionHero({
  title,
  plan = [],
  exercises = [],
  active = false,
  guidance = false,
  subtitle,
  restDay = false,
}: {
  title: string;
  plan?: PlanItem[];
  exercises?: ExerciseGuidance[];
  active?: boolean;
  guidance?: boolean;
  subtitle?: string;
  restDay?: boolean;
}) {
  const { t, locale } = useI18n();
  const l = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const visual = (item: PlanItem) =>
    exerciseWithSnapshot(
      item.id,
      item.exercise,
      exercises.find((exercise) => exercise.id === item.id),
    );
  const first = plan[0] ? visual(plan[0]) : undefined;
  // Use frozen plan metadata; do not invent duration, volume targets or past bests.
  const muscles = [...new Set(plan.map((item) => visual(item).muscle).filter(Boolean))];
  return (
    <div className="mt-4 space-y-4" data-stitch-today-session>
      <section className="space-y-4 rounded-xl bg-card p-4">
        <ExerciseHero exercise={first} name={title} enabled={guidance} compactFallback />
        <div>
          <p className="text-xs uppercase tracking-wider text-gold">
            {active
              ? l("Session in progress", "جلسة قيد التنفيذ")
              : restDay
                ? l("No session scheduled today", "لا توجد جلسة مجدولة اليوم")
                : t("todayWorkout")}
          </p>
          <h2 className="mt-2 font-heading text-2xl font-bold">{title}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {subtitle ||
              (plan.length
                ? `${plan.length} ${l("exercises", "تمارين")}`
                : l(
                    "Choose your plan or start a free session in Train.",
                    "اختر برنامجك أو ابدأ جلسة حرة في التدريب.",
                  ))}
          </p>
        </div>
        {!!muscles.length && (
          <ul aria-label={l("Session muscles", "عضلات الجلسة")} className="flex flex-wrap gap-2">
            {muscles.map((muscle) => (
              <li
                key={muscle}
                className="rounded-full bg-background px-3 py-2 text-xs text-muted-foreground"
              >
                {trainingLabel(muscle, locale)}
              </li>
            ))}
          </ul>
        )}
        <Button asChild className="min-h-12 w-full font-heading text-base font-bold">
          <Link to="/train">
            <Dumbbell aria-hidden className="size-5" />
            {active
              ? t("continueWorkout")
              : restDay
                ? l("View upcoming session", "عرض الجلسة القادمة")
                : t("startWorkout")}
          </Link>
        </Button>
      </section>
      {!!plan.length && (
        <section aria-label={l("Planned exercises", "التمارين المخططة")}>
          <h2 className="mb-3 text-sm font-semibold uppercase">
            {l("Planned exercises", "التمارين المخططة")}
          </h2>
          <ol className="space-y-2">
            {plan.map((item, index) => {
              const exercise = visual(item);
              return (
                <li
                  key={item.slot_key || `${item.id}:${index}`}
                  className="flex items-center gap-3 rounded-xl bg-card p-3"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-background text-xs tabular-nums">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">
                      {locale === "ar" ? exercise.name_ar || exercise.name_en : exercise.name_en}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {trainingLabel(exercise.muscle, locale)} ·{" "}
                      <bdi dir="ltr">
                        {item.sets} × {item.reps}
                      </bdi>
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      )}
    </div>
  );
}
