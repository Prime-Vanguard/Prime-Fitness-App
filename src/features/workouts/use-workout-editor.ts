import { useEffect, useState } from "react";
import { usePreviousPerformance } from "@/hooks/use-workout-references";
import { useI18n } from "@/lib/i18n";
import { appendSet } from "@/lib/workout-store";
import {
  prescribedReps,
  nextSupersetSlot,
  slotDraftKey,
  parseSetDraft,
  convertDraftUnits,
  type SetDraft,
} from "@/lib/workout-editor";
import { displayWeight, storedWeight, formatMeasure, type Units } from "@/lib/units";
import { inputNumber } from "@/lib/numeric-input";
import { haptic, primeAudio } from "@/lib/device-feedback";
import type { SetDetails } from "@/lib/training-model";
import type { WorkoutSessionController } from "./types";

const blank: SetDraft = { reps: "", weight: "", rpe: "" };
/** Owns exercise selection and durable entry drafts; session dialogs stay in the view. */
export function useWorkoutEditor({
  controller,
  units,
  onError,
  run,
}: {
  controller: Pick<WorkoutSessionController, "workout" | "change" | "online">;
  units: Units;
  onError: (message: string) => void;
  run: (action: () => Promise<unknown>) => Promise<void>;
}) {
  const { workout: w, change, online } = controller;
  const { locale } = useI18n();
  const l = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const [selection, setSelection] = useState(w.editor?.selectedSlot ?? w.plan[0]?.slot_key ?? "");
  const [exerciseId, setExerciseId] = useState(
    w.editor?.selectedExercise ??
      w.plan.find((p) => p.slot_key === selection)?.id ??
      w.plan[0]?.id ??
      w.exercises[0]?.id ??
      "",
  );
  const draftKey = `${selection}:${exerciseId}`;
  const [drafts, setDrafts] = useState<Record<string, SetDraft>>(() =>
    Object.fromEntries(
      Object.entries(w.editor?.drafts ?? {}).map(([key, value]) => {
        if (!value.units || value.units === units || !value.weight) return [key, value];
        try {
          const n = inputNumber(value.weight, { label: "Weight", max: 2205 });
          return [
            key,
            {
              ...value,
              weight:
                n == null
                  ? ""
                  : String(formatMeasure(displayWeight(storedWeight(n, value.units), units))),
              units,
            },
          ];
        } catch {
          return [key, value];
        }
      }),
    ),
  );
  const draft = drafts[draftKey] ?? blank;
  const [role, setRole] = useState<SetDetails["set_role"]>(draft.set_role ?? "working");
  const [side, setSide] = useState<SetDetails["side"]>(draft.side ?? "bilateral");
  const [pair, setPair] = useState(() => draft.pair_id ?? crypto.randomUUID());
  const [root, setRoot] = useState(draft.root_set_id ?? "");
  const activePlan = w.plan.find((p) => p.id === exerciseId && (p.slot_key ?? "") === selection);
  const catalogueExercise = w.exercises.find((e) => e.id === exerciseId);
  const selected = activePlan?.exercise
    ? { ...catalogueExercise, ...activePlan.exercise }
    : catalogueExercise;
  const timed = selected?.logging_mode === "timed";

  function updateDraft(value: Partial<SetDraft>) {
    setDrafts((all) => ({
      ...all,
      [draftKey]: { ...convertDraftUnits(all[draftKey] ?? draft, units), ...value, units },
    }));
    // Each keystroke is durable; the transaction merges other exercise/tab drafts.
    void change((current) => ({
      ...current,
      editor: {
        ...current.editor,
        selectedSlot: selection,
        selectedExercise: exerciseId,
        drafts: {
          ...current.editor?.drafts,
          [draftKey]: {
            ...convertDraftUnits(current.editor?.drafts?.[draftKey] ?? draft, units),
            ...value,
            units,
          },
        },
      },
    })).catch((e: Error) => onError(e.message));
  }
  function pick(id: string, slot = "") {
    if (w.holdStartedAt && (slot !== selection || id !== exerciseId)) {
      onError(
        l("Stop the current hold before switching exercises.", "أوقف الثبات قبل تغيير التمرين."),
      );
      return;
    }
    const saved = drafts[`${slot}:${id}`];
    setExerciseId(id);
    setSelection(slot);
    setRole(saved?.set_role ?? "working");
    setSide(saved?.side ?? "bilateral");
    setRoot(saved?.root_set_id ?? "");
    setPair(saved?.pair_id ?? crypto.randomUUID());
    void change((current) => ({
      ...current,
      editor: {
        ...current.editor,
        drafts: current.editor?.drafts ?? {},
        selectedSlot: slot,
        selectedExercise: id,
      },
    })).catch((e: Error) => onError(e.message));
  }
  const previous = usePreviousPerformance(
    {
      member: w.userId,
      session: w.session!.id,
      exercise: exerciseId,
      slot: selection,
      side,
      mode: selected?.logging_mode ?? "weighted_reps",
      convention: selected?.load_convention ?? "external_total",
    },
    online,
  );
  // Targets are suggestions only. A member's explicitly entered blank wins too.
  useEffect(() => {
    if (drafts[draftKey] || (online && previous.isPending)) return;
    const target = prescribedReps(activePlan?.reps ?? "", timed);
    const prior = previous.data;
    if (!target && !prior) return;
    const initial: SetDraft = {
      reps: target || String(prior?.duration_seconds ?? prior?.reps ?? ""),
      weight:
        prior?.weight_kg == null
          ? ""
          : String(formatMeasure(displayWeight(prior.weight_kg, units))),
      rpe: "",
      units,
    };
    setDrafts((all) => (all[draftKey] ? all : { ...all, [draftKey]: initial }));
    void change((current) =>
      current.editor?.drafts[draftKey]
        ? current
        : {
            ...current,
            editor: {
              ...current.editor,
              selectedSlot: selection,
              drafts: { ...current.editor?.drafts, [draftKey]: initial },
            },
          },
    ).catch((e: Error) => onError(e.message));
    // The current slot and fetched evidence govern initialization; persisted edits win.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey, activePlan?.reps, timed, previous.data, previous.isPending, online, units]);

  async function logSet(restSeconds: number) {
    primeAudio();
    await run(async () => {
      const parsed = parseSetDraft(draft, timed, units);
      const saved = await change((current) => {
        const next = appendSet(current, {
          exercise_id: exerciseId,
          ...parsed,
          slot_key: selection,
          logging_mode: selected?.logging_mode ?? "weighted_reps",
          load_convention: selected?.load_convention ?? "external_total",
          set_role: role,
          side,
          pair_id: side !== "bilateral" ? pair : null,
          root_set_id: role === "drop" ? root || null : null,
          segment_index:
            role === "drop" ? current.sets.filter((s) => s.root_set_id === root).length + 1 : 0,
        });
        const nextSlot = nextSupersetSlot(current, exerciseId, selection);
        const needsRest = side !== "left" && nextSlot.rest;
        const key = slotDraftKey(exerciseId, selection),
          pending = next.editor?.plannedRows?.[key];
        const editor =
          pending && role === "working" && side !== "left"
            ? {
                ...next.editor!,
                plannedRows: { ...next.editor!.plannedRows, [key]: pending.slice(1) },
              }
            : next.editor;
        return {
          ...next,
          ...(editor ? { editor } : {}),
          restEnd: needsRest ? Date.now() + restSeconds * 1000 : 0,
        };
      });
      haptic("set");
      const nextPair = side === "right" ? crypto.randomUUID() : pair;
      updateDraft({
        rpe: "",
        side: side === "left" ? "right" : side === "right" ? "left" : "bilateral",
        pair_id: nextPair,
        set_role: role,
        root_set_id: root,
      });
      if (side === "left") setSide("right");
      else {
        if (side === "right") {
          setSide("left");
          setPair(nextPair);
        }
        const target = nextSupersetSlot(saved, exerciseId, selection).next;
        if (target) pick(target.id, target.key);
      }
    });
  }

  const plannedInitial: SetDraft = drafts[draftKey] ?? {
    reps: prescribedReps(activePlan?.reps ?? "", timed),
    weight:
      previous.data?.weight_kg == null
        ? ""
        : String(formatMeasure(displayWeight(previous.data.weight_kg, units))),
    rpe: "",
    units,
  };
  function copyPrevious() {
    if (!previous.data) return;
    updateDraft({
      reps: String(previous.data!.duration_seconds ?? previous.data!.reps ?? ""),
      weight:
        previous.data!.weight_kg == null
          ? ""
          : String(formatMeasure(displayWeight(previous.data!.weight_kg, units))),
      rpe: "",
    });
  }
  function copyLeft() {
    const left = [...w.sets.filter((s) => s.sync !== "deleted")]
      .reverse()
      .find((s) => s.pair_id === pair && s.side === "left");
    if (left)
      updateDraft({
        reps: String(left.duration_seconds ?? left.reps ?? ""),
        weight: left.weight_kg == null ? "" : String(displayWeight(left.weight_kg, units)),
        rpe: "",
      });
  }
  function loadWarmup(kg: number, reps: number) {
    updateDraft({
      weight: String(formatMeasure(displayWeight(kg, units))),
      reps: String(reps),
      rpe: "",
      set_role: "warmup",
    });
    setRole("warmup");
  }
  const logging = {
    role,
    side,
    root,
    onRoleChange(value: SetDetails["set_role"]) {
      setRole(value);
      updateDraft({ set_role: value });
    },
    onSideChange(value: SetDetails["side"]) {
      setSide(value);
      updateDraft({ side: value, pair_id: pair });
    },
    onRootChange(value: string) {
      setRoot(value);
      updateDraft({ root_set_id: value });
    },
  };
  return {
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
    logSet,
    copyPrevious,
    copyLeft,
    loadWarmup,
  };
}
