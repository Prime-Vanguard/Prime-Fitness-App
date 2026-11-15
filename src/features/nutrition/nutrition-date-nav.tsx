import { SelectionIndicator } from "@/components/selection-indicator";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";
import { addDays } from "@/lib/dates";
import { weekStart } from "@/lib/streaks";

export function NutritionDateNav({
  day,
  today,
  onSelect,
  days = {},
}: {
  day: string;
  today: string;
  onSelect: (day: string) => void;
  days?: Record<string, { logged: boolean; pending: boolean; cached: boolean }>;
}) {
  const { locale, t } = useI18n();
  const l = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const format = (date: string, weekday: "short" | "long") =>
    new Date(`${date}T12:00:00Z`).toLocaleDateString(locale === "ar" ? "ar-EG" : "en-GB", {
      timeZone: "Africa/Cairo",
      weekday,
      month: "short",
      day: "numeric",
    });
  return (
    <section className="mt-4 space-y-3" aria-label={l("Nutrition dates", "تواريخ التغذية")}>
      <div className="flex items-center gap-2 rounded-xl bg-card p-2">
        <Button
          variant="ghost"
          size="icon"
          aria-label={l("Previous day", "اليوم السابق")}
          onClick={() => onSelect(addDays(day, -1))}
        >
          <ChevronLeft aria-hidden className="size-5 rtl:rotate-180" />
        </Button>
        <label className="min-w-0 flex-1 text-center">
          <span className="sr-only">{l("Log date", "تاريخ السجل")}</span>
          <Input
            type="date"
            dir="ltr"
            className="border-0 bg-transparent text-center font-semibold"
            value={day}
            max={today}
            onChange={(event) => onSelect(event.target.value || today)}
          />
        </label>
        <Button
          variant="ghost"
          size="icon"
          aria-label={l("Next day", "اليوم التالي")}
          disabled={day >= today}
          onClick={() => onSelect(addDays(day, 1))}
        >
          <ChevronRight aria-hidden className="size-5 rtl:rotate-180" />
        </Button>
      </div>
      <div
        className="sliding-selection grid grid-cols-7 gap-1"
        aria-label={l("Week dates", "أيام الأسبوع")}
      >
        {/* Follow the explicit activity date without altering Cairo-day calculations. */}
        <SelectionIndicator />
        {Array.from({ length: 7 }, (_, index) => addDays(weekStart(day), index)).map((date) => (
          <button
            key={date}
            type="button"
            disabled={date > today}
            aria-label={`${format(date, "long")} · ${days[date]?.pending ? l("Changes pending", "تغييرات معلقة") : days[date]?.logged ? l("Food logged", "طعام مسجل") : days[date] ? l("No food entries", "لا توجد سجلات طعام") : l("Not loaded", "لم تُحمّل البيانات")}`}
            aria-pressed={date === day}
            className={
              "flex min-h-11 min-w-0 flex-col items-center justify-center rounded-lg text-[11px] disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold " +
              (date === day ? "bg-raised text-gold" : "bg-card text-muted-foreground")
            }
            onClick={() => onSelect(date)}
            data-nutrition-day={date}
          >
            <span>
              {new Date(`${date}T12:00:00Z`).toLocaleDateString(
                locale === "ar" ? "ar-EG" : "en-GB",
                { weekday: "narrow", timeZone: "Africa/Cairo" },
              )}
            </span>
            <span className="mt-1 tabular-nums">{Number(date.slice(-2))}</span>
            <span aria-hidden className="mt-1 text-[10px] leading-3">
              {days[date]?.pending ? "◌" : days[date]?.logged ? "●" : days[date] ? "○" : "—"}
            </span>
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        {l(
          "● Food logged · ◌ Pending changes · — Not loaded. Cached history can be incomplete.",
          "● طعام مسجل · ◌ تغييرات معلقة · — لم تُحمّل البيانات. قد يكون السجل المخزن غير مكتمل.",
        )}
      </p>
      {day !== today && (
        <Button variant="ghost" className="w-full" onClick={() => onSelect(today)}>
          {t("today")}
        </Button>
      )}
    </section>
  );
}
