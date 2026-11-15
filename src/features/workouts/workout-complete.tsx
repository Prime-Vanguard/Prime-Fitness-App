import { Link } from "@tanstack/react-router";
import { CheckCircle2, Clock3, Dumbbell, Weight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { activityDay } from "@/lib/dates";
import { displayWeight, formatMeasure, weightUnit, type Units } from "@/lib/units";
import type { WorkoutCompletion } from "@/lib/workout-completion";

/** Presentation of the last server-accepted native session; never computes awards. */
export function WorkoutComplete({
  receipt,
  units,
  onDismiss,
}: {
  receipt: WorkoutCompletion;
  units: Units;
  onDismiss: () => void;
}) {
  const { locale } = useI18n();
  const l = (en: string, ar: string) => (locale === "ar" ? ar : en);
  return (
    <section
      className="my-5 space-y-5"
      aria-label={l("Completed workout summary", "ملخص التمرين المكتمل")}
      data-workout-complete
    >
      <header className="space-y-2">
        <p
          role="status"
          className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-emerald-400"
        >
          <CheckCircle2 aria-hidden className="size-4 shrink-0" />
          {l("Workout complete · synced", "اكتمل التمرين · تمت المزامنة")}
        </p>
        <h2 className="break-words font-heading text-2xl font-bold">
          {receipt.title || l("Workout", "تمرين")}
        </h2>
        <p className="text-sm text-muted-foreground">
          <bdi>{activityDay(receipt.finishedAt)}</bdi> · {l("Cairo time", "بتوقيت القاهرة")}
        </p>
      </header>
      <dl className="grid grid-cols-2 gap-3">
        {[
          {
            label: l("External-load volume", "حجم الحمل الخارجي"),
            value: `${formatMeasure(displayWeight(receipt.volumeKg, units))} ${weightUnit(units)}`,
            Icon: Weight,
          },
          {
            label: l("Working sets", "مجموعات العمل"),
            value: String(receipt.workingSets),
            Icon: CheckCircle2,
          },
          {
            label: l("Session duration", "مدة الجلسة"),
            value: `${Math.floor(receipt.durationSeconds / 60)}:${String(receipt.durationSeconds % 60).padStart(2, "0")}`,
            Icon: Clock3,
          },
          {
            label: l("Exercises logged", "تمارين مسجلة"),
            value: String(receipt.exercises),
            Icon: Dumbbell,
          },
        ].map(({ label, value, Icon }) => (
          <div key={label} className="min-w-0 rounded-xl bg-card p-4">
            <dt className="flex items-center justify-between gap-2 text-xs uppercase tracking-wide text-muted-foreground">
              <span>{label}</span>
              <Icon aria-hidden className="size-4 shrink-0" />
            </dt>
            <dd className="mt-4 break-words font-heading text-3xl font-extrabold tabular-nums">
              <bdi>{value}</bdi>
            </dd>
          </div>
        ))}
      </dl>
      <p className="text-sm text-muted-foreground">
        {receipt.loggedSets} {l("sets logged", "مجموعات مسجلة")}
        {receipt.holdSeconds > 0
          ? ` · ${receipt.holdSeconds} ${l("hold seconds", "ثواني ثبات")}`
          : ""}
      </p>
      {/* Keep calculation context available without crowding the completion actions. */}
      <details className="rounded-xl bg-card p-4 text-xs leading-5 text-muted-foreground">
        <summary className="cursor-pointer text-sm text-foreground">
          {l("How these numbers are calculated", "كيف تُحسب هذه الأرقام")}
        </summary>
        <p className="mt-3">
          {l(
            "Volume includes working and drop segments, excluding warm-ups. Timed work is counted separately. Duration is elapsed session time.",
            "يشمل الحجم مجموعات العمل والمجموعات المتناقصة، دون الإحماء. يُحسب الثبات بشكل منفصل. المدة هي الوقت المنقضي للجلسة.",
          )}
        </p>
      </details>
      <Link
        to="/rewards"
        className="inline-flex min-h-11 items-center text-sm text-gold underline underline-offset-4"
      >
        {l("View confirmed XP and PV points in Rewards", "عرض نقاط XP وPV المعتمدة في المكافآت")}
      </Link>
      <div className="grid gap-3 sm:grid-cols-2">
        <Button asChild className="h-auto min-h-11 whitespace-normal text-center">
          <Link to="/train" search={{ section: "history", session: receipt.id }}>
            {l("View completed workout", "عرض التمرين المكتمل")}
          </Link>
        </Button>
        <Button variant="outline" onClick={onDismiss}>
          {l("Dismiss summary", "إغلاق الملخص")}
        </Button>
      </div>
    </section>
  );
}
