import { fetchAll } from "@/lib/pagination";
import { useShields } from "@/hooks/use-shields";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { StreakShields } from "@/components/streak-shields";
import { TodaySessionHero } from "@/features/workouts/today-session-hero";
import { TrainingSchedule } from "@/components/training-schedule";
import { useActivityDay } from "@/hooks/use-activity-day";
import { CheckCircle2, Flame, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";
import { useGamification } from "@/hooks/use-gamification";
import { RankCrest } from "@/components/rank-crest";
import { useI18n } from "@/lib/i18n";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { currentStreak, weekStart, weeklyQuests } from "@/lib/streaks";
import { useTrainingFeatures } from "@/hooks/use-training-features";
import { useMemberData, retainMemberRows, beginMemberRead } from "@/hooks/use-member-data";
import { changeMemberState } from "@/lib/member-store";
import { addDays } from "@/lib/dates";
import type { Json } from "@/integrations/supabase/types";
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
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums">
          {Math.round(value)}
          {target ? ` / ${target}` : ""} {unit}
        </span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={`fuel-fill h-full rounded-full ${pct >= 100 ? "bg-success" : "bg-slate-200"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

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
              .gte("log_date", addDays(today, -6))
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
              .gte("log_date", addDays(today, -6))
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
      if (features?.offline) {
        const foodCached = await retainMemberRows(user.id, "food_logs", food, cacheToken);
        const waterCached = await retainMemberRows(user.id, "water_logs", water, cacheToken);
        await changeMemberState(user.id, (state) => ({
          ...state,
          references: {
            ...state.references,
            targets: targets.data as Json,
            foodWindow: { from: addDays(today, -6), to: today },
          },
        }));
      }
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
  const ws = weekStart(today);
  const quests = weeklyQuests({
    workouts: workoutDays.filter((d) => d >= ws).length,
    foodDays: new Set(foodDays.filter((d) => d >= ws)).size,
    bodyChecks: data?.body.length ?? 0,
  });
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
      <PageHeader
        compact
        accessory={
          g && (
            <span
              data-today-rank
              className="rounded-md border border-border bg-card px-2 py-1 text-xs font-medium"
            >
              {locale === "ar" ? g.rank.ar : g.rank.key} · {t("level")} {g.level}
            </span>
          )
        }
        eyebrow={new Date(`${today}T12:00:00Z`).toLocaleDateString(
          locale === "ar" ? "ar-EG" : "en-GB",
          { timeZone: "Africa/Cairo", weekday: "long", month: "short", day: "numeric" },
        )}
        title={`${t("welcome")}, ${me?.profile?.display_name || t("member")}`}
      />
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

      <div className="mt-4">
        <section className="rounded-xl bg-card p-4">
          <p className="text-xs uppercase tracking-widest text-gold">{t("todayFuel")}</p>
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
                {locale === "ar" ? "تسجيل القياسات" : "Check-in"}
              </Link>
            </Button>
          </div>
        </section>
      </div>

      <div className="mt-4 space-y-4">
        <section className="rounded-xl bg-card p-4">
          <div className="flex items-center gap-2">
            <Flame
              aria-hidden
              className={`size-5 ${streak > 0 ? "text-emerald-400" : "text-muted-foreground"}`}
            />
            <h2 className="font-heading text-base font-bold">
              <span className="tabular-nums">{activity ? streak : "–"}</span> · {t("streak")}
            </h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{t("streakHint")}</p>
          <StreakShields
            userId={user.id}
            today={today}
            activeDays={[...workoutDays, ...foodDays]}
          />
        </section>
        <section className="rounded-xl bg-card p-4">
          <p className="text-xs uppercase tracking-widest text-gold">{t("weeklyQuests")}</p>
          {!data ? (
            <p role="status" className="mt-3 text-sm text-muted-foreground">
              {locale === "ar"
                ? "تقدم المهام غير متاح بعد. اتصل لتحديثه."
                : "Quest progress is not available yet. Connect to refresh it."}
            </p>
          ) : (
            <ul className="mt-3 space-y-3">
              {quests.map((q) => {
                const done = q.progress >= q.goal;
                return (
                  <li key={q.key}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        {done && <CheckCircle2 className="h-4 w-4 text-success" />}
                        {t(q.key)}
                      </span>
                      <span className="tabular-nums text-muted-foreground">
                        {q.progress}/{q.goal}
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
          )}
        </section>
      </div>

      <section className="mt-4 flex items-center gap-4 rounded-xl bg-card p-4">
        <RankCrest rank={g?.rank.key ?? "Recruit"} size={64} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="font-display text-lg font-bold">
              {g ? (locale === "ar" ? g.rank.ar : g.rank.key) : "—"} · {t("level")}{" "}
              {g?.level ?? "—"}
            </p>
            <span className="text-xs tabular-nums text-muted-foreground">
              {g?.xp ?? "—"} {t("xp")}
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-gold"
              style={{ width: `${Math.round((g?.pct ?? 0) * 100)}%` }}
            />
          </div>
        </div>
      </section>
      <details className="mt-3 rounded-xl bg-card p-4">
        <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold">
          {locale === "ar" ? "ما الفرق بين XP ونقاط PV؟" : "XP & PV points explained"}
        </summary>
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>
            {locale === "ar"
              ? "يبني XP مستواك ورتبتك. نقاط PV رصيد للمكافآت من مهام PV المعتمدة؛ إنفاقها لا يقلل XP أو الرتبة. لا يوجد تحويل تلقائي بينهما."
              : "XP builds your level and rank. PV points are spendable rewards from approved PV tasks; spending them does not reduce XP or rank. There is no automatic conversion between them."}
          </p>
          <p className="tabular-nums">
            XP: {g?.xp ?? "—"} · PV: {g?.pv ?? "—"}
          </p>
          <Button asChild variant="outline">
            <Link to="/rewards">
              {locale === "ar" ? "عرض قواعد المكافآت" : "View reward rules"}
            </Link>
          </Button>
        </div>
      </details>
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
