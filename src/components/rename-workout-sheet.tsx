import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { workoutTitleSchema } from "@/lib/workout-title";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "./ui/sheet";

/** Bottom sheet that edits a workout name; the caller decides where it is saved. */
export function RenameWorkoutSheet({
  open,
  onOpenChange,
  initial,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: string;
  onSave: (title: string) => Promise<void>;
}) {
  const { locale } = useI18n();
  const l = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const [value, setValue] = useState(initial);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  // Opened by the caller, so start each opening from the current name.
  useEffect(() => {
    if (!open) return;
    setValue(initial);
    setError("");
  }, [open, initial]);
  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!busy) onOpenChange(next);
      }}
    >
      <SheetContent side="bottom" className="rounded-t-2xl p-5">
        <form
          className="mx-auto max-w-lg space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const parsed = workoutTitleSchema.safeParse(value);
            if (!parsed.success) {
              setError(l("Enter a name of 1–80 characters.", "اكتب اسماً من 1 إلى 80 حرفاً."));
              return;
            }
            setBusy(true);
            onSave(parsed.data)
              .then(() => onOpenChange(false))
              .catch((e: Error) =>
                setError(e.message || l("Could not save the name.", "تعذر حفظ الاسم.")),
              )
              .finally(() => setBusy(false));
          }}
        >
          <SheetTitle>{l("Workout name", "اسم التمرين")}</SheetTitle>
          <SheetDescription>
            {l("Shown in your workout and history.", "يظهر في التمرين وفي السجل.")}
          </SheetDescription>
          <Input
            aria-label={l("Workout name", "اسم التمرين")}
            autoFocus
            maxLength={80}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            aria-invalid={!!error || undefined}
          />
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={busy}>
            {l("Save name", "حفظ الاسم")}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
