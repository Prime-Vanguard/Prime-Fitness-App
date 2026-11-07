import { appendSet, type Workout, type WorkoutSet } from "./workout-store";
import { validateSetDetails, setDetailsSchema } from "./training-model";
import { inputNumber } from "./numeric-input";
import { z } from "zod";
import { displayWeight, storedWeight, formatMeasure, type Units } from "./units";

/** Only a plain number/range can prefill a prescription, never arbitrary coach text. */
export function prescribedReps(text: string, timed = false): string {
  const match = text.match(/^\s*([0-9٠-٩۰-۹]+)(?:\s*[-–]\s*[0-9٠-٩۰-۹]+)?\s*$/);
  if (!match) return "";
  try {
    return String(
      inputNumber(match[1]!, { label: "Target", min: 1, max: timed ? 86400 : 1000, integer: true }),
    );
  } catch {
    return "";
  }
}

export type SetDraft = {
  reps: string;
  weight: string;
  rpe: string;
  units?: import("./units").Units | undefined;
  set_role?: import("./training-model").SetDetails["set_role"] | undefined;
  side?: import("./training-model").SetDetails["side"] | undefined;
  pair_id?: string | undefined;
  root_set_id?: string | undefined;
};
export type WorkoutEditorState = {
  selectedSlot: string;
  selectedExercise?: string | undefined;
  drafts: Record<string, SetDraft>;
  plannedRows?: Record<string, PlannedRow[]> | undefined;
  holdRow?: { key: string; id: string } | undefined;
};
export type PlannedRow = { id: string; number: number; revision: number; draft: SetDraft };
export const setDraftSchema = z.object({
  reps: z.string().max(100),
  weight: z.string().max(100),
  rpe: z.string().max(100),
  units: z.enum(["metric", "imperial"]).optional(),
  set_role: z.enum(["working", "warmup", "drop"]).optional(),
  side: z.enum(["bilateral", "left", "right"]).optional(),
  pair_id: z.string().uuid().optional(),
  root_set_id: z.string().max(36).optional(),
});
export const workoutEditorSchema = z.object({
  selectedSlot: z.string().max(100),
  selectedExercise: z.string().uuid().optional(),
  holdRow: z.object({ key: z.string().max(250), id: z.string().uuid() }).optional(),
  drafts: z.record(z.string().max(250), setDraftSchema),
  plannedRows: z
    .record(
      z.string().max(250),
      z
        .array(
          z.object({
            id: z.string().uuid(),
            number: z.number().int().min(1).max(100),
            revision: z.number().int().nonnegative(),
            draft: setDraftSchema,
          }),
        )
        .max(100),
    )
    .optional(),
});

export const slotReference = (exercise: string, slot = "") => JSON.stringify([exercise, slot]);
export const slotDraftKey = (exercise: string, slot = "") => `${slot}:${exercise}`;
export function supersetCandidates(w: Workout) {
  const slots = workoutSlots(w);
  for (const e of w.exercises)
    if (!slots.some((p) => p.id === e.id)) slots.push({ id: e.id, key: "", sets: 0, reps: "" });
  return slots;
}
/** Old ID-based groups are read only when each exercise resolves unambiguously. */
export function supersetPair(w: Workout): string[] {
  const slots = supersetCandidates(w);
  if (w.supersetSlots !== undefined)
    return w.supersetSlots.length === 2 &&
      new Set(w.supersetSlots).size === 2 &&
      w.supersetSlots.every((ref) => slots.some((p) => slotReference(p.id, p.key) === ref))
      ? w.supersetSlots
      : [];
  if (w.superset.length !== 2) return [];
  const matches = w.superset.map((id) => slots.filter((p) => p.id === id));
  return matches.every((list) => list.length === 1)
    ? matches.map((list) => slotReference(list[0]!.id, list[0]!.key))
    : [];
}
export function pairSuperset(w: Workout, first: string, second: string): Workout {
  if (w.phase !== "active" || !w.session) throw new Error("This workout is no longer editable.");
  if (!second) return { ...w, superset: [], supersetSlots: [] };
  const candidates = supersetCandidates(w),
    selected = [first, second].map((ref) =>
      candidates.find((p) => slotReference(p.id, p.key) === ref),
    );
  if (first === second || selected.some((p) => !p))
    throw new Error("Choose two different exercise slots.");
  const plan = [...w.plan];
  for (const p of selected)
    if (!plan.some((item) => item.id === p!.id && (item.slot_key ?? "") === p!.key))
      plan.push({
        id: p!.id,
        slot_key: p!.key,
        sets: p!.sets,
        reps: p!.reps,
        exercise: w.exercises.find((e) => e.id === p!.id),
      });
  return { ...w, plan, superset: [], supersetSlots: [first, second] };
}
export function nextSupersetSlot(w: Workout, exercise: string, slot: string) {
  const group = supersetPair(w),
    ref = slotReference(exercise, slot),
    index = group.indexOf(ref);
  const next =
    index < 0
      ? null
      : (supersetCandidates(w).find(
          (p) => slotReference(p.id, p.key) === group[index === 0 ? 1 : 0],
        ) ?? null);
  return { rest: index !== 0, next };
}

export function convertDraftUnits(draft: SetDraft, units: Units): SetDraft {
  if (!draft.units || draft.units === units || !draft.weight) return { ...draft, units };
  const n = inputNumber(draft.weight, { label: "Weight", max: 2205 });
  return {
    ...draft,
    units,
    weight:
      n == null ? "" : String(formatMeasure(displayWeight(storedWeight(n, draft.units), units))),
  };
}
export function parseSetDraft(draft: SetDraft, timed: boolean, units: Units) {
  const value = convertDraftUnits(draft, units);
  return {
    reps: timed
      ? null
      : inputNumber(value.reps, { label: "Reps", min: 1, max: 1000, integer: true }),
    duration_seconds: timed
      ? inputNumber(value.reps, { label: "Seconds", min: 1, max: 86400, integer: true })
      : null,
    weight_kg: value.weight
      ? storedWeight(inputNumber(value.weight, { label: "Weight", max: 2205 })!, units)
      : null,
    rpe: inputNumber(value.rpe, { label: "RPE", min: 1, max: 10 }),
  };
}
export function initializePlannedRows(
  w: Workout,
  exercise: string,
  slot: string,
  initial: SetDraft,
): Workout {
  const key = slotDraftKey(exercise, slot);
  if (!w.session || w.phase !== "active" || w.editor?.plannedRows?.[key]) return w;
  const plan = w.plan.find((p) => p.id === exercise && (p.slot_key ?? "") === slot);
  if (!plan?.sets) return w;
  const done = workingCount(
    w.sets.filter(
      (s) => s.sync !== "deleted" && s.exercise_id === exercise && (s.slot_key ?? "") === slot,
    ),
  );
  const count = Math.max(0, Math.min(100, Math.ceil(plan.sets - done)));
  return {
    ...w,
    editor: {
      ...w.editor,
      selectedSlot: w.editor?.selectedSlot ?? slot,
      drafts: w.editor?.drafts ?? {},
      plannedRows: {
        ...w.editor?.plannedRows,
        [key]: Array.from({ length: count }, (_, i) => ({
          id: crypto.randomUUID(),
          number: Math.min(100, Math.floor(done) + i + 1),
          revision: 0,
          draft: {
            ...initial,
            rpe: i === 0 ? initial.rpe : "",
            set_role: "working",
            side: "bilateral",
          },
        })),
      },
    },
  };
}
export function updatePlannedRow(
  w: Workout,
  key: string,
  id: string,
  draft: Partial<SetDraft>,
): Workout {
  if (w.phase !== "active" || !w.session) throw new Error("This workout is no longer editable.");
  const rows = w.editor?.plannedRows?.[key];
  if (!rows?.some((r) => r.id === id))
    throw new Error("This planned row was already completed or removed.");
  return {
    ...w,
    editor: {
      ...w.editor!,
      plannedRows: {
        ...w.editor!.plannedRows,
        [key]: rows.map((r) =>
          r.id === id
            ? {
                ...r,
                draft: {
                  ...convertDraftUnits(r.draft, draft.units ?? r.draft.units ?? "metric"),
                  ...draft,
                },
                revision: r.revision + 1,
              }
            : r,
        ),
      },
    },
  };
}
export function completePlannedRow(
  w: Workout,
  exercise: string,
  slot: string,
  id: string,
  expected: SetDraft,
  units: Units,
): Workout {
  const key = slotDraftKey(exercise, slot),
    rows = w.editor?.plannedRows?.[key],
    row = rows?.find((r) => r.id === id);
  if (!row) throw new Error("This row was already completed or removed. Review the workout.");
  const stored = convertDraftUnits(row.draft, units),
    entered = convertDraftUnits(expected, units);
  if (
    stored.reps !== entered.reps ||
    stored.weight !== entered.weight ||
    stored.rpe !== entered.rpe
  )
    throw new Error("This row changed or is not saved yet. Review it before completing.");
  const ex =
    w.plan.find((p) => p.id === exercise && (p.slot_key ?? "") === slot)?.exercise ??
    w.exercises.find((e) => e.id === exercise);
  if (!ex) throw new Error("Exercise metadata unavailable.");
  const next = appendSet(w, {
    exercise_id: exercise,
    slot_key: slot,
    ...parseSetDraft(row.draft, ex.logging_mode === "timed", units),
    logging_mode: ex.logging_mode ?? "weighted_reps",
    load_convention: ex.load_convention ?? "external_total",
    set_role: "working",
    side: "bilateral",
  });
  return {
    ...next,
    editor: {
      ...next.editor!,
      plannedRows: { ...next.editor!.plannedRows, [key]: rows!.filter((r) => r.id !== id) },
    },
  };
}

export function togglePlannedHold(w: Workout, key: string, id: string, now = Date.now()): Workout {
  if (!w.session || w.phase !== "active") throw new Error("This workout is no longer editable.");
  const row = w.editor?.plannedRows?.[key]?.find((r) => r.id === id);
  if (!row) throw new Error("This planned row is unavailable.");
  if (w.holdStartedAt) {
    if (w.editor?.holdRow?.key !== key || w.editor.holdRow.id !== id)
      throw new Error("Stop the current hold first.");
    const next = updatePlannedRow(w, key, id, {
      ...row.draft,
      reps: String(Math.max(1, Math.floor((now - w.holdStartedAt) / 1000))),
    });
    return { ...next, holdStartedAt: null, editor: { ...next.editor!, holdRow: undefined } };
  }
  return { ...w, holdStartedAt: now, editor: { ...w.editor!, holdRow: { key, id } } };
}

/** Local revision is never sent to Postgres; it protects acknowledgements and undo. */
export const revisionOf = (set: WorkoutSet) => set.localRevision ?? 0;

export function editWorkoutSet(
  w: Workout,
  id: string,
  expectedRevision: number,
  values: Pick<WorkoutSet, "reps" | "duration_seconds" | "weight_kg" | "rpe">,
): Workout {
  if (!w.session || w.phase !== "active") throw new Error("This workout is no longer editable.");
  const original = w.sets.find((s) => s.id === id && s.sync !== "deleted");
  if (!original || revisionOf(original) !== expectedRevision)
    throw new Error("This set changed in another tab. Reopen it before editing.");
  const updated = {
    ...original,
    ...values,
    localRevision: expectedRevision + 1,
    sync: "pending" as const,
  };
  validateSetDetails({ ...updated, ...setDetailsSchema.parse(updated) });
  return { ...w, sets: w.sets.map((s) => (s.id === id ? updated : s)) };
}

export function deleteWorkoutSets(w: Workout, id: string): Workout {
  if (!w.session || w.phase !== "active") throw new Error("This workout is no longer editable.");
  return {
    ...w,
    sets: w.sets.map((s) =>
      s.id === id || s.root_set_id === id
        ? { ...s, sync: "deleted", localRevision: revisionOf(s) + 1 }
        : s,
    ),
  };
}

export function restoreWorkoutSets(w: Workout, rows: WorkoutSet[]): Workout {
  if (!w.session || w.phase !== "active" || rows.some((s) => s.session_id !== w.session!.id))
    throw new Error("This workout is no longer editable.");
  const ids = new Set(rows.map((s) => s.id));
  // Never overwrite a row that another tab has already restored or changed.
  if (w.sets.some((s) => ids.has(s.id) && s.sync !== "deleted"))
    throw new Error("This set has already changed. Check the current workout.");
  return {
    ...w,
    sets: [
      ...w.sets.filter((s) => !ids.has(s.id)),
      ...rows.map((s) => ({
        ...s,
        localRevision: revisionOf(s) + 2,
        sync: "pending" as const,
      })),
    ],
  };
}

export function sameSetWrite(current: WorkoutSet, sent: WorkoutSet) {
  return (
    current.id === sent.id &&
    current.sync === sent.sync &&
    revisionOf(current) === revisionOf(sent) &&
    current.reps === sent.reps &&
    current.duration_seconds === sent.duration_seconds &&
    current.weight_kg === sent.weight_kg &&
    current.rpe === sent.rpe
  );
}

export function workoutSlots(w: Workout) {
  const slots = w.plan.map((p) => ({ ...p, key: p.slot_key ?? "" }));
  for (const s of w.sets.filter((s) => s.sync !== "deleted")) {
    if (!slots.some((p) => p.id === s.exercise_id && p.key === (s.slot_key ?? "")))
      slots.push({ id: s.exercise_id, key: s.slot_key ?? "", sets: 0, reps: "" });
  }
  return slots;
}

export const workingCount = (sets: WorkoutSet[]) =>
  sets.reduce(
    (n, s) =>
      n +
      ((s.set_role ?? "working") === "working" ? (s.side && s.side !== "bilateral" ? 0.5 : 1) : 0),
    0,
  );
