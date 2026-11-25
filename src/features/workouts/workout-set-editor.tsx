import { useId, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import type { WorkoutSet } from "@/lib/workout-store";
import { parseSetDraft, stepMeasure, type SetDraft } from "@/lib/workout-editor";
import { displayWeight, formatMeasure, weightUnit, type Units } from "@/lib/units";
export function DraftFields({
  draft,
  onChange,
  timed,
  units,
  effortOpen = false,
}: {
  draft: SetDraft;
  onChange: (v: Partial<SetDraft>) => void;
  timed: boolean;
  units: Units;
  /** Show RPE without the toggle, e.g. when editing a logged set. */
  effortOpen?: boolean;
}) {
  const { locale, t } = useI18n();
  const l = (en: string, ar: string) => (locale === "ar" ? ar : en);
  // RPE is optional; keep it out of the way unless asked for or already filled.
  const [effort, setEffort] = useState(effortOpen || !!draft.rpe);
  const id = useId();
  const steps = {
    weight: units === "imperial" ? 5 : 2.5,
    reps: timed ? 5 : 1,
  };
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-3">
        {(
          [
            ["weight", weightUnit(units)],
            ["reps", timed ? l("Seconds", "ثوانٍ") : t("reps")],
          ] as const
        ).map(([key, label]) => (
          <div key={key} className="min-w-0">
            <label htmlFor={`${id}-${key}`} className="text-xs text-muted-foreground">
              {label}
            </label>
            <div className="mt-1 flex items-center gap-1" dir="ltr">
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="h-12 w-9 shrink-0 text-lg"
                aria-label={l(`Decrease ${label}`, `إنقاص ${label}`)}
                onClick={() => onChange({ [key]: stepMeasure(draft[key], -steps[key]) })}
              >
                −
              </Button>
              <Input
                id={`${id}-${key}`}
                aria-label={label}
                className="h-12 min-w-0 flex-1 px-0.5 text-center text-lg font-semibold tabular-nums"
                inputMode={key === "reps" ? "numeric" : "decimal"}
                value={draft[key]}
                onChange={(e) => onChange({ [key]: e.target.value })}
              />
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="h-12 w-9 shrink-0 text-lg"
                aria-label={l(`Increase ${label}`, `زيادة ${label}`)}
                onClick={() => onChange({ [key]: stepMeasure(draft[key], steps[key]) })}
              >
                +
              </Button>
            </div>
          </div>
        ))}
      </div>
      {effort || draft.rpe ? (
        <label className="block text-xs text-muted-foreground">
          RPE 1–10
          <Input
            aria-label="RPE 1–10"
            className="mt-1 h-11 px-2 text-center text-base font-semibold tabular-nums"
            inputMode="decimal"
            value={draft.rpe}
            onChange={(e) => onChange({ rpe: e.target.value })}
          />
          <span className="mt-1 block">
            {l(
              "Effort from 1–10. Leave blank if unsure; your coach's progression rule may hold.",
              "الجهد من 1 إلى 10. اتركه فارغاً إن لم تتأكد؛ قد يتوقف اقتراح التدرج.",
            )}
          </span>
        </label>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          onClick={() => setEffort(true)}
        >
          {l("Add effort (RPE)", "إضافة الجهد (RPE)")}
        </Button>
      )}
    </div>
  );
}
export function SetEditor({
  row,
  units,
  onClose,
  onSave,
}: {
  row: WorkoutSet;
  units: Units;
  onClose: () => void;
  onSave: (value: ReturnType<typeof parseSetDraft>) => Promise<void>;
}) {
  const { locale, t } = useI18n();
  const [draft, setDraft] = useState<SetDraft>({
    reps: String(row.duration_seconds ?? row.reps ?? ""),
    weight: row.weight_kg == null ? "" : String(formatMeasure(displayWeight(row.weight_kg, units))),
    rpe: String(row.rpe ?? ""),
  });
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <Sheet
      open
      onOpenChange={(o) => {
        if (!o && !busy) onClose();
      }}
    >
      <SheetContent side="bottom" className="rounded-t-2xl p-5">
        <div className="mx-auto max-w-lg space-y-4">
          <SheetTitle>
            {locale === "ar" ? "تعديل المجموعة" : "Edit set"} {row.set_number}
          </SheetTitle>
          <SheetDescription>
            {locale === "ar"
              ? "تحديث المجموعة نفسها مع الاحتفاظ بنوعها وجانبها."
              : "Update this set while keeping its type and side."}
          </SheetDescription>
          <DraftFields
            draft={draft}
            onChange={(v) => setDraft((d) => ({ ...d, ...v }))}
            timed={row.logging_mode === "timed"}
            units={units}
            effortOpen
          />
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button
            disabled={busy}
            className="w-full"
            onClick={() => {
              setBusy(true);
              setError("");
              void Promise.resolve()
                .then(() => onSave(parseSetDraft(draft, row.logging_mode === "timed", units)))
                .catch((e: Error) => setError(e.message))
                .finally(() => setBusy(false));
            }}
          >
            {t("save")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
