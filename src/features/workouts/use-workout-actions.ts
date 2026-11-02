import { useRef, useState } from "react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { haptic, primeAudio } from "@/lib/device-feedback";
import {
  deleteWorkoutSets,
  restoreWorkoutSets,
  completePlannedRow,
  nextSupersetSlot,
  type SetDraft,
} from "@/lib/workout-editor";
import type { WorkoutSet } from "@/lib/workout-store";
import type { Units } from "@/lib/units";
import type { WorkoutSessionController } from "./types";

/** Serializes session commands; feedback follows durable local acceptance. */
export function useWorkoutActions(
  controller: Pick<WorkoutSessionController, "workout" | "change">,
) {
  const { workout: w, change } = controller;
  const { locale } = useI18n();
  const l = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState("");
  async function run(action: () => Promise<unknown>, propagate = false) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      if (propagate) throw e;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function remove(row: WorkoutSet) {
    const removed = w.sets.filter((s) => s.id === row.id || s.root_set_id === row.id);
    await run(async () => {
      await change((current) => deleteWorkoutSets(current, row.id));
      toast(l("Set removed", "تم حذف المجموعة"), {
        duration: 8000,
        action: {
          label: l("Undo", "تراجع"),
          onClick: () => {
            void change((current) => restoreWorkoutSets(current, removed)).catch((e: Error) =>
              toast.error(e.message),
            );
          },
        },
      });
    });
  }

  function completePlannedSet({
    id,
    value,
    exerciseId,
    selection,
    units,
    restSeconds,
    onNext,
  }: {
    id: string;
    value: SetDraft;
    exerciseId: string;
    selection: string;
    units: Units;
    restSeconds: number;
    onNext: (id: string, slot: string) => void;
  }) {
    return run(async () => {
      if (w.holdStartedAt)
        throw new Error(l("Stop the hold before completing a row.", "أوقف الثبات قبل إكمال الصف."));
      primeAudio();
      const saved = await change((current) => {
        const next = completePlannedRow(current, exerciseId, selection, id, value, units);
        return {
          ...next,
          restEnd: nextSupersetSlot(next, exerciseId, selection).rest
            ? Date.now() + restSeconds * 1000
            : 0,
        };
      });
      haptic("set");
      const target = nextSupersetSlot(saved, exerciseId, selection).next;
      if (target) onNext(target.id, target.key);
    }, true);
  }
  return { busy, error, setError, run, remove, completePlannedSet };
}
