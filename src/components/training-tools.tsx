import { NativeSelect } from "@/components/ui/native-select";
import { displayWeight, storedWeight, formatMeasure, weightUnit, type Units } from "@/lib/units";
import { useState } from "react";
import { Calculator } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { plateLoad, warmupSets } from "@/lib/training-tools";
import { useI18n } from "@/lib/i18n";
import { inputNumber } from "@/lib/numeric-input";

export function TrainingTools({
  weight,
  units = "metric",
  onWarmup,
  onWorkingWeight,
}: {
  weight: number;
  units?: Units;
  onWarmup: (weight: number, reps: number) => void;
  onWorkingWeight?: (weight: number) => void;
}) {
  const { locale } = useI18n();
  const l = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const wu = weightUnit(units);
  const [bar, setBar] = useState(units === "imperial" ? 45 : 20);
  const [text, setText] = useState(String(formatMeasure(displayWeight(weight, units))));
  let total = NaN;
  try {
    total = inputNumber(text, { label: "Weight", max: units === "imperial" ? 2205 : 1000 }) ?? NaN;
  } catch {
    /* Keep incomplete numeric drafts editable. */
  }
  const [warmups, setWarmups] = useState<ReturnType<typeof warmupSets>>([]);
  const load = plateLoad(total, bar, units === "imperial" ? [45, 35, 25, 10, 5, 2.5] : undefined);
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          onClick={() => {
            setText(String(formatMeasure(displayWeight(weight, units))));
            setBar(units === "imperial" ? 45 : 20);
            setWarmups([]);
          }}
        >
          <Calculator size={16} />
          {l("Plates & warm-up", "الأقراص والإحماء")}
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto rounded-t-2xl p-6">
        <div className="mx-auto w-full max-w-lg space-y-5">
          <SheetTitle>{l("Load your bar", "جهّز البار")}</SheetTitle>
          <SheetDescription>
            {l(
              "Weights include the bar. Plates shown are needed on each side; check availability at your gym.",
              "الأوزان تشمل البار. الأقراص المعروضة لكل جانب؛ تحقق من توافرها في النادي.",
            )}
          </SheetDescription>
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-2 text-sm">
              {l("Working weight", "وزن العمل")} ({wu})
              <Input
                inputMode="decimal"
                dir="ltr"
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  setWarmups([]);
                }}
              />
            </label>
            <label className="space-y-2 text-sm min-w-0 max-w-full block">
              {l("Bar", "البار")} ({wu})
              <NativeSelect
                className="mt-2"
                value={bar}
                onChange={(e) => {
                  setBar(Number(e.target.value));
                  setWarmups([]);
                }}
              >
                {(units === "imperial" ? [15, 35, 45] : [10, 15, 20]).map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </NativeSelect>
            </label>
          </div>
          {onWorkingWeight && (
            <Button
              variant="outline"
              disabled={!Number.isFinite(total)}
              onClick={() => onWorkingWeight(storedWeight(total, units))}
            >
              {l("Use as actual working weight", "استخدامه كوزن العمل الفعلي")}
            </Button>
          )}
          {load ? (
            <>
              <div
                dir="ltr"
                className="flex min-h-28 items-center justify-center gap-1 overflow-x-auto rounded-xl bg-muted/40 p-4"
                aria-label={l("Plates per side", "الأقراص لكل جانب")}
              >
                <div className="h-3 w-10 shrink-0 rounded bg-slate-400" />
                {load.plates.map((p, i) => (
                  <div
                    key={i}
                    className={`flex w-11 shrink-0 items-center justify-center rounded border-2 font-bold ${p >= 20 ? "border-gold bg-gold/20 text-gold" : "border-slate-400 bg-slate-700 text-white"}`}
                    style={{ height: 40 + p * 2 }}
                  >
                    {p}
                  </div>
                ))}
                <div className="h-3 w-6 shrink-0 rounded bg-slate-400" />
              </div>
              <p className="text-center text-sm">
                {l("Each side", "كل جانب")}: {load.plates.join(" + ") || l("empty bar", "بار فارغ")}{" "}
                {wu}
              </p>
              <p className="text-center text-sm text-gold">
                {bar} + 2 × {load.plates.reduce((a, b) => a + b, 0)} = {load.total} {wu}
              </p>
              {load.remainder > 0 && (
                <p role="status" className="text-sm text-amber-400">
                  {l(
                    "Exact load unavailable with standard plates. Closest lower load:",
                    "الوزن الدقيق غير متاح بالأقراص القياسية. أقرب وزن أقل:",
                  )}{" "}
                  {load.total} {wu}
                </p>
              )}
            </>
          ) : (
            <p role="alert">
              {l(
                "Enter a weight at least equal to the bar.",
                "أدخل وزناً يساوي وزن البار أو يزيد عنه.",
              )}
            </p>
          )}
          <Button
            className="w-full"
            disabled={!load || total <= bar}
            onClick={() => setWarmups(warmupSets(total, bar, units === "imperial" ? 5 : 2.5))}
          >
            {l("Generate warm-up sets", "إنشاء مجموعات الإحماء")}
          </Button>
          <div className="grid grid-cols-2 gap-2">
            {warmups.map((s) => (
              <Button
                variant="outline"
                key={s.weight}
                onClick={() => onWarmup(storedWeight(s.weight, units), s.reps)}
              >
                {s.weight} {wu} × {s.reps}
              </Button>
            ))}
          </div>
          {!!warmups.length && (
            <p className="text-xs text-muted-foreground">
              {l(
                "Tap a suggestion to fill the logger; log it only after completing the set. Adjust to your readiness.",
                "اضغط لملء السجل؛ سجّل المجموعة بعد أدائها فقط. عدّل حسب استعدادك.",
              )}
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
