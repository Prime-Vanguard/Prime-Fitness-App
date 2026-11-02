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
const shapes: { muscle: Muscle; d: string }[] = [
  {
    muscle: "shoulders",
    d: "M65 64 Q43 63 41 88 L58 92 67 76Z M95 64 Q117 63 119 88 L102 92 93 76Z",
  },
  { muscle: "chest", d: "M68 66 L79 72 79 99 61 96 61 83Z M92 66 L81 72 81 99 99 96 99 83Z" },
  { muscle: "biceps", d: "M42 91 L55 94 51 121 35 125Z M118 91 L105 94 109 121 125 125Z" },
  { muscle: "core", d: "M62 101 L78 103 78 148 65 145Z M98 101 L82 103 82 148 95 145Z" },
  { muscle: "quads", d: "M62 158 L78 158 76 214 56 214Z M98 158 L82 158 84 214 104 214Z" },
  { muscle: "calves", d: "M56 226 L75 226 72 265 60 265Z M104 226 L85 226 88 265 100 265Z" },
  { muscle: "back", d: "M227 68 L240 75 253 68 258 105 247 143 233 143 222 105Z" },
  {
    muscle: "shoulders",
    d: "M226 65 Q204 63 201 89 L217 94 226 78Z M254 65 Q276 63 279 89 L263 94 254 78Z",
  },
  { muscle: "triceps", d: "M202 94 L215 96 211 122 196 126Z M278 94 L265 96 269 122 284 126Z" },
  { muscle: "glutes", d: "M224 148 L239 148 239 172 220 172Z M256 148 L241 148 241 172 260 172Z" },
  {
    muscle: "hamstrings",
    d: "M221 177 L238 177 235 217 216 217Z M259 177 L242 177 245 217 264 217Z",
  },
  { muscle: "calves", d: "M217 226 L235 226 232 265 220 265Z M263 226 L245 226 248 265 260 265Z" },
];
export function MuscleHeatmap({ userId }: { userId: string }) {
  const { locale } = useI18n();
  const units = useUnits(userId);
  const l = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const [selected, setSelected] = useState<Muscle>("chest");
  const today = useActivityDay();
  const monday = weekStart(today);
  const { data, error, isPending } = useQuery({
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
  const max = Math.max(1, ...MUSCLES.map((m) => data?.groups[m].sets ?? 0));
  const label = (m: Muscle) =>
    locale === "ar" ? names[m] : m.charAt(0).toUpperCase() + m.slice(1);
  const volume = data?.groups[selected];
  return (
    <section className="mt-6 rounded-xl border border-border bg-card p-5">
      <h2 className="font-display text-lg font-bold">
        {l("This week's muscle volume", "حجم تدريب العضلات هذا الأسبوع")}
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        {l(
          "Monday–Sunday · Cairo time. Completed working sets only; a single side counts as half a set. Drop volume stays grouped; timed work is measured in seconds. Brightness is not recovery advice.",
          "الاثنين–الأحد بتوقيت القاهرة. مجموعات العمل المكتملة فقط؛ الجانب الواحد نصف مجموعة. حجم الدروب مجمع، والثبات بالثواني. الألوان ليست نصيحة للتعافي.",
        )}
      </p>
      {error ? (
        <p role="alert" className="mt-3 text-sm">
          {l("Could not load weekly volume.", "تعذر تحميل حجم التدريب.")}
        </p>
      ) : (
        <>
          {isPending && (
            <p role="status" className="mt-3 text-sm">
              {l("Loading volume…", "جارٍ تحميل الحجم…")}
            </p>
          )}
          <svg
            viewBox="0 0 320 300"
            className="mx-auto mt-4 w-full max-w-md"
            role="img"
            aria-label={l(
              "Front and back muscle diagram; choose a muscle below for details",
              "رسم العضلات الأمامي والخلفي؛ اختر عضلة أدناه للتفاصيل",
            )}
          >
            <g fill="var(--muted)" stroke="var(--border)" strokeWidth="1.5">
              {[0, 160].map((x) => (
                <g key={x} transform={`translate(${x},0)`}>
                  <circle cx="80" cy="38" r="18" />
                  <path d="M68 58 L92 58 114 70 122 102 136 140 124 146 104 110 104 147 110 180 104 221 101 278 84 278 80 216 76 278 59 278 56 221 50 180 56 147 56 110 36 146 24 140 38 102 46 70Z" />
                </g>
              ))}
            </g>
            {shapes.map((shape, i) => (
              <path
                key={i}
                d={shape.d}
                fill={
                  (data?.groups[shape.muscle].sets ?? 0)
                    ? `rgba(212,175,55,${0.2 + ((data?.groups[shape.muscle].sets ?? 0) / max) * 0.8})`
                    : "var(--muted-foreground)"
                }
                fillOpacity={(data?.groups[shape.muscle].sets ?? 0) ? 1 : 0.15}
                stroke={selected === shape.muscle ? "#F1F5F9" : "#334155"}
                strokeWidth={selected === shape.muscle ? 2 : 1}
              >
                <title>
                  {label(shape.muscle)}: {data?.groups[shape.muscle].sets ?? 0}
                </title>
              </path>
            ))}
          </svg>
          <div className="flex flex-wrap gap-2">
            {MUSCLES.map((m) => (
              <button
                key={m}
                aria-pressed={selected === m}
                onClick={() => setSelected(m)}
                className={`min-h-11 rounded-lg border px-3 py-2 text-xs ${selected === m ? "border-gold text-gold" : "border-border"}`}
              >
                {label(m)} · {data?.groups[m].sets ?? 0}
              </button>
            ))}
          </div>
          <p className="mt-3 text-sm" aria-live="polite">
            <strong>{label(selected)}</strong>: {volume?.sets ?? 0} {l("sets", "مجموعات")} ·{" "}
            {Math.round(displayWeight(volume?.kg ?? 0, units)).toLocaleString()} {weightUnit(units)}{" "}
            {l("lifted (reps × weight)", "مرفوع (التكرارات × الوزن)")}
            {" · "}
            {volume?.seconds ?? 0} {l("hold seconds", "ثواني ثبات")}
          </p>
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
