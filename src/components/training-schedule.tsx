import { loadAssignedTraining } from "@/lib/training-assignment";
import { trainingLabel } from "@/lib/training-labels";
import { useId, useState, type ReactNode } from "react";
import { TodaySessionHero } from "@/features/workouts/today-session-hero";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useTrainingFeatures } from "@/hooks/use-training-features";
import { parseVersionItems } from "@/lib/program-versions";
import type { Exercise, PlanItem } from "@/lib/training-tools";
import { useActivityDay } from "@/hooks/use-activity-day";
import { useI18n } from "@/lib/i18n";
import { Button } from "./ui/button";
import { ExerciseHero } from "./exercise-hero";
import { ExerciseThumbnail } from "./exercise-thumbnail";
import { ExerciseDetail } from "./exercise-discovery";
import { exerciseWithSnapshot, type ExerciseGuidance } from "@/lib/exercise-guidance";
export function TrainingSchedule({
  userId,
  onStart,
  canStart = true,
  compact = false,
  exercises = [],
  guidanceEnabled = false,
  dashboard = false,
  fallback = null,
}: {
  userId: string;
  canStart?: boolean;
  compact?: boolean;
  exercises?: ExerciseGuidance[];
  guidanceEnabled?: boolean;
  dashboard?: boolean;
  fallback?: ReactNode;
  onStart?: (
    title: string,
    plan: PlanItem[],
    exercises: Exercise[],
    context?: { occurrence_id?: string; session_id?: string },
  ) => Promise<void>;
}) {
  const { data: features } = useTrainingFeatures(userId);
  const { locale } = useI18n();
  const l = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const today = useActivityDay();
  const qc = useQueryClient();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [agendaOpen, setAgendaOpen] = useState(false);
  const agendaId = useId();
  const [detail, setDetail] = useState<ExerciseGuidance | null>(null);
  const { data, error: loadError } = useQuery({
    queryKey: ["training-schedule", userId],
    enabled: !!features?.scheduling,
    networkMode: "always",
    queryFn: async () => {
      return loadAssignedTraining(userId);
    },
  });
  if (dashboard && features?.scheduling && data === null && !loadError)
    return (
      <section className="mt-4 rounded-xl bg-card p-4">
        <h2 className="font-heading text-xl font-bold">
          {l("No assigned program yet", "لا يوجد برنامج معيّن بعد")}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {l(
            "Ask your coach for a program. You can still open Train for a free session.",
            "اطلب برنامجاً من مدربك. يمكنك فتح التدريب لبدء جلسة حرة.",
          )}
        </p>
        <Button asChild className="mt-4">
          <Link to="/train">{l("Open training", "فتح التدريب")}</Link>
        </Button>
      </section>
    );
  if (!features?.scheduling || !data?.schedule)
    return loadError ? (
      <p role="alert">{l("Schedule could not be loaded.", "تعذر تحميل الجدول.")}</p>
    ) : (
      fallback
    );
  const next = data.occurrences.find((o) => o.status === "scheduled" || o.status === "in_progress");
  const nextItems = next
    ? parseVersionItems(data.version.items)
        .filter((item) => item.week === next.week && item.day === next.day)
        .sort((a, b) => a.position - b.position)
    : [];
  const visual = (item: (typeof nextItems)[number]) =>
    exerciseWithSnapshot(
      item.exercise_id,
      item,
      exercises.find((exercise) => exercise.id === item.exercise_id),
    );
  async function start(o: NonNullable<typeof data>["occurrences"][number]) {
    if (!data || !onStart || busy) return;
    setBusy(true);
    setError("");
    try {
      const items = parseVersionItems(data.version.items).filter(
        (i) => i.week === o.week && i.day === o.day,
      );
      const ex = items.map((i) => ({
        id: i.exercise_id,
        name_en: i.name_en,
        name_ar: i.name_ar,
        muscle: i.muscle,
        equipment: i.equipment,
        logging_mode: i.logging_mode,
        load_convention: i.load_convention,
      }));
      await onStart(
        `${data.version.name} · W${o.week} D${o.day}`,
        items.map((i, index) => ({
          id: i.exercise_id,
          sets: i.target_sets,
          reps: i.target_reps,
          slot_key: `${data.version.id}:${i.id}`,
          program_version_id: data.version.id,
          exercise: ex[index]!,
        })),
        ex,
        { occurrence_id: o.id, session_id: crypto.randomUUID() },
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (dashboard)
    return next ? (
      <TodaySessionHero
        title={data.version.name}
        active={next.status === "in_progress"}
        restDay={
          data.schedule?.mode === "calendar" &&
          next.status !== "in_progress" &&
          !!next.due_date &&
          next.due_date > today &&
          !data.occurrences.some(
            (row) =>
              row.status === "in_progress" ||
              (row.status === "scheduled" && !!row.due_date && row.due_date <= today),
          )
        }
        guidance={guidanceEnabled}
        subtitle={l(
          `Week ${next.week} · Day ${next.day} · ${nextItems.length} exercises`,
          `الأسبوع ${next.week} · اليوم ${next.day} · ${nextItems.length} تمارين`,
        )}
        exercises={exercises}
        plan={nextItems.map((item) => ({
          id: item.exercise_id,
          slot_key: item.id,
          sets: item.target_sets,
          reps: item.target_reps,
          exercise: {
            id: item.exercise_id,
            name_en: item.name_en,
            name_ar: item.name_ar,
            muscle: item.muscle,
            equipment: item.equipment,
            logging_mode: item.logging_mode,
            load_convention: item.load_convention,
          },
        }))}
      />
    ) : (
      <section className="mt-4 rounded-xl bg-card p-5">
        <h2 className="font-heading text-xl font-bold">
          {l("Program complete", "اكتمل البرنامج")}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {l("Ask your coach for the next assignment.", "اطلب البرنامج التالي من مدربك.")}
        </p>
        <Button asChild className="mt-4">
          <Link to="/train">{l("Open training", "فتح التدريب")}</Link>
        </Button>
      </section>
    );
  return (
    <section
      className={`mt-5 overflow-hidden rounded-2xl bg-card ${compact && nextItems.length > 0 ? "" : "p-4"}`}
    >
      {compact && next && nextItems.length > 0 && (
        <div data-scheduled-preview className="space-y-4 pb-4">
          <ExerciseHero
            exercise={visual(nextItems[0]!)}
            name={(locale === "ar" && nextItems[0]!.name_ar) || nextItems[0]!.name_en}
            enabled={guidanceEnabled}
            onOpen={() => setDetail(visual(nextItems[0]!))}
            overlay={
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  {l("Scheduled next", "الجلسة التالية")}
                </p>
                <h2 className="font-heading text-2xl font-bold leading-tight">
                  {data.version.name}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {l(
                    `Week ${next.week} · Day ${next.day} · ${nextItems.length} exercises`,
                    `الأسبوع ${next.week} · اليوم ${next.day} · ${nextItems.length} تمارين`,
                  )}
                </p>
                {/* Only snapshot muscles are shown; duration/RPE are not inferred. */}
                <ul
                  aria-label={l("Session muscles", "عضلات الجلسة")}
                  className="flex flex-wrap gap-2 pt-1"
                >
                  {[...new Set(nextItems.map((item) => item.muscle))].map((muscle) => (
                    <li
                      key={muscle}
                      className="rounded-full bg-background/80 px-2 py-1 text-xs text-muted-foreground"
                    >
                      {trainingLabel(muscle, locale)}
                    </li>
                  ))}
                </ul>
              </div>
            }
          />
          <ul data-session-exercises className="space-y-2 px-4">
            {nextItems.map((item) => (
              <li key={item.id} className="flex items-center gap-3 rounded-xl bg-row p-3">
                <ExerciseThumbnail
                  exercise={visual(item)}
                  name={(locale === "ar" && item.name_ar) || item.name_en}
                  enabled={guidanceEnabled}
                  onOpen={() => setDetail(visual(item))}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">
                    {(locale === "ar" && item.name_ar) || item.name_en}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {trainingLabel(item.muscle, locale)} ·{" "}
                    <bdi dir="ltr">
                      {item.target_sets} × {item.target_reps}
                    </bdi>
                  </p>
                </div>
              </li>
            ))}
          </ul>
          {next.status === "scheduled" &&
            (onStart ? (
              <Button
                className="mx-4 h-12 w-[calc(100%-2rem)]"
                disabled={!canStart || busy}
                onClick={() => void start(next)}
              >
                {l("Start session", "بدء الجلسة")}
              </Button>
            ) : (
              <Button asChild className="mx-4 h-12 w-[calc(100%-2rem)]">
                <Link to="/train">{l("Open training", "فتح التدريب")}</Link>
              </Button>
            ))}
        </div>
      )}
      {/* Compact Train keeps planning controls secondary; the full program agenda
          and all move/start operations still use the same cached schedule. */}
      <div className={compact && nextItems.length > 0 ? "border-t border-border px-4 py-2" : ""}>
        <h2
          className={compact && !agendaOpen && nextItems.length > 0 ? "sr-only" : "font-semibold"}
        >
          {l("Training agenda", "جدول التدريب")} ·{" "}
          {data.schedule.mode === "rotation"
            ? l("Rotation", "بالتتابع")
            : l("Calendar", "بالتاريخ")}
        </h2>
        <p className={compact && !agendaOpen && nextItems.length > 0 ? "sr-only" : "mt-2 text-sm"}>
          {next
            ? `${l("Next unfinished session", "الجلسة التالية غير المكتملة")}: W${next.week} D${next.day}`
            : l(
                "Program complete. Ask your coach for the next assignment.",
                "اكتمل البرنامج. اطلب البرنامج التالي من مدربك.",
              )}
        </p>
        {error && <p role="alert">{error}</p>}
        {compact && (
          <Button
            variant="ghost"
            className="mt-2"
            aria-expanded={agendaOpen}
            aria-controls={agendaId}
            onClick={() => setAgendaOpen(!agendaOpen)}
          >
            {agendaOpen ? l("Hide agenda", "إخفاء الجدول") : l("View agenda", "عرض الجدول")}
          </Button>
        )}
        <ul
          id={agendaId}
          className={`mt-3 divide-y ${compact && !agendaOpen && nextItems.length > 0 ? "hidden" : ""}`}
        >
          {(compact && !agendaOpen ? (next ? [next] : []) : data.occurrences).map((o) => (
            <li
              key={o.id}
              className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
            >
              <span>
                W{o.week} D{o.day} · {trainingLabel(o.status, locale)}{" "}
                {o.due_date && o.due_date < today && o.status === "scheduled"
                  ? l("· Overdue", "· متأخر")
                  : ""}
              </span>
              {o.status === "scheduled" && (
                <>
                  {(!compact || agendaOpen) && (
                    <MoveSession
                      id={o.id}
                      date={o.due_date}
                      label={l(`Move W${o.week} D${o.day}`, `نقل أسبوع ${o.week} يوم ${o.day}`)}
                      onSaved={() =>
                        void qc.invalidateQueries({ queryKey: ["training-schedule", userId] })
                      }
                    />
                  )}
                  {onStart ? (
                    <Button
                      size="sm"
                      disabled={
                        !canStart ||
                        busy ||
                        (data.schedule!.mode === "rotation" && o.id !== next?.id)
                      }
                      onClick={() => void start(o)}
                    >
                      {l("Start session", "بدء الجلسة")}
                    </Button>
                  ) : (
                    <Link to="/train">{l("Open training", "فتح التدريب")}</Link>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      </div>
      {detail && guidanceEnabled && (
        <ExerciseDetail
          key={detail.id}
          exercise={detail}
          startMedia
          onClose={() => setDetail(null)}
        />
      )}
    </section>
  );
}

function MoveSession({
  id,
  date,
  label,
  onSaved,
}: {
  id: string;
  date: string | null;
  label: string;
  onSaved: () => void;
}) {
  const { locale } = useI18n();
  const [editing, setEditing] = useState(false),
    [value, setValue] = useState(date ?? "");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <div className="space-y-2">
      <Button
        variant="outline"
        onClick={() => {
          setValue(date ?? "");
          setEditing(!editing);
        }}
      >
        {label}
      </Button>
      {editing && (
        <div className="flex flex-wrap gap-2">
          <input
            aria-label={label}
            type="date"
            className="min-h-11 rounded-md border bg-background p-2"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <Button
            disabled={busy || !value}
            onClick={() => {
              setBusy(true);
              setError("");
              void Promise.resolve(
                supabase.rpc("move_session_occurrence", { _id: id, _date: value }),
              )
                .then((r) => {
                  if (r.error) setError(r.error.message);
                  else {
                    setEditing(false);
                    onSaved();
                  }
                })
                .catch((e: Error) => setError(e.message))
                .finally(() => setBusy(false));
            }}
          >
            {locale === "ar" ? "حفظ" : "Save"}
          </Button>
          <Button variant="ghost" disabled={busy} onClick={() => setEditing(false)}>
            {locale === "ar" ? "إلغاء" : "Cancel"}
          </Button>
          <p className="w-full text-xs text-muted-foreground">
            {locale === "ar"
              ? "لا تتغير مواعيد الجلسات الأخرى."
              : "Other sessions keep their dates."}
          </p>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
