import { SelectionIndicator } from "./selection-indicator";
import { useState } from "react";
import { LockKeyhole, CalendarDays, ChevronDown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { parseVersionItems } from "@/lib/program-versions";
import type { Exercise, PlanItem } from "@/lib/training-tools";
import { exerciseWithSnapshot, type ExerciseGuidance } from "@/lib/exercise-guidance";
import { ExerciseThumbnail } from "./exercise-thumbnail";
import { ExerciseDetail } from "./exercise-discovery";

export function MyProgram({
  userId,
  canStart,
  onStart,
  exercises = [],
  guidanceEnabled = false,
}: {
  userId: string;
  canStart: boolean;
  onStart: (title: string, plan: PlanItem[], exercises?: Exercise[]) => Promise<void>;
  exercises?: ExerciseGuidance[];
  guidanceEnabled?: boolean;
}) {
  const { t, locale } = useI18n();
  const [week, setWeek] = useState(1);
  const [detail, setDetail] = useState<ExerciseGuidance | null>(null);
  const catalogue = new Map(exercises.map((exercise) => [exercise.id, exercise]));
  const { data, error, isPending } = useQuery({
    queryKey: ["my-program", userId],
    queryFn: async () => {
      const assignment = await supabase
        .from("program_assignments")
        .select("id,program_version_id")
        .eq("member_id", userId)
        .eq("active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (assignment.error) throw assignment.error;
      if (!assignment.data) return null;
      const version = await supabase
        .from("program_versions")
        .select("*")
        .eq("id", assignment.data.program_version_id)
        .single();
      if (version.error) throw version.error;
      return {
        ...version.data,
        program_items: parseVersionItems(version.data.items).map((i) => ({
          ...i,
          exercises: { name_en: i.name_en, name_ar: i.name_ar },
        })),
      };
    },
  });
  if (error)
    return (
      <p role="alert" className="mt-6 text-destructive">
        {error.message}
      </p>
    );
  if (isPending)
    return <p role="status">{locale === "ar" ? "..." : "Loading assigned program..."}</p>;
  if (!data)
    return (
      <p className="mt-6 rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
        {t("noProgram")}
      </p>
    );
  const items = (data.program_items ?? [])
    .filter((i) => i.week === week)
    .sort((a, b) => a.day - b.day || a.position - b.position);
  const days = [...new Set(items.map((i) => i.day))];
  async function startDay(d: number) {
    const dayItems = items.filter((i) => i.day === d);
    try {
      await onStart(
        `${data!.name} v${data!.version} · W${week} D${d}`,
        dayItems.map((i) => ({
          id: i.exercise_id,
          slot_key: `${data!.id}:${i.id}`,
          program_version_id: data!.id,
          sets: i.target_sets,
          reps: i.target_reps,
          exercise: {
            id: i.exercise_id,
            name_en: i.name_en,
            name_ar: i.name_ar,
            muscle: i.muscle,
            equipment: i.equipment,
            logging_mode: i.logging_mode,
            load_convention: i.load_convention,
          },
        })),
        dayItems.map((i) => ({
          id: i.exercise_id,
          name_en: i.name_en,
          name_ar: i.name_ar,
          muscle: i.muscle,
          equipment: i.equipment,
          logging_mode: i.logging_mode,
          load_convention: i.load_convention,
        })),
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  }
  return (
    <section className="mt-5 space-y-4" data-stitch-program>
      <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
        <LockKeyhole aria-hidden className="size-5 shrink-0 text-gold" />
        <div className="min-w-0">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gold">
            {locale === "ar" ? "خطة معتمدة من مدربك" : "Coach assignment · Frozen program"}
          </h2>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            {locale === "ar"
              ? "الأهداف من نسخة برنامجك المعتمدة. تغيير موعد جلسة لا يغيّر البرنامج أو سجلك السابق."
              : "Targets come from your assigned program version. Moving a session preserves the program and its history."}
          </p>
        </div>
      </div>
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>{locale === "ar" ? "البرنامج التدريبي" : "Assigned training block"}</span>
          <span className="text-gold">
            {t("week")} {week}/{data.weeks}
          </span>
        </div>
        <h2 className="mt-2 font-heading text-xl font-bold">{data.name}</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {locale === "ar" ? "نسخة البرنامج" : "Program version"} {data.version}
        </p>
        <nav
          aria-label={locale === "ar" ? "أسابيع البرنامج" : "Program weeks"}
          className="sliding-selection mt-4 flex gap-1 overflow-x-auto pb-1"
        >
          {/* Week navigation does not modify the frozen prescription or selected session. */}
          <SelectionIndicator />
          {Array.from({ length: data.weeks }, (_, i) => i + 1).map((value) => (
            <button
              type="button"
              key={value}
              aria-pressed={week === value}
              aria-label={t("week") + " " + value}
              onClick={() => setWeek(value)}
              className="flex min-h-11 min-w-11 flex-1 flex-col justify-center gap-2 rounded-md px-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
            >
              <span
                aria-hidden
                className={
                  "h-1.5 w-full rounded-full " + (week === value ? "bg-gold" : "bg-raised")
                }
              />
              <span
                className={week === value ? "font-bold text-foreground" : "text-muted-foreground"}
              >
                {locale === "ar" ? `${t("week")} ${value}` : `W${value}`}
              </span>
            </button>
          ))}
        </nav>
      </div>
      <div className="flex items-center justify-between gap-3 pt-2">
        <h3 className="font-heading text-sm font-bold">
          {locale === "ar" ? "جدول الأسبوع التدريبي" : "Weekly training schedule"}
        </h3>
        <span className="text-xs text-muted-foreground">
          {days.length} {locale === "ar" ? "جلسات مخططة" : "planned sessions"}
        </span>
      </div>
      <div className="space-y-3">
        {days.map((day, index) => {
          const sessionItems = items.filter((item) => item.day === day);
          const plannedSets = sessionItems.reduce((total, item) => total + item.target_sets, 0);
          return (
            <details
              key={week + ":" + day}
              open={index === 0}
              className="group rounded-xl border border-border bg-card open:border-gold"
              data-program-day
            >
              <summary className="flex min-h-20 cursor-pointer list-none items-center gap-3 p-4 [&::-webkit-details-marker]:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-background text-muted-foreground">
                  <CalendarDays aria-hidden className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs uppercase text-muted-foreground">
                    {t("week")} {week}
                  </span>
                  <span className="mt-1 block font-heading font-bold">
                    {t("day")} {day}
                  </span>
                </span>
                <span className="text-end text-xs text-muted-foreground">
                  <span className="block text-foreground">
                    {plannedSets} {t("sets")}
                  </span>
                  <span className="mt-1 block">
                    {sessionItems.length} {locale === "ar" ? "تمارين" : "exercises"}
                  </span>
                </span>
                <ChevronDown
                  aria-hidden
                  className="size-4 shrink-0 text-muted-foreground group-open:rotate-180"
                />
              </summary>
              <div className="space-y-3 px-4 pb-4">
                <ul className="space-y-2 rounded-lg bg-background p-3 text-sm">
                  {sessionItems.map((item) => (
                    <li key={item.id} className="flex items-center gap-3">
                      <ExerciseThumbnail
                        exercise={exerciseWithSnapshot(
                          item.exercise_id,
                          item,
                          catalogue.get(item.exercise_id),
                        )}
                        name={(locale === "ar" && item.name_ar) || item.name_en}
                        enabled={guidanceEnabled}
                        onOpen={() =>
                          setDetail(
                            exerciseWithSnapshot(
                              item.exercise_id,
                              item,
                              catalogue.get(item.exercise_id),
                            ),
                          )
                        }
                      />
                      <span className="min-w-0 flex-1 break-words">
                        <span className="block">
                          {(locale === "ar" && item.name_ar) || item.name_en}
                        </span>
                        {/* Keep targets below the frozen name so narrow cards do not squeeze it into a third column. */}
                        <bdi
                          dir="ltr"
                          className="mt-1 block text-xs tabular-nums text-muted-foreground"
                        >
                          {item.target_sets} × {item.target_reps}
                        </bdi>
                      </span>
                    </li>
                  ))}
                </ul>
                {canStart && (
                  <Button className="h-12 w-full" onClick={() => void startDay(day)}>
                    {t("startDay")}
                  </Button>
                )}
              </div>
            </details>
          );
        })}
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
