import { useUnits } from "@/hooks/use-units";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dumbbell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { LegacyWorkoutRecovery } from "@/components/legacy-workout-recovery";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { useWorkout } from "@/hooks/use-workout";
import { MyProgram } from "@/components/my-program";
import { useTrainingFeatures } from "@/hooks/use-training-features";
import { CardioPanel } from "@/features/cardio/cardio-panel";
import { TrainingSchedule } from "@/components/training-schedule";
import { WorkoutSession } from "@/components/workout-session";
import { WorkoutHistoryDetail } from "@/components/workout-history-detail";
import type { ExerciseGuidance } from "@/lib/exercise-guidance";
import { WorkoutHistoryFilters } from "@/components/workout-history-filters";
import { trainingSearch, literalTitlePattern, historyDateFilter } from "@/lib/training-search";
import { activityDay } from "@/lib/dates";

export const Route = createFileRoute("/_authenticated/_shell/train")({
  component: Train,
  validateSearch: trainingSearch,
  head: () => ({ meta: [{ title: "Train — Prime Fitness" }] }),
});

function Train() {
  const { user } = Route.useRouteContext();
  const controller = useWorkout(user.id);
  const units = useUnits(user.id);
  const { t, locale } = useI18n();
  const l = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const { workout: w, ready, error } = controller;
  const { data: features } = useTrainingFeatures(user.id);
  const search = Route.useSearch(),
    navigate = Route.useNavigate();
  const section = search.section ?? "workout",
    historyPage = search.page ?? 0,
    expandedHistory = search.session;
  const validRange = !search.from || !search.to || search.from <= search.to;
  const historySelect =
    "id,title,started_at,finished_at,origin,activity_date,time_precision,set_logs(count)" as const;
  const {
    data: history,
    isPending: historyPending,
    error: historyError,
    refetch: retryHistory,
  } = useQuery({
    enabled: ready && section === "history" && !w.session && validRange,
    queryKey: ["sessions", user.id, historyPage, search.q, search.from, search.to],
    queryFn: async ({ signal }) => {
      let query = supabase
        .from("workout_sessions")
        .select(historySelect)
        .eq("member_id", user.id)
        .not("finished_at", "is", null);
      if (search.q) query = query.ilike("title", literalTitlePattern(search.q));
      const dates = historyDateFilter(search.from, search.to);
      if (dates) query = query.or(dates);
      const r = await query
        .order("started_at", { ascending: false })
        .order("id", { ascending: false })
        .range(historyPage * 20, historyPage * 20 + 19)
        .abortSignal(signal);
      if (r.error) throw r.error;
      return r.data;
    },
  });
  const linkedOutsidePage =
    !!expandedHistory && !!history && !history.some((s) => s.id === expandedHistory);
  const linked = useQuery({
    queryKey: ["linked-workout", user.id, expandedHistory],
    enabled:
      section === "history" && !w.session && linkedOutsidePage && !historyError && validRange,
    retry: 0,
    queryFn: async ({ signal }) => {
      const r = await supabase
        .from("workout_sessions")
        .select(historySelect)
        .eq("member_id", user.id)
        .eq("id", expandedHistory!)
        .not("finished_at", "is", null)
        .abortSignal(signal)
        .maybeSingle();
      if (r.error) throw r.error;
      return r.data;
    },
  });
  const displayedHistory =
    linkedOutsidePage && linked.data ? [linked.data, ...(history ?? [])] : history;
  if (ready && w.session)
    return <WorkoutSession key={`${w.session.id}:${units}`} controller={controller} />;
  return (
    <>
      <PageHeader title={t("train")} />
      <CardioPanel userId={user.id} />
      <LegacyWorkoutRecovery key={user.id} userId={user.id} />
      {!ready && <p role="status">{l("Opening your workout…", "جارٍ فتح التمرين…")}</p>}
      {error && (
        <p role="alert" className="mt-3 rounded-lg border border-amber-500/40 p-3 text-sm">
          {error}
        </p>
      )}
      <nav className="mt-5 flex gap-2" aria-label={l("Training sections", "أقسام التدريب")}>
        {(
          [
            ["workout", t("workout")],
            ["program", t("myProgram")],
            ["history", t("history")],
          ] as const
        ).map(([value, label]) => (
          <Button
            key={value}
            variant={section === value ? "default" : "outline"}
            aria-pressed={section === value}
            onClick={() =>
              void navigate({
                search: { ...search, section: value === "workout" ? undefined : value },
              })
            }
          >
            {label}
          </Button>
        ))}
      </nav>
      {section === "program" && (
        <>
          <MyProgram
            userId={user.id}
            exercises={w.exercises as ExerciseGuidance[]}
            guidanceEnabled={features?.guidance === true}
            canStart={ready && !w.session && !error && !!features && !features.scheduling}
            onStart={controller.start}
          />
        </>
      )}
      {section !== "history" && (
        <TrainingSchedule
          compact={section === "workout"}
          userId={user.id}
          onStart={controller.start}
          canStart={ready && !w.session && !error}
        />
      )}
      {section === "workout" &&
        ready &&
        (w.session ? (
          <WorkoutSession key={`${w.session.id}:${units}`} controller={controller} />
        ) : (
          <div className="mt-8 rounded-xl border border-border bg-card p-6">
            <Dumbbell className="h-8 w-8 text-gold" />
            <h2 className="mt-3 text-xl font-bold">{t("readyToTrain")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {l(
                "Your sets save on this device first, then sync when connected.",
                "تُحفظ مجموعاتك على هذا الجهاز أولاً، ثم تُزامن عند الاتصال.",
              )}
            </p>
            <Button
              className="mt-5"
              size="lg"
              disabled={!w.exercises.length}
              onClick={() => {
                void controller.start(t("workout")).catch((e: Error) => toast.error(e.message));
              }}
            >
              {t("startWorkout")}
            </Button>
          </div>
        ))}
      {section === "history" && (
        <>
          <h2 className="mt-6 text-lg font-bold">{t("history")}</h2>
          <WorkoutHistoryFilters
            key={`${search.q ?? ""}:${search.from ?? ""}:${search.to ?? ""}`}
            search={search}
            onApply={(filters) => void navigate({ search: { section: "history", ...filters } })}
          />
          {linkedOutsidePage && linked.isFetching && (
            <p role="status">{l("Opening linked workout…", "جارٍ فتح الجلسة المرتبطة…")}</p>
          )}
          {linkedOutsidePage && !linked.isPending && !linked.data && (
            <p role="alert">
              {linked.error
                ? l("Could not open linked workout.", "تعذر فتح الجلسة المرتبطة.")
                : l(
                    "This workout is unavailable for your account.",
                    "هذه الجلسة غير متاحة لحسابك.",
                  )}
              {linked.error && (
                <Button variant="outline" onClick={() => void linked.refetch()}>
                  {l("Retry linked workout", "إعادة المحاولة")}
                </Button>
              )}
            </p>
          )}
          <ul className="mt-3 divide-y divide-border rounded-xl border border-border bg-card">
            {historyPending && validRange && (
              <li role="status" className="p-4">
                {l("Loading workouts...", "جارٍ تحميل الجلسات…")}
              </li>
            )}
            {historyError && (
              <li role="alert" className="p-4">
                {l("Could not load history.", "تعذر تحميل السجل.")}{" "}
                <Button variant="outline" onClick={() => void retryHistory()}>
                  {l("Retry", "إعادة المحاولة")}
                </Button>
              </li>
            )}
            {!historyPending && !historyError && !history?.length && (
              <li className="p-6 text-sm text-muted-foreground">
                {search.q || search.from || search.to
                  ? l("No workouts match these filters.", "لا توجد جلسات مطابقة لهذه الفلاتر.")
                  : t("noWorkouts")}
              </li>
            )}
            {validRange &&
              displayedHistory?.map((s) => (
                <li key={s.id} className="p-4 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <button
                      type="button"
                      className="min-h-11 min-w-0 flex-1 text-start font-semibold break-words focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                      aria-expanded={expandedHistory === s.id}
                      aria-controls={`history-${s.id}`}
                      aria-label={`${l("View workout details", "عرض تفاصيل الجلسة")}: ${s.title ?? t("workout")}`}
                      onClick={() =>
                        void navigate({
                          search: {
                            ...search,
                            session: expandedHistory === s.id ? undefined : s.id,
                          },
                        })
                      }
                    >
                      {s.title}
                      {" · "}
                      {new Date(
                        `${s.activity_date ?? activityDay(s.started_at)}T12:00:00Z`,
                      ).toLocaleDateString(locale === "ar" ? "ar-EG" : "en-GB", {
                        timeZone: "UTC",
                      })}
                      {s.time_precision !== "date" &&
                        s.finished_at &&
                        Date.parse(s.finished_at) >= Date.parse(s.started_at) &&
                        ` · ${Math.round((Date.parse(s.finished_at) - Date.parse(s.started_at)) / 60000)} ${l("min", "د")}`}
                      {linkedOutsidePage && s.id === expandedHistory && (
                        <span className="block text-xs text-muted-foreground">
                          {l(
                            "Linked workout outside this page's results",
                            "جلسة مرتبطة خارج نتائج هذه الصفحة",
                          )}
                        </span>
                      )}
                      <span className="block text-xs font-normal text-gold">
                        {expandedHistory === s.id
                          ? l("Hide details", "إخفاء التفاصيل")
                          : l("View details", "عرض التفاصيل")}
                      </span>
                    </button>
                    <span>
                      {s.set_logs[0]?.count ?? 0} {t("sets")}{" "}
                      {s.origin === "import" ? l("· Imported", "· مستورد") : ""}
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!!w.session || !ready}
                        onClick={() => {
                          void (async () => {
                            const [slots, sets] = await Promise.all([
                              supabase.from("workout_exercises").select("*").eq("session_id", s.id),
                              supabase
                                .from("set_logs")
                                .select("*")
                                .eq("session_id", s.id)
                                .order("set_number"),
                            ]);
                            if (slots.error) throw slots.error;
                            if (sets.error) throw sets.error;
                            const ex = slots.data.map((slot) => ({
                              id: slot.exercise_id,
                              ...(slot.snapshot as {
                                name_en: string;
                                name_ar: string | null;
                                muscle: string;
                                equipment: string | null;
                                logging_mode: "weighted_reps" | "bodyweight_reps" | "timed";
                                load_convention: "external_total" | "per_hand" | "bodyweight";
                              }),
                            }));
                            if (!ex.length)
                              throw new Error(
                                l(
                                  "This workout has no exercises to repeat.",
                                  "لا توجد تمارين لتكرارها.",
                                ),
                              );
                            await controller.start(
                              `${s.title ?? t("workout")} · ${l("Repeat", "تكرار")}`,
                              slots.data.map((slot, i) => ({
                                id: slot.exercise_id,
                                sets: Math.max(
                                  1,
                                  sets.data.filter(
                                    (row) =>
                                      row.workout_exercise_id === slot.id &&
                                      row.set_role === "working",
                                  ).length,
                                ),
                                reps: String(
                                  sets.data.find((row) => row.workout_exercise_id === slot.id)
                                    ?.duration_seconds ??
                                    sets.data.find((row) => row.workout_exercise_id === slot.id)
                                      ?.reps ??
                                    "",
                                ),
                                exercise: ex[i]!,
                              })),
                              ex,
                            );
                          })().catch((e) => toast.error(e.message));
                        }}
                      >
                        {l("Repeat workout", "تكرار الجلسة")}
                      </Button>
                    </span>
                  </div>
                  <div id={`history-${s.id}`}>
                    {expandedHistory === s.id && (
                      <WorkoutHistoryDetail
                        memberId={user.id}
                        sessionId={s.id}
                        exercises={w.exercises as ExerciseGuidance[]}
                        guidanceEnabled={features?.guidance === true}
                        units={units}
                      />
                    )}
                  </div>
                </li>
              ))}
          </ul>
          <div className="mt-3 flex gap-2">
            <Button
              variant="ghost"
              disabled={!historyPage}
              onClick={() =>
                void navigate({
                  search: {
                    ...search,
                    page: historyPage > 1 ? historyPage - 1 : undefined,
                    session: undefined,
                  },
                })
              }
            >
              {l("Previous workouts", "الجلسات السابقة")}
            </Button>
            <Button
              variant="ghost"
              disabled={
                !validRange || historyPending || !!historyError || (history?.length ?? 0) < 20
              }
              onClick={() =>
                void navigate({ search: { ...search, page: historyPage + 1, session: undefined } })
              }
            >
              {l("Older workouts", "جلسات أقدم")}
            </Button>
          </div>
        </>
      )}
    </>
  );
}
