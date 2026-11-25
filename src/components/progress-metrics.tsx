import { Dumbbell, CalendarCheck, ListChecks } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export function ProgressMetrics({
  data,
}: {
  data: { workouts: number; weekly: number; sets: number } | undefined;
}) {
  const { t, locale } = useI18n();
  return (
    <dl className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-3" data-stitch-progress-metrics>
      {[
        {
          label: t("totalWorkouts"),
          value: data?.workouts,
          Icon: Dumbbell,
          scope:
            locale === "ar"
              ? "السجل المكتمل، بما فيه المستورد"
              : "Completed history, including imports",
        },
        {
          label: t("thisWeek"),
          value: data?.weekly,
          Icon: CalendarCheck,
          scope: locale === "ar" ? "منذ الاثنين · توقيت القاهرة" : "Since Monday · Cairo time",
        },
        {
          label: locale === "ar" ? "سجلات المجموعات" : "Logged set entries",
          value: data?.sets,
          Icon: ListChecks,
          scope:
            locale === "ar"
              ? "كل جهة وجزء تنازلي سجل منفصل"
              : "Each side/drop segment is a separate entry",
        },
      ].map(({ label, value, Icon, scope }, index) => (
        <div
          key={label}
          className={`min-w-0 rounded-xl border border-border bg-card p-4 ${index === 2 ? "col-span-2 lg:col-span-1" : ""}`}
        >
          <dt className="flex items-start justify-between gap-2 text-xs text-muted-foreground">
            <span>{label}</span>
            <Icon aria-hidden className="size-4 shrink-0" />
          </dt>
          <dd className="mt-3 font-heading text-2xl font-bold tabular-nums">
            {value?.toLocaleString(locale === "ar" ? "ar-EG-u-nu-latn" : "en-GB") ?? "—"}
          </dd>
          {/* Metric scope stays beside its value; source adherence/volume figures
              are not interchangeable with these existing history counts. */}
          <dd className="mt-2 text-xs text-muted-foreground">{scope}</dd>
        </div>
      ))}
    </dl>
  );
}
