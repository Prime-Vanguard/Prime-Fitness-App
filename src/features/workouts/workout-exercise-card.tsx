import type { ReactNode } from "react";
import { Check, ChevronDown, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ExerciseThumbnail } from "@/components/exercise-thumbnail";
import { useI18n } from "@/lib/i18n";
import { trainingLabel } from "@/lib/training-labels";
import { workingCount } from "@/lib/workout-editor";
import { displayWeight, formatMeasure, weightUnit, type Units } from "@/lib/units";
import type { WorkoutSet } from "@/lib/workout-store";
import type { ExerciseGuidance } from "@/lib/exercise-guidance";

/** Card presentation consumes rows and callbacks, never the persistence controller. */
export function WorkoutExerciseCard({
  slot,
  cardExercise,
  name,
  rows,
  active,
  locked,
  busy,
  units,
  guidance,
  supersetPosition,
  onSelect,
  onOpenMedia,
  onEdit,
  onDelete,
  children,
}: {
  slot: { id: string; key: string; sets: number; reps: string };
  cardExercise: ExerciseGuidance | undefined;
  name: string;
  rows: WorkoutSet[];
  active: boolean;
  locked: boolean;
  busy: boolean;
  units: Units;
  guidance: boolean;
  supersetPosition: number;
  onSelect: () => void;
  onOpenMedia: () => void;
  onEdit: (row: WorkoutSet) => void;
  onDelete: (row: WorkoutSet) => Promise<void>;
  children: ReactNode;
}) {
  const { locale, t } = useI18n();
  const l = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const count = workingCount(rows),
    wu = weightUnit(units);
  return (
    <section
      data-exercise-slot={slot.key}
      data-exercise-id={slot.id}
      className={`overflow-hidden rounded-2xl border bg-card ${active ? "border-gold/60" : "border-border"}`}
    >
      <div className="flex items-center gap-3 p-4">
        <ExerciseThumbnail
          exercise={cardExercise}
          name={name}
          enabled={guidance}
          onOpen={onOpenMedia}
        />
        <button
          className="flex min-h-16 min-w-0 flex-1 items-center justify-between gap-3 text-start focus-visible:ring-2 focus-visible:ring-gold"
          aria-expanded={active}
          onClick={() => onSelect()}
        >
          <span className="min-w-0">
            <span className="block font-semibold">{name}</span>
            {supersetPosition >= 0 && (
              <span className="text-xs font-semibold text-gold">
                {supersetPosition === 0 ? "A1" : "A2"} · {l("Superset", "سوبرست")}
              </span>
            )}
            <span className="mt-1 block text-xs text-muted-foreground">
              {count}
              {slot.sets ? ` / ${slot.sets}` : ""} {t("sets")}
              {slot.reps ? ` · ${slot.reps} ${l("target", "الهدف")}` : ""}
            </span>
          </span>
          <ChevronDown
            className={`h-5 w-5 shrink-0 ${active ? "rotate-180 text-gold" : "text-muted-foreground"}`}
          />
        </button>
      </div>
      {active && (
        <div className="space-y-4 border-t border-border p-4">
          <p className="text-xs text-muted-foreground">
            {trainingLabel(cardExercise?.load_convention ?? "external_total", locale)}
            {cardExercise?.equipment ? ` · ${cardExercise.equipment}` : ""}
          </p>
          {!!rows.length && (
            <ul className="divide-y divide-border">
              {rows.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
                >
                  <span>
                    <Check className="me-2 inline h-4 w-4 text-success" />
                    {row.set_number} ·{" "}
                    {row.logging_mode === "timed" ? `${row.duration_seconds}s` : row.reps} ×{" "}
                    {row.weight_kg == null
                      ? "—"
                      : formatMeasure(displayWeight(row.weight_kg, units))}{" "}
                    {wu}
                    {row.rpe != null ? ` · RPE ${row.rpe}` : ""}
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {trainingLabel(row.set_role ?? "working", locale)} ·{" "}
                      {trainingLabel(row.side ?? "bilateral", locale)}
                      {row.sync === "pending" ? ` · ${l("On device", "على الجهاز")}` : ""}
                    </span>
                  </span>
                  {!locked && (
                    <span className="flex">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={l(
                          `Edit set ${row.set_number}`,
                          `تعديل المجموعة ${row.set_number}`,
                        )}
                        onClick={() => onEdit(row)}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={busy}
                        aria-label={l(
                          `Delete set ${row.set_number}`,
                          `حذف المجموعة ${row.set_number}`,
                        )}
                        onClick={() => void onDelete(row)}
                      >
                        <Trash2 />
                      </Button>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
          {children}
        </div>
      )}
    </section>
  );
}
