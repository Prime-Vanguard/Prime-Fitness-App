import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { workingCount, workoutSlots } from "@/lib/workout-editor";
import type { WorkoutSet } from "@/lib/workout-store";
import { setMetrics } from "@/lib/training-model";
import { displayWeight, formatMeasure, weightUnit, type Units } from "@/lib/units";
import { Timer, Dumbbell, Weight, ListChecks } from "lucide-react";
export function WorkoutReview({
  open,
  discard,
  busy,
  error,
  sets,
  slots,
  exerciseName,
  onClose,
  onConfirm,
  title,
  onBackup,
  startedAt,
  units,
}: {
  open: boolean;
  discard: boolean;
  busy: boolean;
  error: string;
  sets: WorkoutSet[];
  slots: ReturnType<typeof workoutSlots>;
  exerciseName: (id: string) => string;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  onBackup: () => void;
  startedAt: string;
  units: Units;
}) {
  const { t, locale } = useI18n(),
    l = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const seconds = Math.max(0, Math.floor((Date.now() - Date.parse(startedAt)) / 1000));
  const completed = slots.filter(
    (slot) =>
      workingCount(
        sets.filter((set) => set.exercise_id === slot.id && (set.slot_key ?? "") === slot.key),
      ) >= Math.max(1, slot.sets),
  ).length;
  const volume = sets.reduce(
    (total, set) =>
      total +
      setMetrics({
        reps: set.reps,
        weight_kg: set.weight_kg,
        set_role: set.set_role ?? "working",
        side: set.side ?? "bilateral",
        logging_mode: set.logging_mode ?? "weighted_reps",
        duration_seconds: set.duration_seconds ?? null,
        load_convention: set.load_convention ?? "external_total",
      }).kg,
    0,
  );
  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        // Keep the review mounted while its existing durable finish/discard command settles.
        if (!o && !busy) onClose();
      }}
    >
      <SheetContent
        side="bottom"
        dir={locale === "ar" ? "rtl" : "ltr"}
        className="flex max-h-[85dvh] flex-col overflow-hidden rounded-t-2xl p-0"
        aria-busy={busy}
      >
        <div className="shrink-0 border-b border-border p-4 pe-14">
          <SheetTitle className="mx-auto max-w-lg font-heading text-xl font-bold">
            {discard ? t("discardWorkout") : l("Finish workout?", "إنهاء التمرين؟")}
          </SheetTitle>
        </div>
        <div className="min-h-0 overflow-y-auto overscroll-contain p-5" data-workout-review-scroll>
          <div className="mx-auto max-w-lg space-y-4" data-stitch-workout-review>
            <div aria-hidden className="mx-auto h-1 w-12 rounded-full bg-border" />
            <p className="text-xs font-semibold uppercase tracking-widest text-gold">
              {discard
                ? l("Session recovery", "استعادة الجلسة")
                : l("Session checkpoint", "مراجعة الجلسة")}
            </p>
            <SheetDescription>
              {discard
                ? t("discardConfirm")
                : l(
                    "Review completed work before saving. Unfinished targets are not logged; XP is confirmed after sync.",
                    "راجع المجموعات قبل الحفظ. الأهداف غير المكتملة لا تُسجل؛ تُعتمد النقاط بعد المزامنة.",
                  )}
            </SheetDescription>
            {discard && (
              <>
                <p className="font-semibold">
                  {title} · {sets.length} {l("logged sets", "مجموعات مسجلة")}
                </p>
                <p className="text-sm">
                  {l(
                    "This removes this session and its logged sets. Export a backup first if you may need them.",
                    "سيُحذف هذا التمرين ومجموعاته. صدّر نسخة احتياطية أولاً إذا كنت ستحتاجها.",
                  )}
                </p>
                <Button variant="outline" disabled={busy} onClick={onBackup}>
                  {l("Export backup before discarding", "تصدير نسخة قبل الإلغاء")}
                </Button>
              </>
            )}
            {!discard && (
              <>
                <p className="break-words font-heading font-semibold">{title}</p>
                <dl className="grid grid-cols-2 gap-3">
                  {[
                    {
                      label: l("Duration", "المدة"),
                      value: Number.isFinite(seconds)
                        ? Math.floor(seconds / 60) + "m " + (seconds % 60) + "s"
                        : "—",
                      Icon: Timer,
                    },
                    {
                      label: l("Exercises", "التمارين"),
                      value: completed + " / " + slots.length,
                      Icon: Dumbbell,
                    },
                    {
                      label: l("External-load volume", "حجم الحمل الخارجي"),
                      value: formatMeasure(displayWeight(volume, units)) + " " + weightUnit(units),
                      Icon: Weight,
                    },
                    {
                      label: l("Sets logged", "المجموعات المسجلة"),
                      value: String(sets.length),
                      Icon: ListChecks,
                    },
                  ].map(({ label, value, Icon }) => (
                    <div
                      key={label}
                      className="min-w-0 rounded-lg border border-border bg-background p-3"
                    >
                      <dt className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Icon aria-hidden className="size-4 shrink-0" />
                        {label}
                      </dt>
                      <dd className="mt-2 break-words font-heading text-xl font-bold tabular-nums">
                        <bdi>{value}</bdi>
                      </dd>
                    </div>
                  ))}
                </dl>
                <p>
                  {workingCount(sets)} {l("working sets completed", "مجموعات عمل مكتملة")}
                </p>
                <ul className="space-y-2 text-sm">
                  {slots.map((s) => (
                    <li
                      key={`${s.key}:${s.id}`}
                      className="flex items-start justify-between gap-3 rounded-lg bg-background p-3"
                    >
                      <span className="min-w-0 break-words">{exerciseName(s.id)}</span>
                      <bdi className="shrink-0 font-semibold tabular-nums">
                        {workingCount(
                          sets.filter(
                            (r) => r.exercise_id === s.id && (r.slot_key ?? "") === s.key,
                          ),
                        )}
                        {s.sets ? ` / ${s.sets}` : ""}
                      </bdi>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
        {/* Completion and cancellation stay visible while the member reviews a long session. */}
        <div
          className="shrink-0 border-t border-border bg-card p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
          data-workout-review-actions
        >
          <div className="mx-auto max-w-lg space-y-3">
            {busy && (
              <p role="status" className="text-sm text-muted-foreground">
                {l("Saving on this device…", "جارٍ الحفظ على هذا الجهاز…")}
              </p>
            )}
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Button
              className="w-full"
              variant={discard ? "destructive" : "default"}
              disabled={busy}
              onClick={onConfirm}
            >
              {discard ? t("discardWorkout") : l("Save workout", "حفظ التمرين")}
            </Button>
            <Button variant="outline" className="w-full" disabled={busy} onClick={onClose}>
              {t("cancel")}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
