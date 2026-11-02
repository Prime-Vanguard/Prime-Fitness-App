import { useState } from "react";
import type { TrainSearch } from "@/lib/training-search";
import { useI18n } from "@/lib/i18n";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
export function WorkoutHistoryFilters({
  search,
  onApply,
}: {
  search: TrainSearch;
  onApply: (filters: Pick<TrainSearch, "q" | "from" | "to">) => void;
}) {
  const { locale } = useI18n();
  const l = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const [q, setQ] = useState(search.q ?? ""),
    [from, setFrom] = useState(search.from ?? ""),
    [to, setTo] = useState(search.to ?? "");
  const invalid = !!from && !!to && from > to;
  return (
    <form
      className="mt-3 space-y-3 rounded-xl border border-border bg-card p-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!invalid)
          onApply({
            q: q.trim().slice(0, 100) || undefined,
            from: from || undefined,
            to: to || undefined,
          });
      }}
    >
      <label className="block text-sm">
        {l("Search workout titles", "البحث في عناوين الجلسات")}
        <Input
          className="mt-1"
          type="search"
          maxLength={100}
          value={q}
          onChange={(event) => setQ(event.target.value)}
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="min-w-0 text-sm">
          {l("From date", "من تاريخ")}
          <Input
            className="mt-1 min-w-0"
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
          />
        </label>
        <label className="min-w-0 text-sm">
          {l("To date", "إلى تاريخ")}
          <Input
            className="mt-1 min-w-0"
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
          />
        </label>
      </div>
      <p className="text-xs text-muted-foreground">
        {l(
          "Dates use Cairo time. Search includes native and imported workouts.",
          "التواريخ بتوقيت القاهرة. يشمل البحث الجلسات الأصلية والمستوردة.",
        )}
      </p>
      {invalid && (
        <p role="alert" className="text-sm text-destructive">
          {l(
            "From date must be on or before To date.",
            "يجب ألا يكون تاريخ البداية بعد تاريخ النهاية.",
          )}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={invalid}>
          {l("Apply filters", "تطبيق الفلاتر")}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setQ("");
            setFrom("");
            setTo("");
            onApply({});
          }}
        >
          {l("Clear filters", "مسح الفلاتر")}
        </Button>
      </div>
    </form>
  );
}
