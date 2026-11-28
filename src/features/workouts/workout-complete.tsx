import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchAll } from "@/lib/pagination";
import { priorBests } from "@/lib/prior-bests";
import { MUSCLE_AR } from "@/lib/muscle-volume";
import { CheckCircle2, Clock3, Dumbbell, Flame, Volume2, Weight } from "lucide-react";
import { useActivityDay } from "@/hooks/use-activity-day";
import { arabicDays, currentStreak, streakTier, weeklyQuests } from "@/lib/streaks";
import { readDevice, writeDevice } from "@/lib/device-storage";
import { celebrationSound } from "@/lib/device-feedback";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { friendlyDay } from "@/lib/dates";
import { displayWeight, formatMeasure, weightUnit, type Units } from "@/lib/units";
import type { WorkoutCompletion } from "@/lib/workout-completion";
import { useEffect, useState } from "react";
import { numberLocale } from "@/lib/number-locale";
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
  // Exact XP from this finish: the workout event plus quest and badge bonuses awarded in the
  // same transaction, which share its created_at. Missing or failed reads keep the estimate.
  const exact = useQuery({
    queryKey: ["workout-xp", memberId, receipt.id],
    enabled: navigator.onLine,
    retry: false,
    staleTime: Infinity,
    queryFn: async () => {
      const own = await supabase
        .from("xp_events")
        .select("created_at")
        .eq("member_id", memberId)
        .eq("source", "workout")
        .eq("source_ref", receipt.id)
        .maybeSingle();
      if (own.error) throw own.error;
      if (!own.data) return null;
      const { data, error } = await supabase
        .from("xp_events")
        .select("id,amount,source")
        .eq("member_id", memberId)
        .eq("created_at", own.data.created_at)
        .order("id");
      if (error) throw error;
      return data;
    },
  }).data;
  // Freeze the gain when first confirmed, so later food logs or workouts never add to it.
  const gained = exact ? exact.reduce((sum, e) => sum + e.amount, 0) : (record?.gain ?? live);
  const xpLabel = (source: string) =>
    source === "workout"
      ? l("Workout", "تمرين")
      : source === "quest"
        ? l("Weekly quest", "مهمة أسبوعية")
        : source === "quest_week"
          ? l("All weekly quests", "كل مهام الأسبوع")
          : source === "badge"
            ? l("Badge bonus", "مكافأة شارة")
            : l("Bonus", "مكافأة");
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
    queryFn: () =>
      priorBests(
        memberId,
        top.map((set) => set.exerciseId),
        receipt.id,
      ),
  });
  // Quest checks and the streak flame after this finish, from the server.
  const today = useActivityDay();
  const week = useQuery({
    queryKey: ["workout-week", memberId, receipt.id],
    enabled: navigator.onLine,
    retry: false,
    staleTime: Infinity,
    queryFn: async () => {
      const [rows, days] = await Promise.all([
        supabase.rpc("my_weekly_quests"),
        fetchAll(
          (from, to) =>
            supabase
              .from("member_activity_days")
              .select("activity_date")
              .eq("member_id", memberId)
              .lte("activity_date", today)
              .order("activity_date", { ascending: false })
              .range(from, to),
          (r) => r.activity_date ?? "",
        ),
      ]);
      if (rows.error) throw rows.error;
      return {
        quests: weeklyQuests(
          { workouts: 0, foodDays: 0, bodyChecks: 0 },
          Array.isArray(rows.data) ? rows.data : [],
        ),
        streak: currentStreak(
          days.flatMap((d) => (d.activity_date ? [d.activity_date] : [])),
          today,
        ),
      };
    },
  }).data;
  const tier = streakTier(week?.streak ?? 0);
  // Sound is off by default; offer it once, on the first debrief this device shows.
  const [offerSound, setOfferSound] = useState(
    () => readDevice("pf-celebration-sound") == null && readDevice("pf-sound-offered") == null,
  );
  useEffect(() => {
    if (offerSound) writeDevice("pf-sound-offered", "1");
  }, [offerSound]);
  const chooseSound = (on: boolean) => {
    writeDevice("pf-celebration-sound", on ? "on" : "off");
    if (on) void celebrationSound("chime");
    setOfferSound(false);
  };
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
            {gained > 0 && !exact && (
              <p className="mt-1 text-xs text-muted-foreground">
                {l(
                  "Confirmed XP since you started this workout",
                  "نقاط خبرة مؤكدة منذ بدء هذا التمرين",
                )}
              </p>
            )}
            {gained > 0 && exact && (
              <ul
                className="mt-2 space-y-1 text-xs text-muted-foreground"
                aria-label={l("XP from this workout", "نقاط XP من هذا التمرين")}
              >
                {exact.map((e) => (
                  <li key={e.id} className="flex justify-between gap-3">
                    <span>{xpLabel(e.source)}</span>
                    <bdi className="tabular-nums">
                      +{e.amount.toLocaleString(numberLocale(locale))} XP
                    </bdi>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}
      {week && (
        <section className="rounded-xl bg-card p-4" aria-label={l("This week", "هذا الأسبوع")}>
          <p className="flex items-center gap-2 text-sm font-semibold tabular-nums">
            <span className={`inline-grid ${first && tier ? "flame-flare" : ""}`}>
              <Flame
                aria-hidden
                className={`size-5 ${tier ? `flame-tier-${Math.min(tier, 4)}` : "text-muted-foreground"}`}
              />
            </span>
            {week.streak === 0
              ? l("Start a streak", "ابدأ تتابعاً جديداً")
              : l(
                  `${week.streak}-day streak`,
                  `التتابع: ${week.streak} ${arabicDays(week.streak)}`,
                )}
          </p>
          <ul className="mt-3 space-y-2" aria-label={t("weeklyQuests")}>
            {week.quests.map((q) => {
              const done = q.progress >= q.goal;
              return (
                <li key={q.key} className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex items-center gap-2">
                    {done ? (
                      <CheckCircle2
                        aria-hidden
                        className={`size-4 text-success ${first ? "stamp-in" : ""}`}
                      />
                    ) : (
                      <span aria-hidden className="size-4 rounded-full border border-border" />
                    )}
                    {t(q.key)}
                  </span>
                  <bdi className="tabular-nums text-muted-foreground">
                    {q.progress} / {q.goal}
                  </bdi>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      {offerSound && (
        <section
          className="flex flex-wrap items-center gap-3 rounded-xl border border-gold/40 bg-card p-4"
          aria-label={l("Celebration sound", "صوت الاحتفالات")}
        >
          <Volume2 aria-hidden className="size-5 shrink-0 text-gold" />
          <p className="min-w-0 flex-1 text-sm">
            {l(
              "Play a short sound for big moments like this one?",
              "تحب نشغّل صوت قصير في اللحظات الكبيرة زي دي؟",
            )}
          </p>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => chooseSound(true)}>
              {l("Turn on sound", "شغّل الصوت")}
            </Button>
            <Button size="sm" variant="outline" onClick={() => chooseSound(false)}>
              {l("No thanks", "لا، شكراً")}
            </Button>
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
