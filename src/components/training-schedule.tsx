import { trainingLabel } from "@/lib/training-labels";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useTrainingFeatures } from "@/hooks/use-training-features";
import { parseVersionItems } from "@/lib/program-versions";
import { readMemberState, changeMemberState } from "@/lib/member-store";
import type { Json } from "@/integrations/supabase/types";
import type { Exercise, PlanItem } from "@/lib/training-tools";
import { useActivityDay } from "@/hooks/use-activity-day";
import { useI18n } from "@/lib/i18n";
import { Button } from "./ui/button";
export function TrainingSchedule({
  userId,
  onStart,
  canStart = true,
  compact = false,
}: {
  userId: string;
  canStart?: boolean;
  compact?: boolean;
  onStart?: (
    title: string,
    plan: PlanItem[],
    exercises: Exercise[],
    context?: { occurrence_id?: string; session_id?: string },
  ) => Promise<void>;
}) {
  const { data: features } = useTrainingFeatures(userId);
  const { locale } = useI18n();
  const l = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const today = useActivityDay();
  const qc = useQueryClient();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [agendaOpen, setAgendaOpen] = useState(false);
  const { data, error: loadError } = useQuery({
    queryKey: ["training-schedule", userId],
    enabled: !!features?.scheduling,
    networkMode: "always",
    queryFn: async () => {
      const load = async () => {
        const a = await supabase
          .from("program_assignments")
          .select("id,program_version_id")
          .eq("member_id", userId)
          .eq("active", true)
          .maybeSingle();
        if (a.error) throw a.error;
        if (!a.data) return null;
        const [schedule, occurrences, version] = await Promise.all([
          supabase
            .from("program_schedules")
            .select("*")
            .eq("assignment_id", a.data.id)
            .maybeSingle(),
          supabase
            .from("session_occurrences")
            .select("*")
            .eq("assignment_id", a.data.id)
            .order("ordinal"),
          supabase
            .from("program_versions")
            .select("*")
            .eq("id", a.data.program_version_id)
            .single(),
        ]);
        for (const r of [schedule, occurrences, version]) if (r.error) throw r.error;
        return { schedule: schedule.data, occurrences: occurrences.data!, version: version.data! };
      };
      if (!navigator.onLine) {
        const saved = (await readMemberState(userId)).references.schedule;
        return (saved as Awaited<ReturnType<typeof load>>) ?? null;
      }
      const value = await load();
      await changeMemberState(userId, (s) => ({
        ...s,
        references: { ...s.references, schedule: value as Json },
      }));
      return value;
    },
  });
  if (!features?.scheduling || !data?.schedule)
    return loadError ? (
      <p role="alert">{l("Schedule could not be loaded.", "تعذر تحميل الجدول.")}</p>
    ) : null;
  const next = data.occurrences.find((o) => o.status === "scheduled" || o.status === "in_progress");
  async function start(o: NonNullable<typeof data>["occurrences"][number]) {
    if (!data || !onStart || busy) return;
    setBusy(true);
    setError("");
    try {
      const items = parseVersionItems(data.version.items).filter(
        (i) => i.week === o.week && i.day === o.day,
      );
      const ex = items.map((i) => ({
        id: i.exercise_id,
        name_en: i.name_en,
        name_ar: i.name_ar,
        muscle: i.muscle,
        equipment: i.equipment,
        logging_mode: i.logging_mode,
        load_convention: i.load_convention,
      }));
      await onStart(
        `${data.version.name} · W${o.week} D${o.day}`,
        items.map((i, index) => ({
          id: i.exercise_id,
          sets: i.target_sets,
          reps: i.target_reps,
          slot_key: `${data.version.id}:${i.id}`,
          program_version_id: data.version.id,
          exercise: ex[index]!,
        })),
        ex,
        { occurrence_id: o.id, session_id: crypto.randomUUID() },
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="mt-5 rounded-xl border border-gold/30 p-4">
      <h2 className="font-semibold">
        {l("Training agenda", "جدول التدريب")} ·{" "}
        {data.schedule.mode === "rotation" ? l("Rotation", "بالتتابع") : l("Calendar", "بالتاريخ")}
      </h2>
      <p className="mt-2 text-sm">
        {next
          ? `${l("Next unfinished session", "الجلسة التالية غير المكتملة")}: W${next.week} D${next.day}`
          : l(
              "Program complete. Ask your coach for the next assignment.",
              "اكتمل البرنامج. اطلب البرنامج التالي من مدربك.",
            )}
      </p>
      {error && <p role="alert">{error}</p>}
      {compact && (
        <Button
          variant="ghost"
          className="mt-2"
          aria-expanded={agendaOpen}
          onClick={() => setAgendaOpen(!agendaOpen)}
        >
          {agendaOpen ? l("Hide agenda", "إخفاء الجدول") : l("View agenda", "عرض الجدول")}
        </Button>
      )}
      <ul className="mt-3 divide-y">
        {(compact && !agendaOpen ? (next ? [next] : []) : data.occurrences).map((o) => (
          <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
            <span>
              W{o.week} D{o.day} · {trainingLabel(o.status, locale)}{" "}
              {o.due_date && o.due_date < today && o.status === "scheduled"
                ? l("· Overdue", "· متأخر")
                : ""}
            </span>
            {o.status === "scheduled" && (
              <>
                {(!compact || agendaOpen) && (
                  <MoveSession
                    id={o.id}
                    date={o.due_date}
                    label={l(`Move W${o.week} D${o.day}`, `نقل أسبوع ${o.week} يوم ${o.day}`)}
                    onSaved={() =>
                      void qc.invalidateQueries({ queryKey: ["training-schedule", userId] })
                    }
                  />
                )}
                {onStart ? (
                  <Button
                    size="sm"
                    disabled={
                      !canStart || busy || (data.schedule!.mode === "rotation" && o.id !== next?.id)
                    }
                    onClick={() => void start(o)}
                  >
                    {l("Start session", "بدء الجلسة")}
                  </Button>
                ) : (
                  <Link to="/train">{l("Open training", "فتح التدريب")}</Link>
                )}
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function MoveSession({
  id,
  date,
  label,
  onSaved,
}: {
  id: string;
  date: string | null;
  label: string;
  onSaved: () => void;
}) {
  const { locale } = useI18n();
  const [editing, setEditing] = useState(false),
    [value, setValue] = useState(date ?? "");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <div className="space-y-2">
      <Button
        variant="outline"
        onClick={() => {
          setValue(date ?? "");
          setEditing(!editing);
        }}
      >
        {label}
      </Button>
      {editing && (
        <div className="flex flex-wrap gap-2">
          <input
            aria-label={label}
            type="date"
            className="min-h-11 rounded-md border bg-background p-2"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <Button
            disabled={busy || !value}
            onClick={() => {
              setBusy(true);
              setError("");
              void Promise.resolve(
                supabase.rpc("move_session_occurrence", { _id: id, _date: value }),
              )
                .then((r) => {
                  if (r.error) setError(r.error.message);
                  else {
                    setEditing(false);
                    onSaved();
                  }
                })
                .catch((e: Error) => setError(e.message))
                .finally(() => setBusy(false));
            }}
          >
            {locale === "ar" ? "حفظ" : "Save"}
          </Button>
          <Button variant="ghost" disabled={busy} onClick={() => setEditing(false)}>
            {locale === "ar" ? "إلغاء" : "Cancel"}
          </Button>
          <p className="w-full text-xs text-muted-foreground">
            {locale === "ar"
              ? "لا تتغير مواعيد الجلسات الأخرى."
              : "Other sessions keep their dates."}
          </p>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
