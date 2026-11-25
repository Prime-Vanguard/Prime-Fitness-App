import { useI18n } from "@/lib/i18n";
import { activityDay, addDays } from "@/lib/dates";
import type { Units } from "@/lib/units";
import type { CardioRecord } from "./model";

export function CardioSummary({
  records,
  units,
  available,
  loading,
  compact = false,
}: {
  records: CardioRecord[];
  units: Units;
  available: boolean;
  loading: boolean;
  compact?: boolean;
}) {
  const { locale } = useI18n();
  const l = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const today = activityDay();
  const recent = records.filter((r) => r.log_date >= addDays(today, -6) && r.log_date <= today);
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(today, index - 6);
    return {
      date,
      minutes:
        recent.filter((r) => r.log_date === date).reduce((sum, r) => sum + r.duration_seconds, 0) /
        60,
    };
  });
  const peak = Math.max(1, ...days.map((day) => day.minutes));
  if (!available)
    return (
      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="font-heading text-base font-bold">{l("Last 7 days", "آخر 7 أيام")}</h2>
        <p role="status" className="mt-2 text-sm text-muted-foreground">
          {loading
            ? l("Loading recorded activity…", "جارٍ تحميل النشاط المسجّل…")
            : l(
                "Recent activity is unavailable. Reconnect or refresh history.",
                "النشاط الأخير غير متاح. اتصل أو حدّث السجل.",
              )}
        </p>
      </section>
    );
  if (compact)
    return (
      <section
        className="rounded-xl border border-border bg-card p-4"
        aria-label={l("Recent cardio summary", "ملخص الكارديو الأخير")}
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm text-muted-foreground">{l("Last 7 days", "آخر 7 أيام")}</h2>
          <p className="font-semibold tabular-nums">
            {(recent.reduce((s, r) => s + r.duration_seconds, 0) / 60).toFixed(1)}{" "}
            {l("min recorded", "دقيقة مسجلة")}
          </p>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {recent.length}{" "}
          {l("sessions · includes pending device entries", "جلسات · تشمل إدخالات الجهاز المعلقة")}
        </p>
      </section>
    );
  return (
    <section
      className="space-y-4 rounded-xl border border-border bg-card p-4"
      aria-label={l("Seven-day cardio activity", "نشاط الكارديو خلال سبعة أيام")}
    >
      <h2 className="font-heading text-base font-bold">{l("Last 7 days", "آخر 7 أيام")}</h2>
      <div className="grid grid-cols-3 gap-2">
        {[
          [String(recent.length), l("Sessions", "جلسات")],
          [
            (recent.reduce((s, r) => s + r.duration_seconds, 0) / 60).toFixed(1),
            l("Minutes", "دقائق"),
          ],
          [
            (
              recent.reduce((s, r) => s + (r.distance_m ?? 0), 0) /
              (units === "imperial" ? 1609.344 : 1000)
            ).toFixed(2),
            units === "imperial" ? "mi" : "km",
          ],
        ].map(([value, label]) => (
          <div key={label} className="min-w-0 rounded-lg bg-background p-3 text-center">
            <p className="break-words text-xl font-semibold tabular-nums" dir="ltr">
              {value}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>
      {recent.length > 0 ? (
        <div
          className="flex h-28 items-end gap-2"
          role="img"
          aria-label={
            l("Daily cardio minutes over seven days", "دقائق الكارديو اليومية خلال سبعة أيام") +
            ": " +
            days.map((day) => `${day.date}: ${Math.round(day.minutes)}`).join(", ")
          }
        >
          {days.map((day) => (
            <div
              key={day.date}
              className="flex h-full min-w-0 flex-1 flex-col justify-end text-center text-[10px] tabular-nums"
            >
              <span>{Math.round(day.minutes)}</span>
              <div
                className="mx-auto w-full max-w-9 rounded-t bg-emerald-400"
                style={{
                  height: `${(day.minutes / peak) * 65}%`,
                  minHeight: day.minutes > 0 ? 3 : 0,
                }}
              />
              <span className="mt-2 text-muted-foreground" dir="ltr">
                {day.date.slice(5)}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          {l(
            "No cardio recorded in the last seven days.",
            "لم يتم تسجيل كارديو خلال الأيام السبعة الماضية.",
          )}
        </p>
      )}
      <p className="text-xs leading-5 text-muted-foreground">
        {l(
          "Recorded activity, including pending device entries. No weekly target has been configured.",
          "النشاط المسجّل، بما فيه إدخالات الجهاز المعلقة. لم يتم تحديد هدف أسبوعي.",
        )}
      </p>
    </section>
  );
}
