import { SelectionIndicator } from "./selection-indicator";
import { ChevronDown } from "lucide-react";
import { fetchAll } from "@/lib/pagination";
import { useUnits } from "@/hooks/use-units";
import { displayWeight, weightUnit } from "@/lib/units";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { weekStart } from "@/lib/streaks";
import { MUSCLES, muscleVolume, type Muscle } from "@/lib/muscle-volume";
import { useI18n } from "@/lib/i18n";
import { useActivityDay } from "@/hooks/use-activity-day";
import { MuscleBodyDiagram } from "./muscle-body-diagram";
import { Button } from "./ui/button";

const names = {
  chest: "الصدر",
  back: "الظهر",
  shoulders: "الأكتاف",
  biceps: "البايسبس",
  triceps: "الترايسبس",
  core: "الجذع",
  quads: "الأفخاذ الأمامية",
  hamstrings: "الأفخاذ الخلفية",
  glutes: "الأرداف",
  calves: "السمانة",
};
export function MuscleHeatmap({ userId }: { userId: string }) {
  const { locale } = useI18n();
  const units = useUnits(userId);
  const l = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const [selected, setSelected] = useState<Muscle>("chest");
  const today = useActivityDay();
  const monday = weekStart(today);
  const { data, error, isPending, isFetching, refetch } = useQuery({
    queryKey: ["muscle-volume", userId, monday],
    queryFn: async () => {
      const since = new Date(new Date(`${monday}T00:00:00Z`).getTime() - 86400000).toISOString();
      const [ex, all] = await Promise.all([
        fetchAll(
          (from, to) => supabase.from("exercises").select("id,muscle").order("id").range(from, to),
          (r) => r.id,
        ),
        fetchAll(
          (from, to) =>
            supabase
              .from("set_logs")
              .select("*,workout_sessions!inner(finished_at),workout_exercises(snapshot)")
              .eq("member_id", userId)
              .not("workout_sessions.finished_at", "is", null)
              .gte("created_at", since)
              .order("created_at")
              .order("id")
              .range(from, to),
          (r) => r.id,
        ),
      ]);
      const rows = all.filter((s) => {
        const day = new Date(s.created_at).toLocaleDateString("en-CA", {
          timeZone: "Africa/Cairo",
        });
        return day >= monday && day <= today;
      });
      return muscleVolume(
        rows.map((s) => ({
          ...s,
          logging_mode: s.logging_mode as "weighted_reps" | "bodyweight_reps" | "timed",
          set_role: s.set_role as "working" | "warmup" | "drop",
          side: s.side as "bilateral" | "left" | "right",
          load_convention: s.load_convention as "external_total" | "per_hand" | "bodyweight",
          muscle:
            (s.workout_exercises?.snapshot as { muscle?: string } | null)?.muscle ??
            ex.find((e) => e.id === s.exercise_id)?.muscle ??
            "",
        })),
        ex,
      );
    },
  });
  const label = (m: Muscle) =>
    locale === "ar" ? names[m] : m.charAt(0).toUpperCase() + m.slice(1);
  const volume = data?.groups[selected];
  return (
    <section
      className="mt-6 rounded-xl border border-border bg-card p-4 sm:p-5"
      data-stitch-muscle-volume
    >
      <h2 className="font-display text-lg font-bold">
        {l("This week's muscle volume", "حجم تدريب العضلات هذا الأسبوع")}
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        {l(
          "Monday–Sunday · Cairo time. Completed working sets only; a single side counts as half a set. Drop volume stays grouped; timed work is measured in seconds. Brightness is not recovery advice.",
          "الاثنين–الأحد بتوقيت القاهرة. مجموعات العمل المكتملة فقط؛ الجانب الواحد نصف مجموعة. حجم الدروب مجمع، والثبات بالثواني. الألوان ليست نصيحة للتعافي.",
        )}
      </p>
      {/* A failed refresh does not invalidate previously loaded results or selection. */}
      {error && (
        <div role="alert" className="mt-3 space-y-2 text-sm">
          <p>
            {data
              ? l(
                  "Could not refresh weekly volume. Showing the last loaded results.",
                  "تعذر تحديث حجم التدريب. تُعرض آخر النتائج المحمّلة.",
                )
              : l("Could not load weekly volume.", "تعذر تحميل حجم التدريب.")}
          </p>
          <Button variant="outline" disabled={isFetching} onClick={() => void refetch()}>
            {l("Retry weekly volume", "إعادة تحميل حجم التدريب")}
          </Button>
        </div>
      )}
      {(!error || data) && (
        <>
          {isPending && (
            <p role="status" className="mt-3 text-sm">
              {l("Loading volume…", "جارٍ تحميل الحجم…")}
            </p>
          )}
          {data && (
            <MuscleBodyDiagram
              sets={Object.fromEntries(MUSCLES.map((m) => [m, data?.groups[m].sets ?? 0]))}
              selected={selected}
              onSelect={setSelected}
              locale={locale}
            />
          )}
          {data && (
            <details className="mt-5 rounded-lg bg-background p-4" data-muscle-breakdown>
              <summary className="disclosure-trigger flex min-h-11 cursor-pointer items-center gap-2 py-3 text-sm font-semibold">
                <ChevronDown aria-hidden className="disclosure-chevron size-4 shrink-0" />
                {l("Muscle breakdown", "تفاصيل العضلات")}
              </summary>
              <p className="text-xs text-muted-foreground">
                {l(
                  "Sorted by working sets. External-load volume and hold seconds are separate measures; they are not a recovery score.",
                  "مرتبة حسب مجموعات العمل. حجم الحمل الخارجي وثواني الثبات مقياسان منفصلان وليسا درجة للتعافي.",
                )}
              </p>
              <ol className="mt-3 space-y-2">
                {[...MUSCLES]
                  .sort((a, b) => data.groups[b].sets - data.groups[a].sets)
                  .map((m) => (
                    <li
                      key={m}
                      className="flex flex-wrap justify-between gap-2 border-t border-border py-3 text-xs"
                    >
                      <strong>{label(m)}</strong>
                      <span>
                        <bdi>
                          {data.groups[m].sets} {l("sets", "مجموعات")} ·{" "}
                          {Math.round(displayWeight(data.groups[m].kg, units))} {weightUnit(units)}{" "}
                          · {data.groups[m].seconds} s
                        </bdi>
                      </span>
                    </li>
                  ))}
              </ol>
            </details>
          )}
          {data && (
            <div className="sliding-selection mt-5 flex flex-wrap gap-3" data-muscle-controls>
              {/* The marker follows the inspected muscle, independently of volume shading. */}
              <SelectionIndicator />
              {MUSCLES.map((m) => (
                <button
                  key={m}
                  aria-pressed={selected === m}
                  onClick={() => setSelected(m)}
                  className={`min-h-11 rounded-lg border px-3 py-2 text-xs ${selected === m ? "border-gold bg-background text-foreground" : "border-transparent bg-background text-muted-foreground"}`}
                >
                  {label(m)} · {data?.groups[m].sets ?? "—"}
                </button>
              ))}
            </div>
          )}
          {data && (
            <p className="mt-5 rounded-lg bg-background p-4 text-sm" aria-live="polite">
              <strong>{label(selected)}</strong>: {volume?.sets ?? 0} {l("sets", "مجموعات")} ·{" "}
              {Math.round(displayWeight(volume?.kg ?? 0, units)).toLocaleString()}{" "}
              {weightUnit(units)} {l("lifted (reps × weight)", "مرفوع (التكرارات × الوزن)")}
              {" · "}
              {volume?.seconds ?? 0} {l("hold seconds", "ثواني ثبات")}
            </p>
          )}
          {!!data?.unmapped && (
            <p className="mt-1 text-xs text-muted-foreground">
              {data.unmapped}{" "}
              {l(
                "sets have an unrecognized muscle label and are not mapped.",
                "مجموعات بوسم عضلي غير معروف لم تُعرض.",
              )}
            </p>
          )}
        </>
      )}
    </section>
  );
}
