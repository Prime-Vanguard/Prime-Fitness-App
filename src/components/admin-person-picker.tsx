import { useId, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { Input } from "@/components/ui/input";
import { normalizeExercise } from "@/lib/exercise-guidance";

type Person = { id: string; display_name: string | null; email: string | null };
export function AdminPersonPicker({
  people,
  value,
  onChange,
  label,
  disabled = false,
  emptyLabel,
}: {
  people: Person[];
  value: string;
  onChange: (id: string) => void;
  label: string;
  disabled?: boolean;
  emptyLabel?: string;
}) {
  const { locale } = useI18n();
  const [search, setSearch] = useState("");
  const id = useId();
  const matches = useMemo(
    () =>
      people.filter((p) =>
        normalizeExercise(`${p.display_name ?? ""} ${p.email ?? ""}`).includes(
          normalizeExercise(search),
        ),
      ),
    [people, search],
  );
  const selected = people.find((p) => p.id === value);
  const visible = matches.slice(0, 50);
  const options =
    selected && !visible.some((p) => p.id === value) ? [selected, ...visible] : visible;
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <Input
        disabled={disabled}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        aria-label={`${locale === "ar" ? "بحث" : "Search"} ${label}`}
        placeholder={
          locale === "ar" ? "بحث بالاسم أو البريد الإلكتروني" : "Search by name or email"
        }
      />
      <select
        id={id}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
      >
        <option value="">
          {emptyLabel ?? (locale === "ar" ? "اختر عضواً" : "Choose a member")}
        </option>
        {options.map((p) => (
          <option key={p.id} value={p.id}>
            {p.display_name || p.email || p.id}
          </option>
        ))}
      </select>
      <p role="status" className="text-xs text-muted-foreground">
        {matches.length > 50
          ? locale === "ar"
            ? "تظهر أول ٥٠ نتيجة. استخدم البحث لتضييق الاختيار."
            : "Showing the first 50 matches. Search to narrow your selection."
          : locale === "ar"
            ? `${matches.length} نتيجة`
            : `${matches.length} matches`}
      </p>
    </div>
  );
}
