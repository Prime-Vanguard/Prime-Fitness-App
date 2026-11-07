import { NativeSelect } from "@/components/ui/native-select";
import { fetchAll } from "@/lib/pagination";
import { useUnits } from "@/hooks/use-units";
import { displayWeight, formatMeasure, weightUnit } from "@/lib/units";
import { MemberSections } from "@/components/member-sections";
import { pageSection } from "@/lib/member-sections";
import { useActivityDay } from "@/hooks/use-activity-day";
import { historyDateFilter } from "@/lib/training-search";
import { normalizeExercise } from "@/lib/exercise-guidance";
import { addDays, activityDay } from "@/lib/dates";
import { weekStart } from "@/lib/streaks";
import { createFileRoute } from "@tanstack/react-router";
import { Activity, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQuery } from "@tanstack/react-query";
import { DeferredProgressChart } from "@/components/deferred-progress-chart";
import { BodyProgress } from "@/components/body-progress";
import { StrengthEvidence } from "@/components/strength-evidence";
import { trainingLabel } from "@/lib/training-labels";
import { MuscleHeatmap } from "@/components/muscle-heatmap";
import { ShareAchievement } from "@/components/share-achievement";
import { useMe } from "@/hooks/use-me";
import { CardioPanel } from "@/features/cardio/cardio-panel";
import { Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { ProgressPhotos } from "@/components/progress-photos";
import { useI18n } from "@/lib/i18n";
import { dailyBest, personalRecords } from "@/lib/records";
import { WellnessCheckIn } from "@/components/wellness-checkin";
import { ModeRecords } from "@/components/mode-records";
import type { PerformanceSet } from "@/lib/training-model";

export const Route = createFileRoute("/_authenticated/_shell/progress")({
  head: () => ({
    meta: [
      { title: "Progress — Prime Fitness" },
      {
        name: "description",
        content: "Your personal records and strength trends in Prime Fitness.",
      },
      { property: "og:title", content: "Progress — Prime Fitness" },
      {
        property: "og:description",
        content: "Your personal records and strength trends in Prime Fitness.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
  validateSearch: (
    raw: Record<string, unknown>,
  ): { section?: "overview" | "strength" | "body" | "photos" | undefined } => ({
    section: pageSection(raw["section"], ["overview", "strength", "body", "photos"], "overview"),
  }),
});

function Page() {
  const { user } = Route.useRouteContext();
  const { t, locale } = useI18n();
  const { data: me } = useMe(user.id);
  const units = useUnits(user.id);
  const wu = weightUnit(units);
  const search = Route.useSearch(),
    navigate = Route.useNavigate(),
    section = search.section ?? "overview";
  const today = useActivityDay();
  const [visited, setVisited] = useState(() => new Set([section]));
  useEffect(() => {
    setVisited((current) => (current.has(section) ? current : new Set([...current, section])));
  }, [section]);
  const [exerciseQuery, setExerciseQuery] = useState("");
  const [period, setPeriod] = useState("90");
  const overview = useQuery({
    queryKey: ["progress", user.id, "overview", today],
    enabled: section === "overview",
    queryFn: async () => {
      const [workouts, sets, weekly] = await Promise.all([
        supabase
          .from("workout_sessions")
          .select("id", { count: "exact", head: true })
          .eq("member_id", user.id)
          .not("finished_at", "is", null),
        supabase
          .from("set_logs")
          .select("id,workout_sessions!inner(finished_at,origin,activity_date,title)", {
            count: "exact",
            head: true,
          })
          .eq("member_id", user.id)
          .not("workout_sessions.finished_at", "is", null),
        supabase
          .from("workout_sessions")
          .select("id", { count: "exact", head: true })
          .eq("member_id", user.id)
          .not("finished_at", "is", null)
          .or(historyDateFilter(weekStart(today))!),
      ]);
      for (const result of [workouts, sets, weekly]) if (result.error) throw result.error;
      return { workouts: workouts.count ?? 0, sets: sets.count ?? 0, weekly: weekly.count ?? 0 };
    },
  });
  const [picked, setPicked] = useState("");
  const [loadConvention, setLoadConvention] = useState("");

  const { data, error, isPending, refetch } = useQuery({
    queryKey: ["progress", user.id, "strength"],
    enabled: section === "strength",
    queryFn: async () => {
      const [sets, ex] = await Promise.all([
        fetchAll(
          (from, to) =>
            supabase
              .from("set_logs")
              .select(
                "*,workout_sessions!inner(finished_at,origin,activity_date,title),workout_exercises(snapshot)",
              )
              .eq("member_id", user.id)
              .not("workout_sessions.finished_at", "is", null)
              .order("created_at")
              .order("id")
              .range(from, to),
          (r) => r.id,
        ),
        fetchAll(
          (from, to) =>
            supabase.from("exercises").select("id,name_en,name_ar").order("id").range(from, to),
          (r) => r.id,
        ),
      ]);
      return { sets, exercises: ex };
    },
  });

  const conventions = [
    ...new Set(
      (data?.sets ?? [])
        .filter(
          (set) =>
            (set.logging_mode ?? "weighted_reps") === "weighted_reps" &&
            (set.side ?? "bilateral") === "bilateral" &&
            (set.set_role ?? "working") === "working",
        )
        .map((set) => set.load_convention ?? "external_total"),
    ),
  ];
  const recordConvention = conventions.includes(loadConvention)
    ? loadConvention
    : (conventions.at(-1) ?? "external_total");
  const compatibleSets = useMemo(
    () =>
      (data?.sets ?? []).filter(
        (set) => (set.load_convention ?? "external_total") === recordConvention,
      ),
    [data, recordConvention],
  );
  const prs = useMemo(() => personalRecords(compatibleSets), [compatibleSets]);
  const name = (id: string) => {
    const snapshot = data?.sets.find((s) => s.exercise_id === id && s.workout_exercises)
      ?.workout_exercises?.snapshot as { name_en: string; name_ar: string | null } | undefined;
    const e = snapshot ?? data?.exercises.find((x) => x.id === id);
    return (locale === "ar" && e?.name_ar) || e?.name_en || "";
  };
  const prIds = [...prs.keys()].filter((id) =>
    normalizeExercise(name(id)).includes(normalizeExercise(exerciseQuery)),
  );
  const current = prIds.includes(picked) ? picked : prIds[0] || "";
  const series = useMemo(
    () =>
      dailyBest(compatibleSets, current).filter(
        (point) => period === "all" || point.date >= addDays(today, -Number(period)),
      ),
    [compatibleSets, current, period, today],
  );
  const fmt = (d: string) =>
    new Date(`${activityDay(d)}T12:00:00Z`).toLocaleDateString(
      locale === "ar" ? "ar-EG" : "en-GB",
      {
        timeZone: "Africa/Cairo",
        day: "numeric",
        month: "short",
      },
    );

  return (
    <>
      <PageHeader title={t("progress")} />
      <CardioPanel userId={user.id} progressOnly />
      {error && (
        <p role="alert" className="text-destructive">
          {error.message}
        </p>
      )}
      <MemberSections
        label={locale === "ar" ? "أقسام التقدم" : "Progress sections"}
        value={section}
        items={[
          ["overview", locale === "ar" ? "نظرة عامة" : "Overview"],
          ["strength", locale === "ar" ? "القوة" : "Strength"],
          ["body", locale === "ar" ? "الجسم والمتابعة" : "Body & wellness"],
          ["photos", locale === "ar" ? "الصور" : "Photos"],
        ]}
        onSelect={(section) =>
          void navigate({ search: { section: section === "overview" ? undefined : section } })
        }
      />
      {section === "overview" && (
        <>
          {overview.isPending && (
            <p role="status">
              {locale === "ar" ? "جارٍ تحميل الملخص…" : "Loading progress summary…"}
            </p>
          )}
          {overview.error && (
            <p role="alert">
              {locale === "ar" ? "تعذر تحميل الملخص." : "Could not load summary."}
              <Button variant="outline" onClick={() => void overview.refetch()}>
                {locale === "ar" ? "إعادة المحاولة" : "Retry summary"}
              </Button>
            </p>
          )}
          <div className="mt-6 grid grid-cols-3 gap-3">
            {[
              [t("totalWorkouts"), overview.data?.workouts ?? "—"],
              [t("thisWeek"), overview.data?.weekly ?? "—"],
              [
                locale === "ar" ? "سجلات المجموعات" : "Logged set entries",
                overview.data?.sets ?? "—",
              ],
            ].map(([l, v]) => (
              <div key={String(l)} className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs text-muted-foreground">{l}</p>
                <p className="mt-1 font-display text-2xl font-bold tabular-nums">{v}</p>
              </div>
            ))}
          </div>

          <p className="mt-2 text-xs text-muted-foreground">
            {locale === "ar"
              ? "يشمل الجلسات المكتملة والمستوردة. تُحسب كل جهة وجزء تنازلي كسجل منفصل."
              : "Includes completed and imported history. Each logged side/drop segment is a separate entry."}
          </p>
          <MuscleHeatmap userId={user.id} />
        </>
      )}
      {(section === "body" || visited.has("body")) && (
        <Activity mode={section === "body" ? "visible" : "hidden"}>
          <BodyProgress userId={user.id} />
          <WellnessCheckIn memberId={user.id} userId={user.id} />
        </Activity>
      )}
      {section === "strength" && (
        <>
          {conventions.length > 0 && (
            <label className="mt-4 block text-sm min-w-0 max-w-full">
              {locale === "ar" ? "أساس الحمل للأرقام القياسية" : "Record load convention"}
              <NativeSelect
                className="mt-2"
                value={recordConvention}
                aria-label={
                  locale === "ar" ? "أساس الحمل للأرقام القياسية" : "Record load convention"
                }
                onChange={(event) => setLoadConvention(event.target.value)}
              >
                {conventions.map((value) => (
                  <option key={value} value={value}>
                    {trainingLabel(value, locale)}
                  </option>
                ))}
              </NativeSelect>
            </label>
          )}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              {locale === "ar" ? "البحث في التمارين" : "Search strength exercises"}
              <Input
                className="mt-1"
                value={exerciseQuery}
                onChange={(e) => setExerciseQuery(e.target.value)}
              />
            </label>
            <label className="text-sm min-w-0 max-w-full block">
              {locale === "ar" ? "فترة الرسم" : "Trend period"}
              <NativeSelect
                className="mt-2"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
              >
                <option value="30">30 {locale === "ar" ? "يوماً" : "days"}</option>
                <option value="90">90 {locale === "ar" ? "يوماً" : "days"}</option>
                <option value="all">{locale === "ar" ? "كل الوقت" : "All time"}</option>
              </NativeSelect>
            </label>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {locale === "ar"
              ? "الأرقام القياسية لكل الوقت؛ الفترة تغيّر الرسم فقط. يشمل السجل الجلسات المستوردة."
              : "Records are all-time; the period changes the trend only. Includes imported history."}
          </p>
          {isPending && (
            <p role="status">
              {locale === "ar" ? "جارٍ تحميل السجل…" : "Loading strength history…"}
            </p>
          )}
          {!isPending && current && !series.length && (
            <p role="status" className="mt-3 text-sm text-muted-foreground">
              {locale === "ar"
                ? "لا توجد بيانات في هذه الفترة. جرّب كل الوقت."
                : "No trend entries in this period. Try All time."}
            </p>
          )}
          {error && (
            <Button variant="outline" onClick={() => void refetch()}>
              {locale === "ar" ? "إعادة المحاولة" : "Retry strength"}
            </Button>
          )}
          {data && (
            <ModeRecords
              sets={
                (data?.sets ?? []).filter((set) =>
                  normalizeExercise(name(set.exercise_id)).includes(
                    normalizeExercise(exerciseQuery),
                  ),
                ) as (PerformanceSet & { exercise_id: string })[]
              }
              name={name}
              memberName={me?.profile?.display_name ?? ""}
              units={units}
            />
          )}
          {!isPending &&
            !error &&
            (prIds.length === 0 ? (
              <p className="mt-6 rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                {locale === "ar"
                  ? "لا توجد أرقام ثنائية بأوزان لهذا الأساس. تُعرض أرقام الثبات ووزن الجسم والجانبين أعلاه عند توفرها."
                  : "No bilateral weighted records for this convention. Timed, bodyweight and side records appear above when available."}
              </p>
            ) : (
              <>
                <section className="mt-6 rounded-xl border border-border bg-card p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="font-display text-lg font-bold">{t("strengthTrend")}</h2>
                    <NativeSelect
                      aria-label={t("exercise")}
                      className="sm:w-auto sm:max-w-sm"
                      value={current}
                      onChange={(e) => setPicked(e.target.value)}
                    >
                      {prIds.map((id) => (
                        <option key={id} value={id}>
                          {name(id)}
                        </option>
                      ))}
                    </NativeSelect>
                  </div>
                  {series.length > 1 && (
                    <DeferredProgressChart
                      series={series.map((point) => ({
                        ...point,
                        value: formatMeasure(displayWeight(point.value, units)),
                      }))}
                      label={t("est1rm")}
                      unit={wu}
                    />
                  )}
                </section>

                <section className="mt-6 rounded-xl border border-border bg-card">
                  <h2 className="flex items-center gap-2 px-5 pt-5 font-display text-lg font-bold">
                    <Trophy className="h-5 w-5 text-gold" />
                    {t("records")}
                  </h2>
                  <ul className="mt-3 divide-y divide-border">
                    {prIds.map((id) => {
                      const p = prs.get(id)!;
                      return (
                        <li
                          key={id}
                          className="flex items-center justify-between gap-3 px-5 py-3 text-sm"
                        >
                          <div>
                            <p className="font-medium">{name(id)}</p>
                            <p className="text-xs text-muted-foreground">{fmt(p.date)}</p>
                          </div>
                          <div className="text-end tabular-nums">
                            <p className="font-semibold">
                              {formatMeasure(displayWeight(p.bestWeight, units))} {wu} ×{" "}
                              {p.bestReps}
                            </p>
                            <p className="text-xs text-gold">
                              {t("est1rm")} {formatMeasure(displayWeight(p.best1rm, units))} {wu}
                            </p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              </>
            ))}
          {!!series.length && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-start text-sm">
                <caption className="mb-2 text-start">
                  {locale === "ar"
                    ? "بيانات الرسم: أقصى تكرار تقديري"
                    : "Trend data: estimated 1RM"}
                </caption>
                <thead>
                  <tr>
                    <th className="p-2 text-start">{locale === "ar" ? "التاريخ" : "Date"}</th>
                    <th className="p-2 text-start">{wu}</th>
                  </tr>
                </thead>
                <tbody>
                  {series.map((point) => (
                    <tr key={point.date}>
                      <td className="p-2">{fmt(point.date)}</td>
                      <td className="p-2 tabular-nums">
                        {formatMeasure(displayWeight(point.value, units))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {current && prs.get(current) && (
            <div className="mt-4">
              <ShareAchievement
                name={me?.profile?.display_name || t("member")}
                title={name(current)}
                detail={`${t("records")}: ${formatMeasure(displayWeight(prs.get(current)!.bestWeight, units))} ${wu}`}
              />
            </div>
          )}
          {current && data && (
            <StrengthEvidence key={current} sets={data.sets} exerciseId={current} units={units} />
          )}
        </>
      )}
      {(section === "photos" || visited.has("photos")) && (
        <Activity mode={section === "photos" ? "visible" : "hidden"}>
          <ProgressPhotos userId={user.id} />
        </Activity>
      )}
    </>
  );
}
