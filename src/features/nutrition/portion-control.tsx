import { useState } from "react";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useI18n } from "@/lib/i18n";
import { inputNumber } from "@/lib/numeric-input";
import { servingMeasure } from "./serving-measure";
export function PortionControl({
  portion,
  serving,
  onChange,
}: {
  portion: string;
  serving: string;
  onChange: (value: string) => void;
}) {
  const { locale } = useI18n(),
    ar = locale === "ar";
  const [metric, setMetric] = useState(false);
  const [typed, setTyped] = useState<{ value: string; portion: string; serving: string } | null>(
    null,
  );
  const base = servingMeasure(serving),
    active = metric && !!base;
  let value = portion;
  try {
    if (active)
      value = String(
        Math.round((inputNumber(portion, { label: "Portion" }) ?? 0) * base.amount * 10000) / 10000,
      );
  } catch {
    value = "";
  }
  if (active && typed?.portion === portion && typed.serving === serving) value = typed.value;
  return (
    <div className="col-span-2 space-y-2">
      {base && (
        <label className="block text-sm">
          {ar ? "وحدة الكمية" : "Amount unit"}
          <NativeSelect
            aria-label={ar ? "وحدة الكمية" : "Amount unit"}
            className="mt-1"
            value={active ? base.unit : "servings"}
            onChange={(event) => {
              setMetric(event.target.value !== "servings");
              setTyped(null);
            }}
          >
            <option value="servings">{ar ? "حصص" : "Servings"}</option>
            <option value={base.unit}>{base.unit}</option>
          </NativeSelect>
        </label>
      )}
      <label className="block text-sm">
        {active
          ? `${ar ? "الكمية" : "Amount"} (${base.unit})`
          : ar
            ? "مضاعف الحصة"
            : "Portion multiplier"}
        <Input
          className="mt-2 h-14 bg-background text-center text-2xl font-bold tabular-nums md:text-2xl"
          dir="ltr"
          inputMode="decimal"
          value={value}
          onChange={(event) => {
            const raw = event.target.value;
            if (!active) return onChange(raw);
            let next = raw;
            try {
              const amount = inputNumber(raw, { label: "Amount", min: 0, max: 100000 });
              next = amount == null ? "" : String(amount / base.amount);
            } catch {
              next = "invalid";
            }
            setTyped({ value: raw, portion: next, serving });
            onChange(next);
          }}
        />
      </label>
    </div>
  );
}
