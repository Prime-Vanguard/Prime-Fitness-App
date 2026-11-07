import { NativeSelect } from "@/components/ui/native-select";
import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { normalizeExercise } from "@/lib/exercise-guidance";
import { Input } from "./ui/input";
export function ImportMappingPicker({
  name,
  value,
  exercises,
  disabled,
  onChange,
}: {
  name: string;
  value: string;
  exercises: { id: string; name_en: string; name_ar: string | null }[];
  disabled: boolean;
  onChange: (id: string) => void;
}) {
  const { locale } = useI18n(),
    ar = locale === "ar",
    [search, setSearch] = useState("");
  const matches = exercises.filter((e) =>
    normalizeExercise(`${e.name_en} ${e.name_ar ?? ""}`).includes(normalizeExercise(search)),
  );
  const selected = exercises.find((e) => e.id === value),
    first = matches.slice(0, 50),
    options = selected && !first.some((e) => e.id === value) ? [selected, ...first] : first;
  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <p className="break-words text-sm font-medium">{name}</p>
      <Input
        disabled={disabled}
        aria-label={`${ar ? "بحث تعيين" : "Search mapping"}: ${name}`}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={ar ? "بحث في مكتبة التمارين" : "Search exercise catalogue"}
      />
      <NativeSelect
        aria-label={name}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{ar ? "اختر تمريناً" : "Choose an exercise"}</option>
        <option value="skip">
          {ar ? "استبعاد هذه المجموعات صراحة" : "Explicitly exclude these sets"}
        </option>
        {options.map((e) => (
          <option key={e.id} value={e.id}>
            {ar ? e.name_ar || e.name_en : e.name_en}
          </option>
        ))}
      </NativeSelect>
      {matches.length > 50 && (
        <p className="text-xs text-muted-foreground">
          {ar
            ? "أول ٥٠ نتيجة؛ استخدم البحث للتصفية."
            : "First 50 matches; search to narrow the list."}
        </p>
      )}
    </div>
  );
}
