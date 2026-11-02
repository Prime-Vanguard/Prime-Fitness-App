import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { workingCount, workoutSlots } from "@/lib/workout-editor";
import type { WorkoutSet } from "@/lib/workout-store";
export function WorkoutReview({
  open,
  discard,
  busy,
  error,
  sets,
  slots,
  exerciseName,
  onClose,
  onConfirm,
}: {
  open: boolean;
  discard: boolean;
  busy: boolean;
  error: string;
  sets: WorkoutSet[];
  slots: ReturnType<typeof workoutSlots>;
  exerciseName: (id: string) => string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const { t, locale } = useI18n(),
    l = (en: string, ar: string) => (locale === "ar" ? ar : en);
  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <SheetContent side="bottom" className="max-h-[85dvh] overflow-auto rounded-t-2xl p-5">
        <div className="mx-auto max-w-lg space-y-4">
          <SheetTitle>
            {discard ? t("discardWorkout") : l("Review workout", "مراجعة التمرين")}
          </SheetTitle>
          <SheetDescription>
            {discard
              ? t("discardConfirm")
              : l(
                  "Review completed work before saving. Unfinished targets are not logged; XP is confirmed after sync.",
                  "راجع المجموعات قبل الحفظ. الأهداف غير المكتملة لا تُسجل؛ تُعتمد النقاط بعد المزامنة.",
                )}
          </SheetDescription>
          {!discard && (
            <>
              <p>
                {workingCount(sets)} {l("working sets completed", "مجموعات عمل مكتملة")}
              </p>
              <ul className="space-y-2 text-sm">
                {slots.map((s) => (
                  <li key={`${s.key}:${s.id}`}>
                    {exerciseName(s.id)} ·{" "}
                    {workingCount(
                      sets.filter((r) => r.exercise_id === s.id && (r.slot_key ?? "") === s.key),
                    )}
                    {s.sets ? ` / ${s.sets}` : ""}
                  </li>
                ))}
              </ul>
            </>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button
            className="w-full"
            variant={discard ? "destructive" : "default"}
            disabled={busy}
            onClick={onConfirm}
          >
            {discard ? t("discardWorkout") : l("Save workout", "حفظ التمرين")}
          </Button>
          <Button variant="outline" className="w-full" onClick={onClose}>
            {t("cancel")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
