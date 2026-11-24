import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchAll } from "@/lib/pagination";
import { personalRecords } from "@/lib/records";
import { MUSCLE_AR } from "@/lib/muscle-volume";
import { CheckCircle2, Clock3, Dumbbell, Weight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { friendlyDay } from "@/lib/dates";
import { displayWeight, formatMeasure, weightUnit, type Units } from "@/lib/units";
import type { WorkoutCompletion } from "@/lib/workout-completion";
import { useEffect, useState } from "react";
import { numberLocale } from "@/lib/i18n";
import { useGamification } from "@/hooks/use-gamification";
import { useCountUp } from "@/hooks/use-count-up";
import { debriefRecord, holdForWorkout, updateDebrief } from "@/lib/celebrate";
import { RankCrest } from "@/components/rank-crest";

const DEBRIEF_MS = 3500;

/** One stat that counts up from zero; the final value is what assistive tech reads. */
function CountStat({
  value,
  format,
  animate,
}: {
  value: number;
  format: (value: number) => string;
  animate: boolean;
}) {
  const shown = useCountUp(value, 900, 0, 250, animate);
  return (
    <dd className="mt-4 break-words font-heading text-3xl font-extrabold tabular-nums">
      <bdi aria-hidden>{format(shown)}</bdi>
      <span className="sr-only">{format(value)}</span>
    </dd>
  );
}

/** Presentation of the last server-accepted native session; never computes awards. */
export function WorkoutComplete({
  receipt,
  memberId,
  units,
  onDismiss,
}: {
  receipt: WorkoutCompletion;
  memberId: string;
  units: Units;
  onDismiss: () => void;
}) {
  const { locale, t } = useI18n();
  const l = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const top = receipt.topSets ?? [];
  const { data: g } = useGamification(memberId);
  // The sequence plays once; returning to the summary later shows the same numbers, still.
  const [first] = useState(() => !debriefRecord(receipt.id)?.shown);
  const record = debriefRecord(receipt.id);
  const live = g && record ? Math.max(0, g.xp - record.start) : 0;
  // Freeze the gain when first confirmed, so later food logs or workouts never add to it.
  const gained = record?.gain ?? live;
  useEffect(() => {
    if (record && record.gain == null && live > 0) updateDebrief(receipt.id, { gain: live });
  }, [record, live, receipt.id]);
  const shownGain = useCountUp(gained, 900, 0, 1200, first);
  // Level-ups and badges earned during the workout play once the debrief has had its moment.
  useEffect(() => {
    updateDebrief(receipt.id, { shown: true });
    if (!first) return;
    const release = holdForWorkout();
    const timer = window.setTimeout(release, DEBRIEF_MS);
    return () => {
      window.clearTimeout(timer);
      release();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Earlier bests decide "New best"; offline or failed reads simply show no badge.
  const prior = useQuery({
    queryKey: ["completion-prior-bests", memberId, receipt.id],
    enabled: top.length > 0 && navigator.onLine,
    retry: false,
    staleTime: Infinity,
    queryFn: async () =>
      personalRecords(
        await fetchAll(
          (from, to) =>
            supabase
              .from("set_logs")
              .select("id,exercise_id,weight_kg,reps,created_at,set_role,logging_mode,side")
              .eq("member_id", memberId)
              .in(
                "exercise_id",
                top.map((set) => set.exerciseId),
              )
              .neq("session_id", receipt.id)
              .eq("set_role", "working")
              .eq("logging_mode", "weighted_reps")
              .eq("side", "bilateral")
              .eq("load_convention", "external_total")
              .order("id")
              .range(from, to),
          (row) => row.id,
        ),
      ),
  });
  const ranges = receipt.repRanges;
  const rangeTotal = ranges ? ranges.strength + ranges.hypertrophy + ranges.endurance : 0;
  return (
    <section
      className="my-5 space-y-5"
      aria-label={l("Completed workout summary", "ملخص التمرين المكتمل")}
      data-workout-complete
    >
      <header className="space-y-2">
        <p role="status" className="flex items-center gap-2 text-sm font-semibold text-emerald-400">
          <CheckCircle2 aria-hidden className="size-4 shrink-0" />
          {l("Workout complete · synced", "اكتمل التمرين · تمت المزامنة")}
        </p>
        <p
          className={`${first ? "stamp-in" : ""} origin-center font-display text-3xl font-black text-gold`}
        >
          {l("Mission complete", "اكتملت المهمة")}
        </p>
        <h2 className="break-words font-heading text-2xl font-bold">
          {receipt.title || l("Workout", "تمرين")}
        </h2>
        <p className="text-sm text-muted-foreground">
          <bdi>{friendlyDay(receipt.finishedAt, locale)}</bdi> · {l("Cairo time", "بتوقيت القاهرة")}
        </p>
      </header>
      <dl className="grid grid-cols-2 gap-3">
        {[
          {
            label: l("External-load volume", "حجم الحمل الخارجي"),
            value: receipt.volumeKg,
            format: (v: number) =>
              `${formatMeasure(displayWeight(Math.round(v), units))} ${weightUnit(units)}`,
            Icon: Weight,
          },
          {
            label: l("Working sets", "مجموعات العمل"),
            value: receipt.workingSets,
            format: (v: number) => String(Math.round(v)),
            Icon: CheckCircle2,
          },
          {
            label: l("Session duration", "مدة الجلسة"),
            value: receipt.durationSeconds,
            format: (v: number) =>
              `${Math.floor(Math.round(v) / 60)}:${String(Math.round(v) % 60).padStart(2, "0")}`,
            Icon: Clock3,
          },
          {
            label: l("Exercises logged", "تمارين مسجلة"),
            value: receipt.exercises,
            format: (v: number) => String(Math.round(v)),
            Icon: Dumbbell,
          },
        ].map(({ label, value, format, Icon }) => (
          <div key={label} className="min-w-0 rounded-xl bg-card p-4">
            <dt className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>{label}</span>
              <Icon aria-hidden className="size-4 shrink-0" />
            </dt>
            <CountStat value={value} format={format} animate={first} />
          </div>
        ))}
      </dl>
      {g && (
        <section
          className="flex items-center gap-4 rounded-xl border border-gold/40 bg-card p-4"
          aria-label={l("Level progress", "تقدم المستوى")}
        >
          <RankCrest rank={g.rank.key} size={56} />
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
              <span className="font-semibold">
                {locale === "ar" ? g.rank.ar : g.rank.key} · {t("level")} {g.level}
              </span>
              {gained > 0 && (
                <bdi className="font-heading text-lg font-bold tabular-nums text-gold">
                  +{Math.round(shownGain).toLocaleString(numberLocale(locale))} XP
                </bdi>
              )}
            </p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-background" aria-hidden>
              <div
                className="h-full rounded-full bg-gold"
                style={{
                  width: `${Math.round((gained > 0 ? (shownGain / gained) * g.pct : g.pct) * 100)}%`,
                }}
              />
            </div>
            {gained > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                {l(
                  "Confirmed XP since you started this workout",
                  "نقاط خبرة مؤكدة منذ بدء هذا التمرين",
                )}
              </p>
            )}
          </div>
        </section>
      )}
      {!!receipt.muscles?.length && (
        <section className="space-y-2" aria-label={l("Muscles worked", "العضلات المستهدفة")}>
          <h3 className="font-heading text-base font-bold">
            {l("Muscles worked", "العضلات المستهدفة")}
          </h3>
          <ul className="flex flex-wrap gap-2">
            {receipt.muscles.map(({ muscle, sets }) => (
              <li key={muscle} className="rounded-full bg-card px-3 py-1.5 text-sm">
                {locale === "ar"
                  ? MUSCLE_AR[muscle]
                  : muscle.charAt(0).toUpperCase() + muscle.slice(1)}{" "}
                <span className="tabular-nums text-muted-foreground">
                  <bdi>{sets}</bdi> {sets === 1 ? l("set", "مجموعة") : l("sets", "مجموعات")}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {ranges && rangeTotal > 0 && (
        <section
          className="space-y-2 rounded-xl bg-card p-4"
          aria-label={l("Rep ranges", "نطاقات التكرار")}
        >
          <h3 className="font-heading text-base font-bold">{l("Rep ranges", "نطاقات التكرار")}</h3>
          {(
            [
              ["strength", l("Strength · 1–5 reps", "القوة · 1–5 تكرارات")],
              ["hypertrophy", l("Muscle · 6–12 reps", "العضلات · 6–12 تكرار")],
              ["endurance", l("Endurance · 13+ reps", "التحمل · 13+ تكرار")],
            ] as const
          ).map(([key, label]) => (
            <div key={key}>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{label}</span>
                <span className="tabular-nums">
                  <bdi>{ranges[key]}</bdi>{" "}
                  {ranges[key] === 1 ? l("set", "مجموعة") : l("sets", "مجموعات")}
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-background" aria-hidden>
                <div
                  className="h-full rounded-full bg-gold"
                  style={{ width: `${(ranges[key] / rangeTotal) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </section>
      )}
      {top.length > 0 && (
        <section className="space-y-2" aria-label={l("Top sets", "أفضل المجموعات")}>
          <h3 className="font-heading text-base font-bold">{l("Top sets", "أفضل المجموعات")}</h3>
          <ul className="divide-y divide-border rounded-xl bg-card px-4">
            {top.map((set) => {
              const earlier = prior.data?.get(set.exerciseId);
              const newBest = !!earlier && set.e1rm > earlier.best1rm;
              return (
                <li key={set.exerciseId} className="flex items-center justify-between gap-3 py-3">
                  <span className="min-w-0 break-words text-sm font-medium">
                    {(locale === "ar" && set.nameAr) || set.name || l("Exercise", "تمرين")}
                  </span>
                  <span className="flex shrink-0 items-center gap-2 text-sm tabular-nums">
                    {newBest && (
                      <span className="best-plate rounded-full bg-gold/15 px-2 py-0.5 text-xs font-semibold text-gold">
                        {l("New best", "أفضل رقم جديد")}
                      </span>
                    )}
                    <bdi dir="ltr">
                      {formatMeasure(displayWeight(set.weightKg, units))} {weightUnit(units)} ×{" "}
                      {set.reps}
                    </bdi>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
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
            "Volume includes working and drop segments, excluding warm-ups. Timed work is counted separately. Duration is elapsed session time. Top sets use estimated one-rep max (Epley); New best compares with your earlier bilateral working sets.",
            "يشمل الحجم مجموعات العمل والمجموعات المتناقصة، دون الإحماء. يُحسب الثبات بشكل منفصل. المدة هي الوقت المنقضي للجلسة. أفضل المجموعات تعتمد على الحد الأقصى المقدّر لتكرار واحد (Epley)، و«أفضل رقم جديد» يقارن بمجموعاتك السابقة.",
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
