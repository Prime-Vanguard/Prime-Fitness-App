import { useI18n } from "@/lib/i18n";
import { activityNames } from "./activity-labels";
import type { Units } from "@/lib/units";
import type { CardioRecord } from "./model";
export function CardioConflict({
  local,
  server,
  units,
}: {
  local: CardioRecord | undefined;
  server: CardioRecord | null | undefined;
  units: Units;
}) {
  const { locale } = useI18n(),
    l = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const factor = units === "imperial" ? 1609.344 : 1000,
    unit = units === "imperial" ? "mi" : "km";
  return (
    <div className="my-2 grid gap-2 sm:grid-cols-2">
      {[
        [l("Your device version", "نسخة جهازك"), local],
        [l("Server version", "نسخة الخادم"), server],
      ].map(([label, value], index) => {
        const row = value as CardioRecord | undefined | null;
        return (
          <section className="rounded border p-2" key={index}>
            <h4 className="font-semibold">{label as string}</h4>
            {!row ? (
              <p>{l("Record does not exist", "السجل غير موجود")}</p>
            ) : (
              <dl className="space-y-1 break-words">
                <div>
                  <dt>{l("Date / activity", "التاريخ / النشاط")}</dt>
                  <dd>
                    {row.log_date} · {activityNames[row.activity][locale === "ar" ? 1 : 0]}
                  </dd>
                </div>
                <div>
                  <dt>{l("Duration / distance", "المدة / المسافة")}</dt>
                  <dd>
                    {row.duration_seconds} {l("seconds", "ثانية")} ·{" "}
                    {row.distance_m == null
                      ? "—"
                      : `${(row.distance_m / factor).toFixed(2)} ${unit}`}
                  </dd>
                </div>
                <div>
                  <dt>{l("Incline / resistance / heart rate", "الميل / المقاومة / النبض")}</dt>
                  <dd>
                    {row.incline_pct ?? "—"}% · {row.resistance ?? "—"} · {row.heart_rate ?? "—"}{" "}
                    bpm
                  </dd>
                </div>
                <div>
                  <dt>{l("Notes", "ملاحظات")}</dt>
                  <dd className="whitespace-pre-wrap">{row.notes || "—"}</dd>
                </div>
                {row.deleted_at && (
                  <p className="text-destructive">{l("Marked for deletion", "محدد للحذف")}</p>
                )}
              </dl>
            )}
          </section>
        );
      })}
    </div>
  );
}
