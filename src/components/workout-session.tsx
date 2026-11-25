import { useWorkoutEditor } from "@/features/workouts/use-workout-editor";
import { WorkoutExerciseOptions } from "@/features/workouts/workout-exercise-options";
import { WorkoutExerciseCard } from "@/features/workouts/workout-exercise-card";
import { useWorkoutActions } from "@/features/workouts/use-workout-actions";
import { useMemo, useRef, useState } from "react";
import { selectExercises } from "@/features/workouts/select-exercises";
import { Link } from "@tanstack/react-router";
import { Check, ChevronDown, ChevronLeft, Download, Plus } from "lucide-react";
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
  slotDraftKey,
  supersetPair,
  supersetChoices,
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
import { BrandLockup } from "./brand-lockup";
import { NotificationBell } from "./notification-bell";
import { WorkoutSyncStatus } from "@/features/workouts/workout-sync-status";

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
  const pickerSlots = useRef(new Map<string, string>());
  function openLibrary(mode: "add" | "swap") {
    pickerSlots.current.clear();
    setLibrary(mode);
  }
  async function confirmExercises(ids: string[]) {
    await run(async () => {
      const replacing = library === "swap" && !!activePlan;
      const choices = ids.map((id) => {
        let slot = pickerSlots.current.get(id);
        if (!slot) {
          slot = "local:" + crypto.randomUUID();
          pickerSlots.current.set(id, slot);
        }
        return { id, slot };
      });
      const saved = await change((current) =>
        selectExercises(
          current,
          choices,
          replacing ? { exercise: exerciseId, slot: selection } : undefined,
          locale,
        ),
      );
      pick(saved.editor!.selectedExercise!, saved.editor!.selectedSlot!, false);
      setLibrary(null);
    }, true);
  }
  const [detail, setDetail] = useState<{ exercise: ExerciseGuidance; play: boolean } | null>(null);
  const [tools, setTools] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const advancedEntry = useRef<HTMLDivElement>(null);
  const focusAdvancedEntry = useRef(false);
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
  const partnerOptions = useMemo(
    () =>
      tools
        ? supersetChoices({ plan: w.plan, sets: w.sets, exercises: w.exercises }, reference, locale)
        : [],
    [tools, w.plan, w.sets, w.exercises, reference, locale],
  );

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
    <div className="py-0" data-workout-session>
      <div className="flex h-16 items-center justify-between gap-2" data-workout-focus-header>
        {/* Returning to the hub changes presentation only; the controller retains the draft. */}
        <Button asChild variant="ghost" size="icon" className="shrink-0">
          <Link
            to="/train"
            search={{ view: "overview" }}
            aria-label={l("Back to Train", "العودة إلى التدريب")}
            title={l("Back to Train", "العودة إلى التدريب")}
          >
            <ChevronLeft aria-hidden className="size-4 rtl:rotate-180" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <BrandLockup />
        </div>
        <NotificationBell
          userId={w.userId}
          className="flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground"
        />
      </div>
      <header className="sticky top-0 z-20 mb-2 grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-2 bg-background py-2">
        <Button asChild variant="ghost" size="icon" className="bg-card text-muted-foreground">
          <Link to="/today" aria-label={l("Minimize", "تصغير")} title={l("Minimize", "تصغير")}>
            <ChevronDown aria-hidden="true" />
          </Link>
        </Button>
        <div className="min-w-0">
          <h1
            className="truncate text-base font-bold leading-6"
            title={w.session!.title ?? t("workout")}
          >
            {w.session!.title ?? t("workout")}
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            <SessionTime started={w.session!.started_at} />
            {" · "}
            {l(
              `Ex ${
                Math.max(
                  0,
                  slots.findIndex((slot) => slot.id === exerciseId && slot.key === selection),
                ) + 1
              } of ${slots.length}`,
              `التمرين ${
                Math.max(
                  0,
                  slots.findIndex((slot) => slot.id === exerciseId && slot.key === selection),
                ) + 1
              } من ${slots.length}`,
            )}
          </p>
        </div>
        {!locked && (
          <Button
            variant="outline"
            size="sm"
            className="border-transparent bg-card uppercase tracking-wider text-muted-foreground"
            aria-label={t("finishWorkout")}
            disabled={busy || !sets.length}
            onClick={() => setReview(true)}
          >
            {l("Finish", "إنهاء")}
          </Button>
        )}
      </header>
      <div
        className="mb-4 flex gap-1.5"
        role="img"
        aria-label={l(
          `${slots.length} exercises in this workout`,
          `${slots.length} تمارين في هذه الجلسة`,
        )}
      >
        {slots.map((slot) => {
          const count = workingCount(
            sets.filter((set) => set.exercise_id === slot.id && (set.slot_key ?? "") === slot.key),
          );
          return (
            <span
              key={`${slot.key}:${slot.id}`}
              className={`h-1.5 flex-1 rounded-full ${slot.sets > 0 && count >= slot.sets ? "bg-success" : slot.key === selection && slot.id === exerciseId ? "bg-foreground" : "bg-raised"}`}
            />
          );
        })}
      </div>
      <WorkoutSyncStatus online={online} pending={pendingCount(w)} error={!!w.error} />
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
          .map((slot, index) => {
            const rows = sets.filter(
              (s) => s.exercise_id === slot.id && (s.slot_key ?? "") === slot.key,
            );
            const active = slot.key === selection && slot.id === exerciseId;
            const count = workingCount(rows);
            const catalogue = w.exercises.find((e) => e.id === slot.id);
            const cardExercise = (
              slot.exercise ? { ...catalogue, ...slot.exercise } : catalogue
            ) as ExerciseGuidance | undefined;
            const firstPlanned = activePlan?.sets
              ? w.editor?.plannedRows?.[slotDraftKey(slot.id, slot.key)]?.[0]
              : undefined;
            return (
              <WorkoutExerciseCard
                key={`${slot.key}:${slot.id}`}
                slot={slot}
                position={index + 1}
                total={slots.length}
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
                onOptions={() => setTools(true)}
                onOpenMedia={() => {
                  if (cardExercise) setDetail({ exercise: cardExercise, play: true });
                }}
                onEdit={setEditing}
                onDelete={remove}
                actions={
                  active && !locked ? (
                    <>
                      {" "}
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
                      <Sheet
                        open={tools}
                        onOpenChange={(open) => {
                          if (!busy) setTools(open);
                        }}
                      >
                        <SheetContent
                          side="bottom"
                          className="max-h-[85dvh] overflow-y-auto rounded-t-2xl p-5"
                          onCloseAutoFocus={(event) => {
                            if (!focusAdvancedEntry.current) return;
                            event.preventDefault();
                            focusAdvancedEntry.current = false;
                            advancedEntry.current?.scrollIntoView({ block: "center" });
                            advancedEntry.current
                              ?.querySelector("input")
                              ?.focus({ preventScroll: true });
                          }}
                        >
                          <div className="mx-auto max-w-lg space-y-4">
                            <SheetTitle>{l("Exercise options", "خيارات التمرين")}</SheetTitle>
                            <SheetDescription>{name(exerciseId, selection)}</SheetDescription>
                            {tools && (
                              <WorkoutExerciseOptions
                                actions={
                                  <>
                                    {" "}
                                    <Button
                                      variant="outline"
                                      disabled={busy}
                                      onClick={() => void retry()}
                                    >
                                      {l("Retry sync", "إعادة المزامنة")}
                                    </Button>
                                    {features?.guidance && (
                                      <Button
                                        variant="outline"
                                        disabled={busy}
                                        onClick={() => {
                                          setTools(false);
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
                                    <Button
                                      variant="outline"
                                      disabled={busy}
                                      onClick={() => {
                                        setTools(false);
                                        openLibrary("swap");
                                      }}
                                    >
                                      {l("Swap exercise", "استبدال التمرين")}
                                    </Button>
                                  </>
                                }
                                onClose={() => setTools(false)}
                                timed={timed}
                                disabled={busy}
                                error={error || w.error || ""}
                                rest={{
                                  seconds: restSeconds,
                                  ready: restPreference.ready,
                                  error: restPreference.error,
                                  onSave: (seconds) =>
                                    run(() => restPreference.save(seconds), true),
                                }}
                                onEditSet={async (seconds) => {
                                  await run(async () => {
                                    await editor.persistDraft();
                                    if (
                                      seconds != null &&
                                      (seconds !== restSeconds || restPreference.error)
                                    )
                                      await restPreference.save(seconds);
                                    focusAdvancedEntry.current = true;
                                    setAdvanced(true);
                                    setTools(false);
                                  }, true);
                                }}
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
                                  value:
                                    groupIndex >= 0 ? (group[groupIndex === 0 ? 1 : 0] ?? "") : "",
                                  options: partnerOptions,
                                  onChange: (ref) => {
                                    void run(() => change((c) => pairSuperset(c, reference, ref)));
                                  },
                                }}
                              />
                            )}
                          </div>
                        </SheetContent>
                      </Sheet>
                    </>
                  ) : undefined
                }
                primaryAction={
                  active && !locked && firstPlanned ? (
                    <Button
                      type="submit"
                      form={`planned-${firstPlanned.id}`}
                      className="h-12 w-full uppercase"
                      disabled={busy || !restPreference.ready || !!w.holdStartedAt}
                    >
                      <Check aria-hidden className="size-4" />
                      {l(`Log set ${firstPlanned.number}`, `تسجيل المجموعة ${firstPlanned.number}`)}
                    </Button>
                  ) : undefined
                }
                history={
                  active ? (
                    previous.data ? (
                      <p className="rounded-xl bg-row p-4 text-sm">
                        <bdi dir="ltr">
                          {previous.data.duration_seconds != null
                            ? `${previous.data.duration_seconds}s`
                            : previous.data.reps}{" "}
                          ×{" "}
                          {previous.data.weight_kg == null
                            ? "—"
                            : formatMeasure(displayWeight(previous.data.weight_kg, units))}{" "}
                          {wu}
                        </bdi>
                        <span className="mt-2 block text-xs text-muted-foreground">
                          {new Date(previous.data.created_at).toLocaleDateString(
                            locale === "ar" ? "ar-EG-u-nu-latn" : "en-GB",
                          )}
                          {previous.data.workout_sessions?.origin === "import"
                            ? l(" · Imported", " · مستورد")
                            : ""}
                          {previous.data.cached
                            ? l(" · Cached on device", " · نسخة على الجهاز")
                            : ""}
                        </span>
                      </p>
                    ) : (
                      <p role="status" className="text-sm text-muted-foreground">
                        {previous.isPending
                          ? l("Loading previous performance…", "جارٍ تحميل الأداء السابق…")
                          : l(
                              "No compatible previous performance is available. You can still log your sets.",
                              "لا يتوفر أداء سابق متوافق. يمكنك تسجيل مجموعاتك.",
                            )}
                      </p>
                    )
                  ) : undefined
                }
              >
                {active && !locked && (
                  <>
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
                              locale === "ar" ? "ar-EG-u-nu-latn" : "en-GB",
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
                      <div
                        ref={advancedEntry}
                        data-advanced-set-entry
                        className="rounded-xl bg-background/50 p-3"
                      >
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
                            "RPE هو الجهد من 1 إلى 10. اتركه فارغاً إن لم تتأكد؛ قد يتوقف اقتراح التدرج.",
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
                              locale === "ar" ? "ar-EG-u-nu-latn" : "en-GB",
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
                  </>
                )}
              </WorkoutExerciseCard>
            );
          })}
      </div>
      {!locked && (
        <Button variant="outline" className="mt-4 w-full" onClick={() => openLibrary("add")}>
          <Plus />
          {l("Add exercise", "إضافة تمرين")}
        </Button>
      )}
      <details className="mt-4 rounded-xl border border-border p-4">
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
        <div className="mt-4 flex justify-end border-t border-border pt-4">
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
        <SheetContent
          side="bottom"
          className="h-[90dvh] max-h-[90dvh] overflow-hidden rounded-t-2xl p-4"
        >
          <div className="mx-auto flex h-full min-h-0 max-w-2xl flex-col">
            <SheetTitle className="shrink-0 pe-10 font-heading text-2xl font-bold">
              {library === "swap"
                ? l("Swap exercise", "استبدال التمرين")
                : l("Add exercise", "إضافة تمرين")}
            </SheetTitle>
            <SheetDescription>
              {library === "add"
                ? l(
                    "Choose exercises, then review and add your selection.",
                    "اختر التمارين، ثم راجعها وأضفها إلى جلستك.",
                  )
                : l(
                    "Choose a replacement. Previously logged sets stay unchanged.",
                    "اختر تمريناً بديلاً. تبقى المجموعات السابقة دون تغيير.",
                  )}
            </SheetDescription>
            <ExerciseDiscovery
              member={w.userId}
              fill
              exercises={w.exercises as ExerciseGuidance[]}
              preferred={w.plan.map((p) => p.id)}
              disabled={busy || locked}
              onChoose={(id) => confirmExercises([id])}
              onChooseMany={library === "add" ? confirmExercises : undefined}
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
        startedAt={w.session!.started_at}
        units={units}
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
