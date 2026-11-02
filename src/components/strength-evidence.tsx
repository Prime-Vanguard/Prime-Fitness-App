import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n";
import { trainingLabel } from "@/lib/training-labels";
import { recordDay } from "@/lib/records";
import { displayWeight, formatMeasure, weightUnit, type Units } from "@/lib/units";
import type { PerformanceSet } from "@/lib/training-model";
import { Button } from "./ui/button";
type Evidence = Omit<PerformanceSet, "logging_mode" | "set_role" | "side" | "load_convention"> & {
  logging_mode?: string;
  set_role?: string;
  side?: string;
  load_convention?: string;
  id: string;
  exercise_id: string;
  created_at: string;
  workout_sessions?: {
    origin?: string;
    activity_date?: string | null;
    title?: string | null;
  } | null;
};
export function StrengthEvidence({
  sets,
  exerciseId,
  units,
}: {
  sets: Evidence[];
  exerciseId: string;
  units: Units;
}) {
  const { locale } = useI18n(),
    ar = locale === "ar",
    l = (en: string, arabic: string) => (ar ? arabic : en);
  const [count, setCount] = useState(20);
  const rows = sets
    .filter((row) => row.exercise_id === exerciseId)
    .slice()
    .sort(
      (a, b) =>
        recordDay(b).localeCompare(recordDay(a)) ||
        b.created_at.localeCompare(a.created_at) ||
        b.id.localeCompare(a.id),
    );
  if (!rows.length) return null;
  return (
    <details key={exerciseId} className="mt-5 rounded-xl border border-border bg-card p-4">
      <summary className="min-h-11 cursor-pointer font-medium">
        {l("Review source sets", "مراجعة المجموعات المصدرية")} ({rows.length})
      </summary>
      <p className="my-3 text-sm text-muted-foreground">
        {l(
          "All-time completed history. Warm-ups and drop segments do not contribute to strength records. Sides, timed holds and added-load bodyweight records are tracked separately. Imported records count toward history, not XP.",
          "سجل الجلسات المكتملة لكل الوقت. لا تُحتسب مجموعات الإحماء والدروب في الأرقام القياسية للقوة. تُتابع الجوانب والثبات ووزن الجسم بحمل إضافي بشكل منفصل. السجلات المستوردة تُحتسب في التاريخ دون نقاط XP.",
        )}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="mb-2 text-start text-xs">
            {l(
              "Sources for the selected exercise · most recent first",
              "مصادر التمرين المحدد · الأحدث أولًا",
            )}
          </caption>
          <thead>
            <tr>
              {[
                l("Date / workout", "التاريخ / التمرين"),
                l("Performance", "الأداء"),
                l("Classification", "التصنيف"),
                l("Source", "المصدر"),
              ].map((label) => (
                <th key={label} className="p-2 text-start">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, count).map((row) => (
              <tr key={row.id} className="border-t">
                <td className="p-2">
                  <bdi>{recordDay(row)}</bdi>
                  {row.session_id && (
                    <Link
                      to="/train"
                      search={{ section: "history", session: row.session_id }}
                      className="block min-h-11 py-2 text-gold underline"
                    >
                      {row.workout_sessions?.title || l("Open workout", "فتح التمرين")}
                    </Link>
                  )}
                </td>
                <td className="p-2">
                  <bdi>
                    {row.duration_seconds != null
                      ? `${row.duration_seconds} s`
                      : `${row.reps ?? "—"} ${l("reps", "تكرارات")}`}{" "}
                    ·{" "}
                    {row.weight_kg == null
                      ? "—"
                      : formatMeasure(displayWeight(row.weight_kg, units))}{" "}
                    {weightUnit(units)}
                  </bdi>
                  <span className="block text-xs text-muted-foreground">
                    {trainingLabel(row.load_convention ?? "external_total", locale)}
                  </span>
                </td>
                <td className="p-2">
                  {trainingLabel(row.set_role ?? "working", locale)} ·{" "}
                  {trainingLabel(row.side ?? "bilateral", locale)}
                  <span className="block text-xs">
                    {trainingLabel(row.logging_mode ?? "weighted_reps", locale)}
                  </span>
                </td>
                <td className="p-2">
                  {row.workout_sessions?.origin === "import"
                    ? l("Imported · no rewards", "مستورد · دون مكافآت")
                    : l("Native workout", "جلسة داخل التطبيق")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {count < rows.length && (
        <Button className="mt-3" variant="outline" onClick={() => setCount((value) => value + 20)}>
          {l("Show more source sets", "عرض مجموعات مصدرية إضافية")}
        </Button>
      )}
    </details>
  );
}
