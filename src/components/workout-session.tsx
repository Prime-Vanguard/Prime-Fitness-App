import { useWorkoutEditor } from "@/features/workouts/use-workout-editor";
import { WorkoutExerciseOptions } from "@/features/workouts/workout-exercise-options";
import { WorkoutExerciseCard } from "@/features/workouts/workout-exercise-card";
import { useWorkoutActions } from "@/features/workouts/use-workout-actions";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check, Download, MoreHorizontal, Plus } from "lucide-react";
import type { WorkoutSessionController } from "@/features/workouts/types";
import { DraftFields, SetEditor } from "@/features/workouts/workout-set-editor";
import { SessionTime, HoldTimer, RestTimer } from "@/features/workouts/workout-timers";
import { WorkoutReview } from "@/features/workouts/workout-review";
import { useWorkoutWakeLock } from "@/features/workouts/use-workout-wake-lock";
import { useUnits } from "@/hooks/use-units";
import { useTrainingFeatures } from "@/hooks/use-training-features";
import { useI18n } from "@/lib/i18n";
import { pendingCount, type WorkoutSet } from "@/lib/workout-store";
import {
  editWorkoutSet,
  revisionOf,
  workingCount,
  workoutSlots,
  slotReference,
  supersetPair,
  supersetCandidates,
  pairSuperset,
} from "@/lib/workout-editor";
import { displayWeight, weightUnit, formatMeasure } from "@/lib/units";
import { trainingLabel } from "@/lib/training-labels";
import type { ExerciseGuidance } from "@/lib/exercise-guidance";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "./ui/sheet";
import { ExerciseDiscovery, ExerciseDetail } from "./exercise-discovery";
import { TrainingSuggestion } from "./training-suggestion";
import { PlannedSetRows } from "@/features/workouts/planned-set-rows";
import { useSlotRest } from "@/hooks/use-workout-references";

type Controller = WorkoutSessionController;

export function WorkoutSession({ controller }: { controller: Controller }) {
  const { workout: w, change, retry, online } = controller;
  const { locale, t } = useI18n();
  const l = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const units = useUnits(w.userId),
    wu = weightUnit(units);
  const { data: features } = useTrainingFeatures(w.userId);
  const { busy, error, setError, run, remove, completePlannedSet } = useWorkoutActions(controller);
  const editor = useWorkoutEditor({ controller, units, onError: setError, run });
  const {
    selection,
    exerciseId,
    activePlan,
    selected,
    timed,
    previous,
    draft,
    plannedInitial,
    updateDraft,
    pick,
    logging,
  } = editor;
  const { role, side } = logging;
  const [library, setLibrary] = useState<"add" | "swap" | null>(null);
  const [detail, setDetail] = useState<{ exercise: ExerciseGuidance; play: boolean } | null>(null);
  const [tools, setTools] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [review, setReview] = useState(false),
    [discard, setDiscard] = useState(false);
  const [editing, setEditing] = useState<WorkoutSet | null>(null);
  const restPreference = useSlotRest(w.userId, slotReference(exerciseId, selection));
  const restSeconds = restPreference.seconds;
  const sets = w.sets.filter((s) => s.sync !== "deleted");
  const locked = w.phase !== "active";
  const slots = workoutSlots(w);
  if (!slots.some((p) => p.id === exerciseId && p.key === selection))
    slots.push({ id: exerciseId, key: selection, sets: 0, reps: "" });
  const name = (id: string, slot?: string) => {
    const e =
      (slot === undefined
        ? undefined
        : w.plan.find((p) => p.id === id && (p.slot_key ?? "") === slot)?.exercise) ??
      w.exercises.find((e) => e.id === id);
    return (locale === "ar" && e?.name_ar) || e?.name_en || l("Exercise", "تمرين");
  };
  const currentRows = sets.filter(
    (s) => s.exercise_id === exerciseId && (s.slot_key ?? "") === selection,
  );

  useWorkoutWakeLock();

  const group = supersetPair(w),
    reference = slotReference(exerciseId, selection);
  const groupIndex = group.indexOf(reference);

  function exportWorkout() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(w, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `prime-fitness-workout-${w.session!.id}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="space-y-4 py-4" data-workout-session>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-widest text-gold">
            {t("workout")}
          </p>
          <h1 className="mt-1 text-xl font-bold">{w.session!.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {workingCount(sets)} {l("working sets", "مجموعات عمل")} ·{" "}
            <SessionTime started={w.session!.started_at} />
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link to="/today">{l("Minimize", "تصغير")}</Link>
          </Button>
          {!locked && (
            <Button disabled={busy || !sets.length} onClick={() => setReview(true)}>
              {t("finishWorkout")}
            </Button>
          )}
        </div>
      </header>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted/40 px-3 py-2 text-sm">
        <span role="status">
          {!online ? l("Offline · ", "دون اتصال · ") : ""}
          {pendingCount(w)
            ? l("Saved on device · waiting to sync", "محفوظ على الجهاز · بانتظار المزامنة")
            : l("Synced", "تمت المزامنة")}
        </span>
        <Button variant="ghost" onClick={() => void retry()}>
          {l("Retry sync", "إعادة المزامنة")}
        </Button>
      </div>
      {(error || w.error) && (
        <p
          role="alert"
          className="rounded-xl border border-destructive/50 p-3 text-sm text-destructive"
        >
          {error || w.error}
        </p>
      )}
      {w.error?.includes("another device") && (
        <Button
          variant="outline"
          disabled={busy}
          onClick={() =>
            void run(() =>
              change((current) => {
                const id = crypto.randomUUID(),
                  ids = new Map(current.sets.map((s) => [s.id, crypto.randomUUID()]));
                const { occurrence_id: _occurrence, ...session } = current.session!;
                return {
                  ...current,
                  session: { ...session, id, synced: false },
                  phase: "active",
                  finishedAt: null,
                  error: null,
                  sets: current.sets
                    .filter((s) => s.sync !== "deleted")
                    .map((s) => ({
                      ...s,
                      id: ids.get(s.id)!,
                      session_id: id,
                      root_set_id: s.root_set_id ? (ids.get(s.root_set_id) ?? null) : null,
                      sync: "pending",
                    })),
                };
              }),
            )
          }
        >
          {l("Convert draft to standalone workout", "تحويل المسودة إلى جلسة مستقلة")}
        </Button>
      )}
      {locked && (
        <p role="status">
          {l(
            "Workout saved. Waiting for the server to confirm. Rewards update after confirmation.",
            "تم حفظ التمرين. بانتظار تأكيد الخادم وتحديث المكافآت.",
          )}
        </p>
      )}
      <div className="space-y-3">
        {slots
          .filter((p) => p.id)
          .map((slot) => {
            const rows = sets.filter(
              (s) => s.exercise_id === slot.id && (s.slot_key ?? "") === slot.key,
            );
            const active = slot.key === selection && slot.id === exerciseId;
            const count = workingCount(rows);
            const catalogue = w.exercises.find((e) => e.id === slot.id);
            const cardExercise = (
              slot.exercise ? { ...catalogue, ...slot.exercise } : catalogue
            ) as ExerciseGuidance | undefined;
            return (
              <WorkoutExerciseCard
                key={`${slot.key}:${slot.id}`}
                slot={slot}
                cardExercise={cardExercise}
                name={name(slot.id, slot.key)}
                rows={rows}
                active={active}
                locked={locked}
                busy={busy}
                units={units}
                guidance={features?.guidance === true}
                supersetPosition={group.indexOf(slotReference(slot.id, slot.key))}
                onSelect={() => pick(slot.id, slot.key)}
                onOpenMedia={() => {
                  if (cardExercise) setDetail({ exercise: cardExercise, play: true });
                }}
                onEdit={setEditing}
                onDelete={remove}
              >
                {active && !locked && (
                  <>
                    <div className="flex flex-wrap gap-2">
                      {features?.guidance && (
                        <Button
                          variant="outline"
                          onClick={() => {
                            if (selected)
                              setDetail({
                                exercise: selected as ExerciseGuidance,
                                play: false,
                              });
                          }}
                        >
                          {l("Instructions", "طريقة الأداء")}
                        </Button>
                      )}
                      <Button variant="outline" onClick={() => setLibrary("swap")}>
                        {l("Swap exercise", "استبدال التمرين")}
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => setTools(!tools)}
                        aria-expanded={tools}
                      >
                        <MoreHorizontal />
                        {l("Exercise options", "خيارات التمرين")}
                      </Button>
                    </div>
                    {!!activePlan?.sets && (
                      <>
                        {previous.data && (
                          <p className="text-xs text-muted-foreground">
                            {l("Last completed set", "آخر مجموعة مكتملة")}:{" "}
                            {previous.data.duration_seconds != null
                              ? `${previous.data.duration_seconds}s`
                              : previous.data.reps}{" "}
                            ×{" "}
                            {previous.data.weight_kg == null
                              ? "—"
                              : formatMeasure(displayWeight(previous.data.weight_kg, units))}{" "}
                            {wu} ·{" "}
                            {new Date(previous.data.created_at).toLocaleDateString(
                              locale === "ar" ? "ar-EG" : "en-GB",
                            )}
                            {previous.data.cached
                              ? l(" · Cached on device", " · نسخة على الجهاز")
                              : ""}
                            {previous.data.workout_sessions.origin === "import"
                              ? l(" · Imported", " · مستورد")
                              : ""}
                          </p>
                        )}
                        {!online && !previous.isPending && !previous.data && (
                          <p className="text-xs text-muted-foreground">
                            {l(
                              "Previous performance is not available offline for this slot.",
                              "السجل السابق لهذه الخانة غير متاح دون اتصال.",
                            )}
                          </p>
                        )}
                        <PlannedSetRows
                          controller={controller}
                          exercise={exerciseId}
                          slot={selection}
                          units={units}
                          timed={timed}
                          initial={plannedInitial}
                          ready={!previous.isPending || !online}
                          disabled={busy || !restPreference.ready}
                          onComplete={(id, value) =>
                            completePlannedSet({
                              id,
                              value,
                              exerciseId,
                              selection,
                              units,
                              restSeconds,
                              onNext: pick,
                            })
                          }
                        />
                        <Button
                          variant="ghost"
                          aria-expanded={advanced}
                          onClick={() => setAdvanced(!advanced)}
                        >
                          {l("Additional / advanced set", "مجموعة إضافية / متقدمة")}
                        </Button>
                      </>
                    )}
                    {(!activePlan?.sets || advanced) && (
                      <div className="rounded-xl bg-background/50 p-3">
                        <p className="mb-3 text-sm font-semibold">
                          {l("Next set", "المجموعة التالية")} {Math.floor(count) + 1}
                          {role !== "working" ? ` · ${trainingLabel(role, locale)}` : ""}
                          {side !== "bilateral" ? ` · ${trainingLabel(side, locale)}` : ""}
                        </p>
                        <DraftFields
                          draft={draft}
                          onChange={updateDraft}
                          timed={timed}
                          units={units}
                        />
                        <p className="mt-2 text-xs text-muted-foreground">
                          {l(
                            "RPE is effort from 1–10. Leave blank if unsure; your coach's progression rule may hold.",
                            "RPE هو الجهد من ١ إلى ١٠. اتركه فارغاً إن لم تتأكد؛ قد يتوقف اقتراح التدرج.",
                          )}
                        </p>
                        {previous.data && (
                          <button
                            className="mt-3 min-h-11 text-start text-xs text-gold"
                            onClick={editor.copyPrevious}
                          >
                            {l("Use previous", "استخدام السابق")}:{" "}
                            {previous.data.duration_seconds != null
                              ? `${previous.data.duration_seconds}s`
                              : previous.data.reps}{" "}
                            ×{" "}
                            {previous.data.weight_kg == null
                              ? "—"
                              : formatMeasure(displayWeight(previous.data.weight_kg, units))}{" "}
                            {wu} ·{" "}
                            {new Date(previous.data.created_at).toLocaleDateString(
                              locale === "ar" ? "ar-EG" : "en-GB",
                            )}
                            {previous.data.workout_sessions?.origin === "import"
                              ? l(" · Imported", " · مستورد")
                              : ""}
                            {previous.data.cached
                              ? l(" · Cached on device", " · نسخة على الجهاز")
                              : ""}
                            {selection && previous.data.match === "exercise"
                              ? l(" · Other compatible session", " · جلسة أخرى متوافقة")
                              : ""}
                          </button>
                        )}
                        {previous.isError && (
                          <p className="mt-2 text-xs text-muted-foreground">
                            {l(
                              "Previous performance unavailable. You can still log a set.",
                              "السجل السابق غير متاح. يمكنك تسجيل المجموعة.",
                            )}
                          </p>
                        )}
                        {!online && !previous.isPending && !previous.data && (
                          <p className="mt-2 text-xs text-muted-foreground">
                            {l(
                              "Previous performance is not available offline for this exercise.",
                              "السجل السابق لهذا التمرين غير متاح دون اتصال.",
                            )}
                          </p>
                        )}
                        {timed && !w.editor?.holdRow && (
                          <HoldTimer
                            started={w.holdStartedAt ?? null}
                            onToggle={() =>
                              void run(async () => {
                                const started = w.holdStartedAt;
                                await change((c) => ({
                                  ...c,
                                  holdStartedAt: started ? null : Date.now(),
                                }));
                                if (started)
                                  updateDraft({
                                    reps: String(
                                      Math.max(1, Math.floor((Date.now() - started) / 1000)),
                                    ),
                                  });
                              })
                            }
                          />
                        )}
                        {side === "right" && (
                          <Button variant="ghost" onClick={editor.copyLeft}>
                            {l("Same as left", "مثل الجانب الأيسر")}
                          </Button>
                        )}
                        <Button
                          className="mt-3 w-full"
                          disabled={busy || !restPreference.ready}
                          onClick={() => void editor.logSet(restSeconds)}
                        >
                          <Check />
                          {t("logSet")}
                        </Button>
                      </div>
                    )}
                    {!activePlan?.sets && slot.sets > count + 1 && (
                      <p className="text-xs text-muted-foreground">
                        {Math.ceil(slot.sets - count - 1)}{" "}
                        {l(
                          "further planned sets · not yet completed",
                          "مجموعات مخططة أخرى · غير مكتملة",
                        )}
                      </p>
                    )}
                    {features?.progression && selection && (
                      <TrainingSuggestion
                        userId={w.userId}
                        slot={selection}
                        exerciseId={exerciseId}
                        onUse={(kg, reps, seconds) =>
                          updateDraft({
                            weight: kg == null ? "" : String(displayWeight(kg, units)),
                            reps: String(seconds ?? reps ?? ""),
                            rpe: "",
                          })
                        }
                      />
                    )}
                    {tools && (
                      <WorkoutExerciseOptions
                        onDraft={updateDraft}
                        equipment={selected?.equipment}
                        units={units}
                        draft={draft}
                        onWarmup={editor.loadWarmup}
                        logging={{
                          ...logging,
                          enabled: features?.logging === true,
                          rows: currentRows,
                        }}
                        superset={{
                          value: groupIndex >= 0 ? (group[groupIndex === 0 ? 1 : 0] ?? "") : "",
                          options: supersetCandidates(w)
                            .filter((p) => slotReference(p.id, p.key) !== reference)
                            .map((p, i) => ({
                              value: slotReference(p.id, p.key),
                              label:
                                name(p.id) +
                                (supersetCandidates(w).filter((other) => other.id === p.id).length >
                                1
                                  ? ` \u00b7 ${i + 1}`
                                  : ""),
                            })),
                          onChange: (ref) => {
                            void run(() => change((c) => pairSuperset(c, reference, ref)));
                          },
                        }}
                      />
                    )}
                  </>
                )}
              </WorkoutExerciseCard>
            );
          })}
      </div>
      {!locked && (
        <Button variant="outline" className="w-full" onClick={() => setLibrary("add")}>
          <Plus />
          {l("Add exercise", "إضافة تمرين")}
        </Button>
      )}
      <details className="rounded-xl border border-border p-4">
        <summary className="min-h-11 cursor-pointer text-sm">
          {l("Session notes & recovery", "ملاحظات الجلسة والاستعادة")}
        </summary>
        <label className="mt-3 block text-sm">
          {t("notes")}
          <Input
            className="mt-2"
            disabled={locked}
            value={w.notes}
            onChange={(e) => {
              const notes = e.target.value;
              void change((c) => ({ ...c, notes })).catch((e: Error) => setError(e.message));
            }}
          />
        </label>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="outline" onClick={exportWorkout}>
            <Download />
            {l("Export backup", "تصدير نسخة")}
          </Button>
        </div>
      </details>
      {!locked && (
        <div className="flex justify-end border-t border-border pt-4">
          <Button
            variant="outline"
            className="min-h-11 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
            disabled={busy}
            onClick={() => setDiscard(true)}
          >
            {t("discardWorkout")}
          </Button>
        </div>
      )}
      <RestTimer
        end={w.restEnd}
        seconds={restSeconds}
        locked={locked}
        onDuration={(n) => restPreference.save(n)}
        ready={restPreference.ready}
        onChange={(end) =>
          void change((c) => ({ ...c, restEnd: end })).catch((e: Error) => setError(e.message))
        }
      />
      {restPreference.error && (
        <p role="status" className="text-xs text-muted-foreground">
          {l(
            "Saved rest preference unavailable; using the device default.",
            "تفضيل الراحة غير متاح؛ يُستخدم إعداد الجهاز.",
          )}
        </p>
      )}
      <Sheet
        open={!!library}
        onOpenChange={(o) => {
          if (!o && !busy) setLibrary(null);
        }}
      >
        <SheetContent side="bottom" className="max-h-[90dvh] overflow-auto rounded-t-2xl p-4">
          <div className="mx-auto max-w-2xl">
            <SheetTitle>
              {library === "swap"
                ? l("Swap exercise", "استبدال التمرين")
                : l("Add exercise", "إضافة تمرين")}
            </SheetTitle>
            <SheetDescription>
              {l(
                "Choose an exercise. Previously logged sets stay unchanged.",
                "اختر تمريناً. تبقى المجموعات السابقة دون تغيير.",
              )}
            </SheetDescription>
            <ExerciseDiscovery
              exercises={w.exercises as ExerciseGuidance[]}
              preferred={w.plan.map((p) => p.id)}
              disabled={busy || locked}
              onChoose={(id) =>
                run(async () => {
                  const slot = `local:${crypto.randomUUID()}`;
                  const swapping = library === "swap" && !!activePlan;
                  const key = swapping ? selection : slot;
                  await change((c) => {
                    if (c.phase !== "active")
                      throw new Error(
                        l(
                          "This workout is no longer editable.",
                          "لم تعد هذه الجلسة قابلة للتعديل.",
                        ),
                      );
                    if (c.holdStartedAt)
                      throw new Error(
                        l(
                          "Stop the current hold before switching exercises.",
                          "أوقف الثبات قبل تغيير التمرين.",
                        ),
                      );
                    const exercise = c.exercises.find((e) => e.id === id) as
                      ExerciseGuidance | undefined;
                    if (
                      !exercise ||
                      exercise.active === false ||
                      exercise.guidance?.catalogue_kind === "cardio"
                    )
                      throw new Error(
                        l(
                          "This exercise is unavailable for strength logging.",
                          "هذا التمرين غير متاح لتسجيل القوة.",
                        ),
                      );
                    return {
                      ...c,
                      plan: swapping
                        ? c.plan.map((p) =>
                            p.slot_key === selection && p.id === exerciseId
                              ? { ...p, id, exercise: c.exercises.find((e) => e.id === id) }
                              : p,
                          )
                        : [
                            ...c.plan,
                            {
                              id,
                              slot_key: slot,
                              sets: 0,
                              reps: "",
                              exercise: c.exercises.find((e) => e.id === id),
                            },
                          ],
                      superset: library === "swap" ? [] : c.superset,
                      ...(library === "swap" ? { supersetSlots: [] } : {}),
                      editor: {
                        ...c.editor,
                        drafts: c.editor?.drafts ?? {},
                        selectedSlot: key,
                        selectedExercise: id,
                      },
                    };
                  });
                  pick(id, key, false);
                  setLibrary(null);
                }, true)
              }
            />
          </div>
        </SheetContent>
      </Sheet>
      {detail && (
        <ExerciseDetail
          key={detail.exercise.id}
          exercise={detail.exercise}
          startMedia={detail.play}
          onClose={() => setDetail(null)}
        />
      )}
      <WorkoutReview
        title={w.session?.title ?? l("Workout", "تمرين")}
        onBackup={exportWorkout}
        open={review || discard}
        discard={discard}
        busy={busy}
        error={error}
        sets={sets}
        slots={slots}
        exerciseName={name}
        onClose={() => {
          setReview(false);
          setDiscard(false);
        }}
        onConfirm={() =>
          void run(async () => {
            await change((c) => ({
              ...c,
              phase: discard ? "discarding" : "finishing",
              finishedAt: discard ? null : new Date().toISOString(),
              restEnd: 0,
            }));
            setReview(false);
            setDiscard(false);
          })
        }
      />
      {editing && (
        <SetEditor
          key={editing.id}
          row={editing}
          units={units}
          onClose={() => setEditing(null)}
          onSave={async (value) => {
            await change((c) => editWorkoutSet(c, editing.id, revisionOf(editing), value));
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}
