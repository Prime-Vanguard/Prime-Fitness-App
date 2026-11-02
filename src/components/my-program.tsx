import { useState } from "react";
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
    <section className="mt-6 rounded-xl border border-gold/30 bg-card p-5">
      <p className="text-xs font-semibold uppercase tracking-widest text-gold">{t("myProgram")}</p>
      <h2 className="mt-1 font-display text-xl font-bold">
        {data.name} <span className="text-sm text-muted-foreground">v{data.version}</span>
      </h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {Array.from({ length: data.weeks }, (_, i) => i + 1).map((w) => (
          <button
            key={w}
            onClick={() => setWeek(w)}
            className={`rounded-full px-3 py-1 text-xs ${w === week ? "bg-gold text-primary-foreground" : "bg-muted text-muted-foreground"}`}
          >
            {t("week")} {w}
          </button>
        ))}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {days.map((d) => (
          <div key={d} className="rounded-lg border border-border p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold">
                {t("day")} {d}
              </p>
              {canStart && (
                <Button size="sm" onClick={() => startDay(d)}>
                  {t("startDay")}
                </Button>
              )}
            </div>
            <ul className="mt-2 space-y-1 text-sm">
              {items
                .filter((i) => i.day === d)
                .map((i) => (
                  <li key={i.id} className="flex items-center gap-2 py-1">
                    <ExerciseThumbnail
                      exercise={exerciseWithSnapshot(
                        i.exercise_id,
                        i,
                        catalogue.get(i.exercise_id),
                      )}
                      name={(locale === "ar" && i.name_ar) || i.name_en}
                      enabled={guidanceEnabled}
                      onOpen={() =>
                        setDetail(
                          exerciseWithSnapshot(i.exercise_id, i, catalogue.get(i.exercise_id)),
                        )
                      }
                    />
                    <span className="min-w-0 flex-1 break-words">
                      {(locale === "ar" && i.exercises?.name_ar) || i.exercises?.name_en}
                    </span>
                    <span className="max-w-[35%] shrink-0 break-words text-end tabular-nums text-muted-foreground">
                      {i.target_sets} × {i.target_reps}
                    </span>
                  </li>
                ))}
            </ul>
          </div>
        ))}
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
