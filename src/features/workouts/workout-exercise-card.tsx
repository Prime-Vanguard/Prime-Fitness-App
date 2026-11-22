import { useRecordFeedback } from "@/hooks/use-record-feedback";
import { muscleLabel } from "@/lib/muscle-volume";
import { formatDuration } from "@/lib/duration";
import { useState, type ReactNode } from "react";
import {
  Check,
  ChevronDown,
  Pencil,
  Trash2,
  Dumbbell,
  MoreVertical,
  ListChecks,
  Info,
  History,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ExerciseThumbnail } from "@/components/exercise-thumbnail";
import { useI18n } from "@/lib/i18n";
import { trainingLabel } from "@/lib/training-labels";
import { workingCount } from "@/lib/workout-editor";
import { displayWeight, formatMeasure, weightUnit, type Units } from "@/lib/units";
import type { WorkoutSet } from "@/lib/workout-store";
import type { ExerciseGuidance } from "@/lib/exercise-guidance";

const EQUIPMENT_AR: Record<string, string> = {
  barbell: "بار",
  dumbbell: "دمبل",
  machine: "جهاز",
  cable: "كابل",
  kettlebell: "كيتل بل",
  bodyweight: "وزن الجسم",
  band: "مطاط",
};

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
  history,
  primaryAction,
  actions,
  onOptions,
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
  history?: ReactNode;
  primaryAction?: ReactNode;
  actions?: ReactNode;
  onOptions?: () => void;
}) {
  const { locale, t } = useI18n();
  const l = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const count = workingCount(rows),
    wu = weightUnit(units);
  const [tab, setTab] = useState<"log" | "about" | "history">("log");
  const feedbackRef = useRecordFeedback(
    slot.key,
    rows.map((row) => ({
      id: row.id,
      value: JSON.stringify([
        row.reps,
        row.weight_kg,
        row.duration_seconds,
        row.rpe,
        row.set_role,
        row.side,
      ]),
    })),
  );
  return (
    <section
      data-exercise-slot={slot.key}
      data-exercise-id={slot.id}
      className={active ? "space-y-4" : "overflow-hidden rounded-xl bg-card"}
    >
      <Tabs
        value={tab}
        onValueChange={(value) => setTab(value as typeof tab)}
        dir={locale === "ar" ? "rtl" : "ltr"}
      >
        <div data-exercise-preview className="rounded-xl bg-card p-4">
          <div className="flex items-center gap-3">
            {
              <ExerciseThumbnail
                exercise={cardExercise}
                name={name}
                enabled={guidance}
                onOpen={onOpenMedia}
              />
            }
            <button
              className="flex min-h-7 min-w-0 flex-1 items-center justify-between gap-3 text-start focus-visible:ring-2 focus-visible:ring-gold"
              aria-expanded={active}
              onClick={() => {
                setTab("log");
                onSelect();
              }}
            >
              <span className="min-w-0">
                <span
                  className={`block font-heading font-bold ${active ? "text-xl leading-7" : "text-base leading-6"}`}
                >
                  {name}
                </span>
                {supersetPosition >= 0 && (
                  <span className="text-xs font-semibold text-gold">
                    {supersetPosition === 0 ? "A1" : "A2"} · {l("Superset", "سوبرست")}
                  </span>
                )}
                <span
                  className={`mt-1 text-xs text-muted-foreground ${active ? "sr-only" : "block"}`}
                >
                  {count}
                  {slot.sets ? ` / ${slot.sets}` : ""} {t("sets")}
                </span>
              </span>
              {!active && (
                <ChevronDown
                  className={`h-5 w-5 shrink-0 ${active ? "rotate-180 text-gold" : "text-muted-foreground"}`}
                />
              )}
            </button>
            {active && onOptions && (
              <Button
                variant="ghost"
                size="icon"
                className="-mt-4 self-start text-muted-foreground"
                aria-label={l("Exercise options", "خيارات التمرين")}
                onClick={() => {
                  setTab("log");
                  onOptions();
                }}
              >
                <MoreVertical />
              </Button>
            )}
          </div>
          {active && (
            <div className="mt-1 space-y-3">
              <p className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                {cardExercise?.muscle && (
                  <span className="rounded-full bg-background px-3 py-1">
                    {muscleLabel(cardExercise.muscle, locale)}
                  </span>
                )}
                {cardExercise?.equipment && (
                  <span className="rounded-full bg-background px-3 py-1 capitalize">
                    {locale === "ar"
                      ? (EQUIPMENT_AR[cardExercise.equipment.toLowerCase()] ??
                        cardExercise.equipment)
                      : cardExercise.equipment}
                  </span>
                )}
              </p>
              <TabsList
                aria-label={l("Exercise details", "تفاصيل التمرين")}
                className="flex h-auto w-full gap-1 rounded-lg bg-background p-1"
              >
                <TabsTrigger value="log" className="min-h-11 flex-1">
                  <ListChecks aria-hidden className="me-1 size-4 text-gold" />
                  {l("Log", "التسجيل")}
                </TabsTrigger>
                {guidance && (
                  <TabsTrigger value="about" className="min-h-11 flex-1">
                    <Info aria-hidden className="me-1 size-4" />
                    {l("Guide", "الشرح")}
                  </TabsTrigger>
                )}
                <TabsTrigger value="history" className="min-h-11 flex-1">
                  <History aria-hidden className="me-1 size-4" />
                  {l("History", "السجل")}
                </TabsTrigger>
              </TabsList>
            </div>
          )}
        </div>
        {active && (
          <div className="mt-4">
            <TabsContent value="log" forceMount hidden={tab !== "log"} className="space-y-4">
              <div
                ref={feedbackRef}
                data-execution-table
                className="space-y-3 rounded-xl bg-card p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="flex items-center gap-2 text-sm font-bold">
                    <Dumbbell aria-hidden className="size-4 text-gold" />
                    {l("Sets", "المجموعات")}
                  </h3>
                  {(slot.sets > 0 || slot.reps) && (
                    <span className="text-xs text-muted-foreground">
                      {l("Target", "الهدف")}{" "}
                      <bdi dir="ltr">
                        {slot.sets} × {slot.reps || "—"}
                      </bdi>
                    </span>
                  )}
                </div>
                {/* Only unusual load conventions need explaining. */}
                {cardExercise?.load_convention &&
                  cardExercise.load_convention !== "external_total" && (
                    <p className="text-xs text-muted-foreground">
                      {trainingLabel(cardExercise.load_convention, locale)}
                    </p>
                  )}
                {!!rows.length && (
                  <ul className="space-y-1" aria-label={l("Completed sets", "المجموعات المكتملة")}>
                    {rows.map((row) => (
                      <li
                        key={row.id}
                        data-feedback-record={row.id}
                        className="flex min-h-11 items-center gap-3 rounded-lg bg-success/5 ps-3 text-sm"
                      >
                        <Check aria-hidden className="h-4 w-4 shrink-0 text-success" />
                        <span className="w-4 shrink-0 text-center text-xs text-muted-foreground">
                          {row.set_number}
                        </span>
                        <span className="min-w-0 flex-1">
                          <bdi dir="ltr" className="font-semibold tabular-nums">
                            {row.weight_kg != null &&
                              `${formatMeasure(displayWeight(row.weight_kg, units))} ${wu} × `}
                            {row.logging_mode === "timed"
                              ? formatDuration(row.duration_seconds ?? 0)
                              : row.weight_kg != null
                                ? row.reps
                                : l(`${row.reps} reps`, `${row.reps} تكرار`)}
                          </bdi>
                          {/* Only say what differs from a normal working set. */}
                          {[
                            (row.set_role ?? "working") !== "working" &&
                              trainingLabel(row.set_role!, locale),
                            (row.side ?? "bilateral") !== "bilateral" &&
                              trainingLabel(row.side!, locale),
                            row.rpe != null && `RPE ${row.rpe}`,
                            row.sync === "pending" && l("On device", "على الجهاز"),
                          ]
                            .filter(Boolean)
                            .map((tag) => (
                              <span
                                key={String(tag)}
                                className="ms-2 text-xs text-muted-foreground"
                              >
                                {tag}
                              </span>
                            ))}
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
              {primaryAction}
              {actions}
            </TabsContent>
            {guidance && (
              <TabsContent
                value="about"
                forceMount
                hidden={tab !== "about"}
                className="space-y-3 rounded-2xl bg-card p-4"
              >
                <p className="text-sm text-[#CBD5E1]">
                  {l(
                    "Review setup, instructions and the demonstration before your set. Animations play only when opened.",
                    "راجع الإعداد والتعليمات والشرح قبل المجموعة. تُشغّل الرسوم المتحركة عند فتحها فقط.",
                  )}
                </p>
                <Button variant="outline" onClick={onOpenMedia}>
                  {l("Open exercise guidance", "فتح شرح التمرين")}
                </Button>
              </TabsContent>
            )}
            <TabsContent
              value="history"
              forceMount
              hidden={tab !== "history"}
              className="space-y-3 rounded-2xl bg-card p-4"
            >
              <h3 className="text-sm font-semibold">
                {l("Previous completed performance", "الأداء المكتمل السابق")}
              </h3>
              {history ?? (
                <p className="text-sm text-muted-foreground">
                  {l("Previous performance is unavailable.", "الأداء السابق غير متاح.")}
                </p>
              )}
            </TabsContent>
          </div>
        )}
      </Tabs>
    </section>
  );
}
