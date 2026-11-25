import { useUnits } from "@/hooks/use-units";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dumbbell, Activity, ChevronRight } from "lucide-react";
import {
  loadWorkoutHistoryPage,
  loadWorkoutHistoryDetails,
  loadWorkoutHistorySummary,
} from "@/lib/workout-history-data";
import { OfflineHistoryUnavailableError } from "@/lib/workout-history-cache";
import { PageHeader } from "@/components/page-header";
import { MemberSections } from "@/components/member-sections";
import { LegacyWorkoutRecovery } from "@/components/legacy-workout-recovery";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { useWorkout } from "@/hooks/use-workout";
import { MyProgram } from "@/components/my-program";
import { useTrainingFeatures } from "@/hooks/use-training-features";
import { CardioPanel } from "@/features/cardio/cardio-panel";
import { TrainingSchedule } from "@/components/training-schedule";
import { WorkoutSession } from "@/components/workout-session";
import { WorkoutComplete } from "@/features/workouts/workout-complete";
import { WorkoutHistoryDetail } from "@/components/workout-history-detail";
import { exerciseWithSnapshot, type ExerciseGuidance } from "@/lib/exercise-guidance";
import { WorkoutHistoryFilters } from "@/components/workout-history-filters";
import { trainingSearch } from "@/lib/training-search";
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
  const {
    data: historyResult,
    isPending: historyPending,
    error: historyError,
    refetch: retryHistory,
  } = useQuery({
    enabled:
      ready && section === "history" && (!w.session || search.view === "overview") && validRange,
    queryKey: ["sessions", user.id, historyPage, search.q, search.from, search.to],
    networkMode: "always",
    queryFn: ({ signal }) => loadWorkoutHistoryPage(user.id, search, signal),
  });
  const history = historyResult?.rows;
  const linkedOutsidePage =
    !!expandedHistory && !!history && !history.some((s) => s.id === expandedHistory);
  const linked = useQuery({
    queryKey: ["linked-workout", user.id, expandedHistory],
    enabled:
      section === "history" &&
      (!w.session || search.view === "overview") &&
      linkedOutsidePage &&
      !historyError &&
      validRange,
    retry: 0,
    networkMode: "always",
    queryFn: ({ signal }) => loadWorkoutHistorySummary(user.id, expandedHistory!, signal),
  });
  const displayedHistory =
    linkedOutsidePage && linked.data ? [linked.data, ...(history ?? [])] : history;
  if (ready && w.session && search.view !== "overview")
    return <WorkoutSession key={`${w.session.id}:${units}`} controller={controller} />;
  return (
    <>
      <div className={section === "cardio" ? "relative pe-12" : ""}>
        <PageHeader
          eyebrowTone="accent"
          title={section === "cardio" ? l("Cardio & HIIT", "الكارديو وHIIT") : t("train")}
          eyebrow={section === "cardio" ? l("Intervals & endurance", "الفترات والتحمل") : ""}
        />
        {section === "cardio" && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute end-0 bottom-1"
            aria-label={l("Back to workouts", "العودة إلى التمارين")}
            onClick={() => void navigate({ search: { ...search, section: undefined } })}
          >
            <ChevronRight aria-hidden className="size-5 rotate-180 rtl:rotate-0" />
          </Button>
        )}
      </div>
      {!ready && <p role="status">{l("Opening your workout…", "جارٍ فتح التمرين…")}</p>}
      {error && (
        <p role="alert" className="mt-3 rounded-lg border border-amber-500/40 p-3 text-sm">
          {error}
        </p>
      )}
      {section !== "cardio" && (
        <MemberSections
          animated
          appearance="segmented"
          label={l("Training sections", "أقسام التدريب")}
          value={section}
          items={[
            ["workout", t("workout")],
            ["program", t("myProgram")],
            ["history", t("history")],
          ]}
          onSelect={(value) =>
            void navigate({
              search: { ...search, section: value === "workout" ? undefined : value },
            })
          }
        />
      )}
      <LegacyWorkoutRecovery key={user.id} userId={user.id} />
      {/* Completing a prescribed day returns to Program; keep its accepted receipt visible there too. */}
      {ready &&
        w.userId === user.id &&
        !w.session &&
        (section === "workout" || section === "program") &&
        w.completion && (
          <WorkoutComplete
            receipt={w.completion}
            units={units}
            onDismiss={() => {
              void controller
                .change((current) => ({ ...current, completion: undefined }))
                .catch((e: Error) => toast.error(e.message));
            }}
          />
        )}
      {section === "cardio" &&
        (features?.cardio ? (
          <CardioPanel userId={user.id} />
        ) : (
          <p role="status" className="mt-5 text-sm text-muted-foreground">
            {l(
              "Cardio availability could not be confirmed. Reconnect or select another training section.",
              "تعذر تأكيد إتاحة الكارديو. اتصل أو اختر قسماً آخر للتدريب.",
            )}
          </p>
        ))}
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
      {(section === "workout" || section === "program") && (
        <TrainingSchedule
          compact={section === "workout"}
          userId={user.id}
          onStart={controller.start}
          canStart={ready && !w.session && !error}
          exercises={w.exercises as ExerciseGuidance[]}
          guidanceEnabled={features?.guidance === true}
        />
      )}
      {section === "workout" &&
        ready &&
        (w.session ? (
          <section
            className="mt-5 space-y-3 rounded-xl border border-gold/40 bg-card p-4"
            data-workout-resume
          >
            {/* Hub navigation only: the same controller still owns the session and sets. */}
            <h2 className="font-heading text-lg font-semibold">
              {w.session.title || t("workout")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {l(
                "Your workout is still open. Resume logging when ready.",
                "تمرينك ما زال مفتوحاً. تابع التسجيل عندما تكون مستعداً.",
              )}
            </p>
            <Button
              onClick={() =>
                void navigate({ search: { ...search, view: undefined, section: undefined } })
              }
            >
              {t("continueWorkout")}
            </Button>
          </section>
        ) : (
          <div className="mt-5 rounded-xl bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-heading text-base font-bold">
                {l("Unprogrammed Free Session", "جلسة حرة خارج البرنامج")}
              </h2>
              <Dumbbell aria-hidden className="h-5 w-5 shrink-0 text-muted-foreground" />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {l(
                "Your sets save on this device first, then sync when connected.",
                "تُحفظ مجموعاتك على هذا الجهاز أولاً، ثم تُزامن عند الاتصال.",
              )}
            </p>
            <Button
              className="mt-4 w-full"
              variant="secondary"
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
      {features?.cardio && section === "workout" && (
        <button
          type="button"
          aria-label={l("Cardio", "الكارديو")}
          onClick={() => void navigate({ search: { section: "cardio", view: search.view } })}
          className="mt-4 flex min-h-20 w-full items-center gap-4 rounded-2xl bg-card p-5 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
        >
          <Activity aria-hidden className="size-6 shrink-0 text-gold" />
          <span className="min-w-0 flex-1">
            <span className="block font-heading font-bold">
              {l("Cardio & HIIT workouts", "تمارين الكارديو وHIIT")}
            </span>
            <span className="mt-1 block text-xs text-muted-foreground">
              {l("Log cardio or run an interval session", "سجّل الكارديو أو ابدأ جلسة فترات")}
            </span>
          </span>
          <ChevronRight
            aria-hidden
            className="size-5 shrink-0 text-muted-foreground rtl:rotate-180"
          />
        </button>
      )}
      {section === "history" && (
        <>
          <h2 className="sr-only">{t("history")}</h2>
          {historyResult?.source === "device" && (
            <p role="status" className="my-3 text-sm text-muted-foreground">
              {l(
                `Showing downloaded workout history. Latest refreshed dates: ${historyResult.from} to ${historyResult.to}. Connect to see other history.`,
                `عرض سجل التمارين المنزّل. آخر نطاق تم تحديثه: ${historyResult.from} إلى ${historyResult.to}. اتصل لعرض بقية السجل.`,
              )}
            </p>
          )}
          {historyResult?.source === "device" && (
            <p className="text-xs text-muted-foreground">
              {l("Downloaded date ranges", "نطاقات التواريخ المنزّلة")}:{" "}
              {historyResult.coverage.map((range, index) => (
                <span key={`${range.from}:${range.to}`}>
                  {index > 0 ? " · " : ""}
                  <bdi dir="ltr">
                    {range.from} – {range.to}
                  </bdi>
                </span>
              ))}
            </p>
          )}
          <WorkoutHistoryFilters
            key={`${search.q ?? ""}:${search.from ?? ""}:${search.to ?? ""}`}
            search={search}
            onApply={(filters) =>
              void navigate({ search: { section: "history", view: search.view, ...filters } })
            }
          />
          {historyResult?.hasIncompleteDateCoverage && (
            <p role="status" className="my-3 text-sm text-pending">
              {l(
                "Some selected dates have not been downloaded. Results show saved workouts only.",
                "لم يتم تنزيل بعض التواريخ المحددة. تعرض النتائج التمارين المحفوظة فقط.",
              )}
            </p>
          )}
          {linkedOutsidePage && linked.isFetching && (
            <p role="status">{l("Opening linked workout…", "جارٍ فتح الجلسة المرتبطة…")}</p>
          )}
          {linkedOutsidePage && !linked.isPending && !linked.data && (
            <p role="alert">
              {linked.error instanceof OfflineHistoryUnavailableError
                ? l(
                    "This workout has not been downloaded. Connect to open it.",
                    "لم يتم تنزيل هذه الجلسة. اتصل لفتحها.",
                  )
                : linked.error
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
          <ul className="mt-4 space-y-3" data-stitch-history>
            {historyPending && validRange && (
              <li role="status" className="p-4">
                {l("Loading workouts...", "جارٍ تحميل الجلسات…")}
              </li>
            )}
            {historyError && (
              <li role="alert" className="p-4">
                {historyError instanceof OfflineHistoryUnavailableError
                  ? l(
                      "Workout history has not been downloaded for this account. Connect and use Download for offline use in Profile.",
                      "لم يتم تنزيل سجل التمارين لهذا الحساب. اتصل واستخدم التنزيل دون اتصال في الملف الشخصي.",
                    )
                  : l("Could not load history.", "تعذر تحميل السجل.")}{" "}
                <Button variant="outline" onClick={() => void retryHistory()}>
                  {l("Retry", "إعادة المحاولة")}
                </Button>
              </li>
            )}
            {!historyPending && !historyError && !history?.length && (
              <li className="p-6 text-sm text-muted-foreground">
                {search.q || search.from || search.to
                  ? historyResult?.source === "device"
                    ? l(
                        "No downloaded workouts match these filters.",
                        "لا توجد تمارين منزّلة تطابق هذه الفلاتر.",
                      )
                    : l("No workouts match these filters.", "لا توجد جلسات مطابقة لهذه الفلاتر.")
                  : historyResult?.source === "device"
                    ? l("No workouts in downloaded history.", "لا توجد تمارين في السجل المنزّل.")
                    : t("noWorkouts")}
              </li>
            )}
            {validRange &&
              displayedHistory?.map((s) => (
                <li
                  key={s.id}
                  className={`rounded-xl border bg-card p-4 text-sm ${expandedHistory === s.id ? "border-gold" : "border-border"}`}
                >
                  <div className="flex flex-col items-stretch gap-3">
                    <button
                      type="button"
                      className="min-h-11 min-w-0 w-full text-start font-semibold break-words focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
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
                      <span className="block text-xs font-normal text-muted-foreground">
                        {new Date(
                          `${s.activity_date ?? activityDay(s.started_at)}T12:00:00Z`,
                        ).toLocaleDateString(locale === "ar" ? "ar-EG" : "en-GB", {
                          timeZone: "UTC",
                        })}
                        {s.time_precision !== "date" &&
                          s.finished_at &&
                          Date.parse(s.finished_at) >= Date.parse(s.started_at) &&
                          ` · ${Math.round((Date.parse(s.finished_at) - Date.parse(s.started_at)) / 60000)} ${l("min", "د")}`}
                      </span>
                      <span className="mt-2 block font-heading text-lg font-bold leading-6">
                        {s.title ?? t("workout")}
                      </span>
                      {linkedOutsidePage && s.id === expandedHistory && (
                        <span className="block text-xs text-muted-foreground">
                          {l(
                            "Linked workout outside this page's results",
                            "جلسة مرتبطة خارج نتائج هذه الصفحة",
                          )}
                        </span>
                      )}
                      <span className="mt-2 block text-xs font-normal text-muted-foreground">
                        {expandedHistory === s.id
                          ? l("Hide details", "إخفاء التفاصيل")
                          : l("View details", "عرض التفاصيل")}
                      </span>
                    </button>
                    <span className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span>
                        {s.set_logs[0]?.count ?? 0} {t("sets")}{" "}
                        {s.origin === "import" ? l("· Imported", "· مستورد") : ""}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!!w.session || !ready}
                        onClick={() => {
                          void (async () => {
                            const { slots, sets } = await loadWorkoutHistoryDetails(
                              user.id,
                              s.id,
                              AbortSignal.timeout(15000),
                            );
                            const snapshotExercises = slots.map((slot) =>
                              exerciseWithSnapshot(
                                slot.exercise_id,
                                slot.snapshot,
                                (w.exercises as ExerciseGuidance[]).find(
                                  (exercise) => exercise.id === slot.exercise_id,
                                ),
                              ),
                            );
                            if (!snapshotExercises.length)
                              throw new Error(
                                l(
                                  "This workout has no exercises to repeat.",
                                  "لا توجد تمارين لتكرارها.",
                                ),
                              );
                            await controller.start(
                              `${s.title ?? t("workout")} · ${l("Repeat", "تكرار")}`,
                              slots.map((slot, i) => ({
                                id: slot.exercise_id,
                                sets: Math.max(
                                  1,
                                  sets.filter(
                                    (row) =>
                                      row.workout_exercise_id === slot.id &&
                                      row.set_role === "working",
                                  ).length,
                                ),
                                reps: String(
                                  sets.find((row) => row.workout_exercise_id === slot.id)
                                    ?.duration_seconds ??
                                    sets.find((row) => row.workout_exercise_id === slot.id)?.reps ??
                                    "",
                                ),
                                exercise: snapshotExercises[i]!,
                              })),
                              snapshotExercises,
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
