import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import type { WorkoutSet } from "@/lib/workout-store";
import { parseSetDraft, type SetDraft } from "@/lib/workout-editor";
import { displayWeight, formatMeasure, weightUnit, type Units } from "@/lib/units";
export function DraftFields({
  draft,
  onChange,
  timed,
  units,
}: {
  draft: SetDraft;
  onChange: (v: Partial<SetDraft>) => void;
  timed: boolean;
  units: Units;
}) {
  const { locale, t } = useI18n();
  return (
    <div className="grid grid-cols-3 gap-2">
      {(
        [
          ["weight", weightUnit(units)],
          ["reps", timed ? (locale === "ar" ? "ثوانٍ" : "Seconds") : t("reps")],
          ["rpe", "RPE 1–10"],
        ] as const
      ).map(([key, label]) => (
        <label key={key} className="min-w-0 text-xs text-muted-foreground">
          {label}
          <Input
            className="mt-1 h-12 text-base tabular-nums"
            inputMode={key === "reps" ? "numeric" : "decimal"}
            value={draft[key]}
            onChange={(e) => onChange({ [key]: e.target.value })}
          />
        </label>
      ))}
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
