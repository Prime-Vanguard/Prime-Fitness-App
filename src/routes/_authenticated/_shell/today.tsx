import { useEffect, useRef, useState } from "react";
import { offlineHistoryStart } from "@/lib/offline-window";
import { fetchAll } from "@/lib/pagination";
import { useShields } from "@/hooks/use-shields";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { StreakShields } from "@/components/streak-shields";
import { useXpRules } from "@/hooks/use-xp-rules";
import { TodaySessionHero } from "@/features/workouts/today-session-hero";
import { TrainingSchedule } from "@/components/training-schedule";
import { useActivityDay } from "@/hooks/use-activity-day";
import { CheckCircle2, Crown, Flame, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";
import { useGamification } from "@/hooks/use-gamification";
import { RankCrest } from "@/components/rank-crest";
import { useI18n } from "@/lib/i18n";
import { numberLocale } from "@/lib/number-locale";
import { ForgeBand } from "@/components/forge-band";
import { Button } from "@/components/ui/button";
import {
  campaignToPlay,
  currentStreak,
  questCampaign,
  streakTier,
  arabicDays,
  weekStart,
  weeklyQuests,
} from "@/lib/streaks";
import { celebrationLevel, useCelebration } from "@/lib/celebrate";
import { CampaignComplete } from "@/components/campaign-complete";
import { readDevice, writeDevice } from "@/lib/device-storage";
import { RollingNumber } from "@/components/rolling-number";
import { haptic } from "@/lib/device-feedback";
import { useTrainingFeatures } from "@/hooks/use-training-features";
import { useMemberData, beginMemberRead } from "@/hooks/use-member-data";
import { cacheNutritionWindow } from "@/lib/member-store";
import type { ExerciseGuidance } from "@/lib/exercise-guidance";
import { useWorkoutSummary } from "@/hooks/use-workout-summary";

export const Route = createFileRoute("/_authenticated/_shell/today")({
  head: () => ({
    meta: [
      { title: "Today — Prime Fitness" },
      { name: "description", content: "Your daily training, nutrition, streak and quests." },
      { property: "og:title", content: "Today — Prime Fitness" },
      { property: "og:description", content: "Your daily training, nutrition, streak and quests." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Today,
});

const localDay = (iso: string) =>
  new Date(iso).toLocaleDateString("en-CA", { timeZone: "Africa/Cairo" });

function Bar({
  label,
  value,
  target,
  unit,
}: {
  label: string;
  value: number;
  target: number | null | undefined;
  unit: string;
}) {
  const pct = target ? Math.min(100, (value / target) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        {/* Keep "value / target unit" in reading order inside Arabic text. */}
        <bdi dir="ltr" className="tabular-nums">
          <span className="font-semibold">{Math.round(value)}</span>
          {target ? ` / ${target}` : ""} {unit}
        </bdi>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-background">
        <div
          className={`fuel-fill h-full rounded-full ${pct >= 100 ? "bg-success" : "bg-gold"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// Weeks the campaign moment played in this tab, for when storage is blocked.
const campaignSeen = new Map<string, string>();

function Today() {
  const { user } = Route.useRouteContext();
  const { data: me } = useMe(user.id);
  const { data: g } = useGamification(user.id);
  const { t, locale } = useI18n();
  const today = useActivityDay();
  const { data: features } = useTrainingFeatures(user.id);
  const { state: local } = useMemberData(user.id);
  const workout = useWorkoutSummary(user.id);
  const { data: shields } = useShields(user.id);

  const {
    data,
    error: todayError,
    refetch: retryToday,
  } = useQuery({
    queryKey: ["today", user.id, today, !!features?.offline],
    enabled: !features?.offline || navigator.onLine,
    queryFn: async () => {
      const cacheToken = features?.offline ? await beginMemberRead(user.id) : {};
      const since = new Date(
        new Date(`${weekStart(today)}T00:00:00Z`).getTime() - 86400000,
      ).toISOString();
      const [sessions, food, water, targets, body, claims, open] = await Promise.all([
        fetchAll(
          (from, to) =>
            supabase
              .from("workout_sessions")
              .select("id,started_at")
              .eq("member_id", user.id)
              .eq("origin", "native")
              .not("finished_at", "is", null)
              .gte("started_at", since)
              .order("started_at")
              .order("id")
              .range(from, to),
          (r) => r.id,
        ),
        fetchAll(
          (from, to) =>
            supabase
              .from("food_logs")
              .select("*")
              .eq("member_id", user.id)
              .gte("log_date", offlineHistoryStart(today))
              .lte("log_date", today)
              .order("log_date")
              .order("id")
              .range(from, to),
          (r) => r.id,
        ),
        fetchAll(
          (from, to) =>
            supabase
              .from("water_logs")
              .select("*")
              .eq("member_id", user.id)
              .gte("log_date", offlineHistoryStart(today))
              .lte("log_date", today)
              .order("id")
              .range(from, to),
          (r) => r.id,
        ),
        supabase.from("nutrition_targets").select("*").eq("member_id", user.id).maybeSingle(),
        supabase
          .from("body_measurements")
          .select("measured_on")
          .eq("member_id", user.id)
          .gte("measured_on", weekStart(today)),
        supabase
          .from("pv_claims")
          .select("id", { count: "exact", head: true })
          .eq("member_id", user.id)
          .in("status", ["pending", "needs_info"]),
        supabase
          .from("workout_sessions")
          .select("id")
          .eq("member_id", user.id)
          .is("finished_at", null)
          .limit(1)
          .maybeSingle(),
      ]);
      for (const r of [targets, body, claims, open]) if (r.error) throw r.error;
      if (features?.offline)
        await cacheNutritionWindow(
          user.id,
          food,
          water,
          { from: offlineHistoryStart(today), to: today },
          targets.data,
          cacheToken,
        );
      return {
        sessions,
        food,
        water,
        targets: targets.data,
        body: body.data!,
        pending: claims.count ?? 0,
        open: open.data,
      };
    },
  });

  const workoutDays = (data?.sessions ?? []).map((s) => localDay(s.started_at));
  const fuelFood = features?.offline ? (local.records.food_logs ?? []) : (data?.food ?? []);
  const fuelWater = features?.offline ? (local.records.water_logs ?? []) : (data?.water ?? []);
  const foodWindow = local.references["foodWindow"] as { from: string; to: string } | undefined;
  const fuelAvailable = features?.offline
    ? !!foodWindow && today >= foodWindow.from && today <= foodWindow.to
    : !!data;
  const foodDays = fuelFood.map((f) => String(f.log_date));
  const { data: activity, error: activityError } = useQuery({
    queryKey: ["activity-days", user.id, today, shields?.join(",")],
    queryFn: async () =>
      fetchAll(
        (from, to) =>
          supabase
            .from("member_activity_days")
            .select("activity_date")
            .eq("member_id", user.id)
            .lte("activity_date", today)
            .order("activity_date", { ascending: false })
            .range(from, to),
        (r) => r.activity_date ?? "",
      ),
  });
  const streak = currentStreak(
    (activity ?? []).flatMap((day) => (day.activity_date ? [day.activity_date] : [])),
    today,
  );
  const tier = streakTier(streak);
  // A new flame tier flares once; the first read on a device is only a baseline.
  const [flare, setFlare] = useState(false);
  useEffect(() => {
    if (!activity) return;
    const key = `pf-streak-tier-${user.id}`;
    const seen = readDevice(key);
    writeDevice(key, String(tier));
    if (seen != null && tier > Number(seen) && celebrationLevel() !== "off") {
      setFlare(true);
      haptic("badge");
    }
  }, [activity, tier, user.id]);
  const ws = weekStart(today);
  // Server counts of rewarded activity and paid quests. Without them (offline, error)
  // quests fall back to local counts and show no quest reward.
  const { data: questRows } = useQuery({
    queryKey: ["today", user.id, "quests", ws],
    enabled: navigator.onLine,
    retry: 1,
    queryFn: async () => {
      const result = await supabase.rpc("my_weekly_quests");
      if (result.error) throw result.error;
      return Array.isArray(result.data) ? result.data : [];
    },
  });
  const quests = weeklyQuests(
    {
      workouts: workoutDays.filter((d) => d >= ws).length,
      foodDays: new Set(foodDays.filter((d) => d >= ws)).size,
      bodyChecks: data?.body.length ?? 0,
    },
    questRows,
  );
  const campaign = questCampaign(questRows);
  // The campaign moment waits for any level, rank or badge moment on stage, and plays
  // once per paid week on this device. Off records the week without playing.
  const questList = useRef<HTMLDivElement>(null);
  const [playCampaign, setPlayCampaign] = useState(false);
  const { current: onStage } = useCelebration();
  useEffect(() => {
    const key = `pf-campaign-seen-${user.id}`;
    // Wait until the quest list is on screen, so a week marked seen was really shown.
    if (!data || onStage) return;
    if (!campaignToPlay(campaign, readDevice(key) ?? campaignSeen.get(key) ?? null)) return;
    // Without storage, remember it for this tab so it doesn't replay on every visit.
    campaignSeen.set(key, campaign!.week!);
    writeDevice(key, campaign!.week!);
    if (celebrationLevel() !== "off") setPlayCampaign(true);
  }, [campaign?.awarded, campaign?.week, onStage, user.id, !!data]); // eslint-disable-line react-hooks/exhaustive-deps
  const l = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const allDone = quests.every((q) => q.progress >= q.goal);
  const questShort = {
    q_workouts: l("Workouts", "تمارين"),
    q_nutrition: l("Food days", "أيام الأكل"),
    q_body: l("Body check", "قياس الجسم"),
  };
  const { data: rules } = useXpRules();
  // Before quests pay, show the XP of the activities they count ("3 × 3,500 XP"),
  // so it never reads as a separate quest bonus.
  const questXp: Record<string, [number, number]> = {
    q_workouts: [3, rules?.workout_xp ?? 0],
    q_nutrition: [5, rules?.nutrition_day_xp ?? 0],
    q_body: [1, rules?.body_week_xp ?? 0],
  };
  const todayFood = fuelFood.filter((f) => f.log_date === today);
  const kcal = todayFood.reduce((a, f) => a + Number(f.calories), 0);
  const protein = todayFood.reduce((a, f) => a + Number(f.protein_g), 0);
  const water = fuelWater.filter((w) => w.log_date === today).reduce((a, w) => a + Number(w.ml), 0);
  const tg = features?.offline
    ? (local.references["targets"] as NonNullable<typeof data>["targets"])
    : data?.targets;

  return (
    <>
      {(todayError || activityError) && (
        <p role="alert" className="text-sm text-destructive">
          {(todayError || activityError)?.message}
          {todayError && (
            <Button variant="outline" onClick={() => void retryToday()}>
              {locale === "ar" ? "إعادة المحاولة" : "Retry Today"}
            </Button>
          )}
        </p>
      )}
      <ForgeBand
        className="mt-4"
        aria-label={l("This week at a glance", "أسبوعك في لمحة")}
        data-today-briefing
      >
        <p className="text-sm text-muted-foreground">
          {new Date(`${today}T12:00:00Z`).toLocaleDateString(
            locale === "ar" ? "ar-EG-u-nu-latn" : "en-GB",
            { timeZone: "Africa/Cairo", weekday: "long", month: "short", day: "numeric" },
          )}
        </p>
        <h1 className="mt-1 font-display text-[34px] font-extrabold leading-tight">
          {`${t("welcome")}${locale === "ar" ? "، " : ", "}${me?.profile?.display_name || t("member")}`}
        </h1>
        {g && (
          <Link
            to="/rewards"
            data-today-rank
            className="mt-4 flex items-center gap-3 rounded-lg focus-visible:ring-2 focus-visible:ring-gold"
          >
            <RankCrest rank={g.rank.key} size={48} />
            <span className="min-w-0 flex-1">
              <span className="block font-display text-xl font-extrabold leading-tight">
                {locale === "ar" ? g.rank.ar : g.rank.key} · {t("level")} {g.level}
              </span>
              <span
                className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-background"
                aria-hidden
              >
                <span
                  className="block h-full rounded-full bg-gold"
                  style={{ width: `${Math.round(g.pct * 100)}%` }}
                />
              </span>
            </span>
          </Link>
        )}
        <ul className="mt-4 grid grid-cols-4 gap-2">
          <li>
            <a
              href="#streak"
              className="surface-inset flex h-full flex-col items-center gap-1 p-2 text-center focus-visible:ring-2 focus-visible:ring-gold"
            >
              <Flame
                aria-hidden
                className={`size-7 ${tier ? `flame-tier-${Math.min(tier, 4)}` : "text-muted-foreground"}`}
              />
              <span className="font-display text-2xl font-extrabold leading-none">
                {activity ? streak : "–"}
              </span>
              <span className="text-[11px] leading-tight text-muted-foreground">
                {l("Day streak", "أيام التتابع")}
              </span>
            </a>
          </li>
          {quests.map((q) => (
            <li key={q.key}>
              <a
                href="#quests"
                className="surface-inset flex h-full flex-col items-center gap-1 p-2 text-center focus-visible:ring-2 focus-visible:ring-gold"
              >
                <QuestRing progress={q.progress} goal={q.goal} />
                <span className="text-[11px] leading-tight text-muted-foreground">
                  {questShort[q.key]}
                </span>
              </a>
            </li>
          ))}
        </ul>
      </ForgeBand>
      {workout?.session || data?.open ? (
        <TodaySessionHero
          title={workout?.session?.title || t("todayWorkout")}
          active
          plan={workout?.plan ?? []}
          exercises={(workout?.exercises ?? []) as ExerciseGuidance[]}
          guidance={features?.guidance === true}
        />
      ) : (
        <TrainingSchedule
          userId={user.id}
          compact
          dashboard
          guidanceEnabled={features?.guidance === true}
          fallback={<TodaySessionHero title={t("todayWorkout")} />}
        />
      )}

      <div className="mt-4 space-y-4">
        <section id="streak" className="scroll-mt-20 rounded-xl bg-card p-4">
          <div className="flex items-center gap-2">
            <span
              className={`relative inline-grid ${flare ? "flame-flare" : ""}`}
              onAnimationEnd={() => setFlare(false)}
              data-flame-tier={tier}
            >
              <Flame
                aria-hidden
                className={`${tier >= 3 ? "size-6" : "size-5"} ${tier ? `flame-tier-${Math.min(tier, 4)}` : "text-muted-foreground"}`}
              />
              {tier === 5 && (
                <Crown
                  aria-hidden
                  className="absolute -top-2 start-1/2 size-3 -translate-x-1/2 text-gold rtl:translate-x-1/2"
                />
              )}
            </span>
            <h2 className="font-heading text-base font-bold tabular-nums">
              {!activity
                ? t("streak")
                : streak === 0
                  ? l("Start a streak", "ابدأ تتابعاً جديداً")
                  : l(`${streak}-day streak`, `التتابع: ${streak} ${arabicDays(streak)}`)}
            </h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{t("streakHint")}</p>
          <StreakShields
            userId={user.id}
            today={today}
            activeDays={activity?.flatMap((day) => (day.activity_date ? [day.activity_date] : []))}
          />
        </section>
        <section id="quests" className="scroll-mt-20 rounded-xl bg-card p-4">
          <h2 className="font-heading text-base font-bold">{t("weeklyQuests")}</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {l(
              "The weekly minimum. Four workouts and daily food logs keep you on the one-year pace to Level 100.",
              "الحد الأدنى الأسبوعي. أربعة تمارين وتسجيل الطعام يومياً يبقيانك على وتيرة العام للوصول إلى المستوى 100.",
            )}
          </p>
          {!data ? (
            <p role="status" className="mt-3 text-sm text-muted-foreground">
              {locale === "ar"
                ? "تقدم المهام غير متاح بعد. اتصل لتحديثه."
                : "Quest progress is not available yet. Connect to refresh it."}
            </p>
          ) : (
            <div ref={questList} className="relative mt-3">
              {playCampaign && campaign && (
                <CampaignComplete
                  list={questList}
                  xp={campaign.xp}
                  onDone={() => setPlayCampaign(false)}
                />
              )}
              <ul className="space-y-3">
                {quests.map((q) => {
                  const done = q.progress >= q.goal;
                  return (
                    <li key={q.key}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2">
                          {done && (
                            <CheckCircle2 data-quest-check className="h-4 w-4 text-success" />
                          )}
                          {t(q.key)}
                        </span>
                        <span className="flex items-center gap-2 tabular-nums text-muted-foreground">
                          {q.xp !== undefined ? (
                            <span className="text-xs text-gold" data-quest-reward={q.key}>
                              <bdi dir="ltr">+{q.xp.toLocaleString(numberLocale(locale))} XP</bdi>
                              {done && !q.awarded && l(" after sync", " بعد المزامنة")}
                            </span>
                          ) : (
                            rules && (
                              <bdi className="text-xs text-gold">
                                {(questXp[q.key]?.[0] ?? 1) > 1 && `${questXp[q.key]![0]} × `}
                                {(questXp[q.key]?.[1] ?? 0).toLocaleString(numberLocale(locale))} XP
                              </bdi>
                            )
                          )}
                          <bdi>
                            <RollingNumber value={q.progress} format={String} />/{q.goal}
                          </bdi>
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className={`h-full ${done ? "bg-success" : "bg-gold"}`}
                          style={{ width: `${(q.progress / q.goal) * 100}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          {data && campaign && !allDone && (
            <p className="mt-3 text-xs text-muted-foreground">
              {l("Finish all three for a campaign bonus: ", "أنجز الثلاث لمكافأة حملة الأسبوع: ")}
              <bdi dir="ltr" className="text-gold">
                +{campaign.xp.toLocaleString(numberLocale(locale))} XP
              </bdi>
            </p>
          )}
          {data && allDone && (
            <p
              role="status"
              data-quest-campaign
              className="mt-3 flex items-start gap-2 text-sm font-semibold text-gold"
            >
              <CheckCircle2 aria-hidden className="mt-0.5 size-4 shrink-0" />
              {!campaign ? (
                l(
                  "All weekly quests done. New quests start Monday.",
                  "أنجزت كل مهام الأسبوع. مهام جديدة يوم الاثنين.",
                )
              ) : (
                <span>
                  {campaign.awarded
                    ? l("Campaign complete: ", "اكتملت حملة الأسبوع: ")
                    : l(
                        "All weekly quests done. Campaign bonus ",
                        "أنجزت كل مهام الأسبوع. مكافأة الحملة ",
                      )}
                  <bdi dir="ltr">+{campaign.xp.toLocaleString(numberLocale(locale))} XP</bdi>
                  {campaign.awarded
                    ? l(". New quests start Monday.", ". مهام جديدة يوم الاثنين.")
                    : l(" after sync.", " بعد المزامنة.")}
                </span>
              )}
            </p>
          )}
        </section>
      </div>

      <div className="mt-4">
        <section className="rounded-xl bg-card p-4">
          <h2 className="font-heading text-base font-bold">{t("todayFuel")}</h2>
          <div className="mt-3 space-y-3">
            {fuelAvailable ? (
              <>
                <Bar label={t("calories")} value={kcal} target={tg?.calories} unit="kcal" />
                <Bar label={t("protein")} value={protein} target={tg?.protein_g} unit="g" />
                <Bar label={t("water")} value={water} target={tg?.water_ml} unit="ml" />
              </>
            ) : (
              <p role="status" className="text-sm text-muted-foreground">
                {locale === "ar"
                  ? "الإجماليات الكاملة غير متاحة بعد."
                  : "Complete totals are not available yet."}
              </p>
            )}
            {features?.offline && (
              <p className="text-xs text-muted-foreground">
                {locale === "ar"
                  ? "يشمل سجلات الجهاز المعلقة؛ المكافآت بعد المزامنة."
                  : "Includes pending device entries; rewards follow sync."}
              </p>
            )}
          </div>
          <div
            role="group"
            className="mt-4 flex flex-wrap gap-2"
            aria-label={locale === "ar" ? "إجراءات اليوم" : "Daily actions"}
          >
            <Button asChild variant="outline">
              <Link to="/nutrition" search={{ entry: "quick" }}>
                {t("logFood")}
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/nutrition" hash="water">
                {t("water")}
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/progress" search={{ section: "body" }}>
                {locale === "ar" ? "قياس الجسم" : "Body check"}
              </Link>
            </Button>
          </div>
        </section>
      </div>

      {!!data?.pending && (
        <Link
          to="/rewards"
          search={{ section: "activity" }}
          className="mt-4 flex items-center justify-between rounded-xl border border-border bg-card p-4 text-sm hover:border-gold/50"
        >
          <span className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-gold" />
            {t("pendingClaims")}
          </span>
          <span className="rounded-full bg-gold/15 px-2 py-0.5 text-xs font-semibold text-gold">
            {data.pending}
          </span>
        </Link>
      )}
    </>
  );
}

/** Quest progress as a small ring; the count is the accessible text. */
function QuestRing({ progress, goal }: { progress: number; goal: number }) {
  const done = progress >= goal;
  const c = 2 * Math.PI * 16;
  return (
    <span className="relative inline-grid size-10 place-items-center">
      <svg aria-hidden viewBox="0 0 40 40" className="absolute inset-0 -rotate-90">
        <circle cx="20" cy="20" r="16" fill="none" strokeWidth="4" className="stroke-background" />
        <circle
          cx="20"
          cy="20"
          r="16"
          fill="none"
          strokeWidth="4"
          strokeLinecap="round"
          className={done ? "stroke-success" : "stroke-gold"}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - (goal > 0 ? Math.min(progress / goal, 1) : 1))}
        />
      </svg>
      <bdi className="font-display text-sm font-extrabold">
        {progress}/{goal}
      </bdi>
    </span>
  );
}
