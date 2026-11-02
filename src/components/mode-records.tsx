import { trainingLabel } from "@/lib/training-labels";
import { useI18n } from "@/lib/i18n";
import type { PerformanceSet } from "@/lib/training-model";
import { e1rm } from "@/lib/records";
import { ShareAchievement } from "./share-achievement";
import { displayWeight, formatMeasure, weightUnit, type Units } from "@/lib/units";
import { Link } from "@tanstack/react-router";
export function ModeRecords({
  sets,
  name,
  memberName,
  units = "metric",
}: {
  sets: (PerformanceSet & { exercise_id: string; workout_sessions?: { origin?: string } | null })[];
  name: (id: string) => string;
  memberName: string;
  units?: Units;
}) {
  const { locale } = useI18n();
  const l = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const records = new Map<
    string,
    {
      exercise: string;
      side: string;
      mode: string;
      value: number;
      load: number;
      convention: string;
      imported: boolean;
      session?: string | undefined;
    }
  >();
  for (const s of sets) {
    if ((s.set_role ?? "working") !== "working") continue;
    const mode = s.logging_mode ?? "weighted_reps",
      side = s.side ?? "bilateral";
    if (mode === "weighted_reps" && side === "bilateral") continue;
    const value =
      mode === "timed"
        ? (s.duration_seconds ?? 0)
        : mode === "bodyweight_reps"
          ? (s.reps ?? 0)
          : e1rm(s.weight_kg ?? 0, s.reps ?? 0);
    if (!value) continue;
    const load = s.weight_kg ?? 0;
    const convention = s.load_convention ?? "external_total";
    const key = JSON.stringify([
      s.exercise_id,
      side,
      mode,
      convention,
      mode === "weighted_reps" ? null : load,
    ]);
    if ((records.get(key)?.value ?? 0) < value)
      records.set(key, {
        exercise: s.exercise_id,
        side,
        mode,
        value,
        load,
        convention,
        imported: s.workout_sessions?.origin === "import",
        session: s.session_id,
      });
  }
  if (!records.size) return null;
  return (
    <section className="my-5 rounded-xl border border-border p-4">
      <h2 className="font-semibold">
        {l("Duration, bodyweight & side records", "أرقام الثبات ووزن الجسم والجانبين")}
      </h2>
      <ul className="divide-y">
        {[...records].map(([key, r]) => {
          const detail = `${r.mode === "weighted_reps" ? formatMeasure(displayWeight(r.value, units)) : r.value} ${r.mode === "timed" ? "s" : r.mode === "weighted_reps" ? `${weightUnit(units)} ${l("estimated 1RM", "تقدير تكرار واحد")}` : l("reps", "تكرارات")} · ${trainingLabel(r.side, locale)} · ${formatMeasure(displayWeight(r.load, units))} ${weightUnit(units)} ${l("external load", "حمل خارجي")} · ${trainingLabel(r.convention, locale)}`;
          return (
            <li
              key={key}
              className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
            >
              <span>
                {name(r.exercise)}
                <span className="block text-muted-foreground">{detail}</span>
                <span className="block text-xs text-muted-foreground">
                  {r.imported
                    ? l("Imported · no rewards", "مستورد · دون مكافآت")
                    : l("Native workout", "جلسة داخل التطبيق")}
                </span>
                {r.session && (
                  <Link
                    className="inline-block min-h-11 py-2 text-gold underline"
                    to="/train"
                    search={{ section: "history", session: r.session }}
                  >
                    {l("Open source workout", "فتح الجلسة المصدرية")}
                  </Link>
                )}
              </span>
              <ShareAchievement name={memberName} title={name(r.exercise)} detail={detail} />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
