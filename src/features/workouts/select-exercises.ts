import type { Workout } from "@/lib/workout-store";
import type { ExerciseGuidance } from "@/lib/exercise-guidance";

/** Applies one picker confirmation. Call only inside the existing local transaction. */
export function selectExercises(
  workout: Workout,
  choices: readonly { id: string; slot: string }[],
  replace?: { exercise: string; slot: string },
  locale: "en" | "ar" = "en",
): Workout {
  const l = (en: string, ar: string) => (locale === "ar" ? ar : en);
  if (workout.phase !== "active" || !workout.session)
    throw new Error(l("This workout is no longer editable.", "لم تعد هذه الجلسة قابلة للتعديل."));
  if (workout.holdStartedAt)
    throw new Error(
      l("Stop the current hold before switching exercises.", "أوقف الثبات قبل تغيير التمرين."),
    );
  if (
    !choices.length ||
    choices.length > 20 ||
    (replace && choices.length !== 1) ||
    new Set(choices.map((choice) => choice.slot)).size !== choices.length
  )
    throw new Error(l("Choose between 1 and 20 exercises.", "اختر من تمرين واحد إلى ٢٠ تمريناً."));
  const catalogue = new Map(
    workout.exercises.map((exercise) => [exercise.id, exercise as ExerciseGuidance]),
  );
  const selected = choices.map((choice) => {
    const exercise = catalogue.get(choice.id);
    if (!exercise || exercise.active === false || exercise.guidance?.catalogue_kind === "cardio")
      throw new Error(
        l(
          "This exercise is unavailable for strength logging.",
          "هذا التمرين غير متاح لتسجيل القوة.",
        ),
      );
    return { ...choice, exercise };
  });
  const first = selected[0]!;
  let replacementIndex = -1;
  let selectedSlot = replace?.slot ?? first.slot;
  if (replace) {
    const matches = workout.plan.flatMap((item, index) =>
      item.id === replace.exercise && (item.slot_key ?? "") === replace.slot ? [index] : [],
    );
    if (matches.length === 1) {
      replacementIndex = matches[0]!;
      const collision = workout.plan.some(
        (item, index) =>
          index !== replacementIndex &&
          item.id === first.id &&
          (item.slot_key ?? "") === replace.slot,
      );
      if (collision && replace.slot === "") selectedSlot = first.slot;
      else if (collision) replacementIndex = -1;
    } else if (matches.length === 0) {
      // A retried confirmation may already have replaced the original exercise.
      const retained = workout.plan.flatMap((item, index) =>
        item.id === first.id && (item.slot_key ?? "") === first.slot ? [index] : [],
      );
      const applied = retained.length
        ? retained
        : workout.plan.flatMap((item, index) =>
            item.id === first.id && (item.slot_key ?? "") === replace.slot ? [index] : [],
          );
      if (applied.length === 1) {
        replacementIndex = applied[0]!;
        selectedSlot = workout.plan[replacementIndex]!.slot_key ?? "";
      }
    }
    if (replacementIndex < 0)
      throw new Error(
        l(
          "This exercise slot has changed. Reopen the picker.",
          "تغيرت خانة التمرين. أعد فتح المكتبة.",
        ),
      );
  }
  const plan = replace
    ? workout.plan.map((item, index) =>
        index === replacementIndex
          ? { ...item, id: first.id, slot_key: selectedSlot, exercise: first.exercise }
          : item,
      )
    : [...workout.plan];
  if (!replace)
    for (const choice of selected) {
      const existing = plan.find((item) => item.slot_key === choice.slot);
      if (existing && existing.id !== choice.id)
        throw new Error(
          l(
            "This exercise slot has changed. Reopen the picker.",
            "تغيرت خانة التمرين. أعد فتح المكتبة.",
          ),
        );
      if (!existing)
        plan.push({
          id: choice.id,
          slot_key: choice.slot,
          sets: 0,
          reps: "",
          exercise: choice.exercise,
        });
    }
  return {
    ...workout,
    plan,
    ...(replace ? { superset: [], supersetSlots: [] } : {}),
    editor: {
      ...workout.editor,
      drafts: workout.editor?.drafts ?? {},
      selectedSlot,
      selectedExercise: first.id,
    },
  };
}
