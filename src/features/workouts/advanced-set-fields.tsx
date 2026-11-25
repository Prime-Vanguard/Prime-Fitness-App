import { SelectionIndicator } from "@/components/selection-indicator";
import { useId } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";
import { inputNumber } from "@/lib/numeric-input";
import { displayWeight, formatMeasure, weightUnit, type Units } from "@/lib/units";
import type { SetDraft } from "@/lib/workout-editor";

/** Actual additional-set values. Never edits the frozen prescription or planned rows. */
export function AdvancedSetFields({
  draft,
  units,
  timed,
  onChange,
  onError,
}: {
  draft: SetDraft;
  units: Units;
  timed: boolean;
  onChange: (patch: Partial<SetDraft>) => void;
  onError: (error: string) => void;
}) {
  const { locale } = useI18n();
  const l = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const id = useId();
  const fields = [
    {
      key: "weight",
      label: l("Load", "الحمل"),
      accessible:
        l("Additional set weight", "وزن المجموعة الإضافية") + " (" + weightUnit(units) + ")",
      unit: weightUnit(units),
      step: units === "metric" ? 2.5 : 5,
      min: 0,
      max: formatMeasure(displayWeight(1000, units)),
    },
    {
      key: "reps",
      label: timed ? l("Duration", "المدة") : l("Repetitions", "التكرارات"),
      accessible: timed
        ? l("Additional set seconds", "ثواني المجموعة الإضافية")
        : l("Additional set reps", "تكرارات المجموعة الإضافية"),
      unit: timed ? l("sec", "ث") : l("reps", "تكرار"),
      step: timed ? 5 : 1,
      min: 1,
      max: timed ? 86400 : 1000,
    },
  ] as const;
  return (
    <div className="space-y-5" data-advanced-set-fields>
      <div className="grid grid-cols-2 gap-3">
        {fields.map((field) => (
          <div key={field.key} className="min-w-0 rounded-xl bg-background p-3">
            <label
              htmlFor={id + field.key}
              className="block text-center text-xs uppercase tracking-wide text-muted-foreground"
            >
              {field.label} · {field.unit}
            </label>
            <Input
              id={id + field.key}
              aria-label={field.accessible}
              dir="ltr"
              className="mt-2 h-14 border-transparent bg-transparent p-0 text-center font-heading text-3xl font-bold tabular-nums md:text-3xl"
              inputMode={field.key === "reps" ? "numeric" : "decimal"}
              value={draft[field.key]}
              onChange={(event) => {
                onError("");
                onChange({ [field.key]: event.target.value });
              }}
            />
            <div className="mt-2 grid grid-cols-2 gap-2">
              {[-1, 1].map((direction) => (
                <Button
                  type="button"
                  dir="ltr"
                  variant="secondary"
                  className="px-1 font-sans tabular-nums"
                  key={direction}
                  aria-label={
                    (direction < 0 ? l("Decrease ", "تقليل ") : l("Increase ", "زيادة ")) +
                    field.accessible
                  }
                  onClick={() => {
                    try {
                      const current =
                        inputNumber(draft[field.key], {
                          label: field.label,
                          min: field.key === "weight" ? 0 : 1,
                          max: field.max,
                          integer: field.key === "reps",
                        }) ?? 0;
                      onError("");
                      onChange({
                        [field.key]: String(
                          formatMeasure(
                            Math.min(
                              field.max,
                              Math.max(field.min, current + direction * field.step),
                            ),
                          ),
                        ),
                      });
                    } catch {
                      onError(
                        l(
                          "Correct the value before using the adjustment buttons.",
                          "صحّح القيمة قبل استخدام أزرار التعديل.",
                        ),
                      );
                    }
                  }}
                >
                  {direction < 0 ? "−" : "+"}
                  {field.step}
                </Button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <fieldset className="min-w-0 space-y-3">
        <legend className="mb-2 font-heading text-sm font-bold">
          {l("Actual effort (RPE)", "الجهد الفعلي (RPE)")}
        </legend>
        <div className="sliding-selection flex gap-2 overflow-x-auto pb-1">
          {/* Highlight the entered RPE without changing set evidence or its save lifecycle. */}
          <SelectionIndicator />
          {[6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10].map((value) => (
            <Button
              type="button"
              variant="secondary"
              key={value}
              aria-label={"RPE " + value}
              aria-pressed={draft.rpe === String(value)}
              className={
                "min-w-11 shrink-0 px-2 font-sans tabular-nums " +
                (draft.rpe === String(value)
                  ? "bg-raised text-gold"
                  : "bg-background text-muted-foreground")
              }
              onClick={() => {
                onError("");
                // A second tap clears optional evidence rather than inventing an effort rating.
                onChange({ rpe: draft.rpe === String(value) ? "" : String(value) });
              }}
            >
              {value}
            </Button>
          ))}
        </div>
        <label className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
          {l("Custom effort · optional", "جهد مخصص · اختياري")}
          <Input
            aria-label={l("Additional-set RPE", "جهد المجموعة الإضافية")}
            dir="ltr"
            className="w-20 bg-background text-center tabular-nums"
            inputMode="decimal"
            value={draft.rpe}
            onChange={(event) => {
              onError("");
              onChange({ rpe: event.target.value });
            }}
          />
        </label>
        <p className="text-xs leading-5 text-muted-foreground">
          {l(
            "Effort from 1–10. Leave blank when unsure; missing effort can hold a coach's progression suggestion.",
            "الجهد من 1 إلى 10. اتركه فارغاً إن لم تتأكد؛ قد يوقف غياب التقييم اقتراح التدرج من مدربك.",
          )}
        </p>
      </fieldset>
    </div>
  );
}
