import { useEffect, useState } from "react";
import { formatDuration } from "@/lib/duration";
import { Check } from "lucide-react";
import type { WorkoutSessionController } from "./types";
import { useI18n } from "@/lib/i18n";
import {
  convertDraftUnits,
  initializePlannedRows,
  slotDraftKey,
  updatePlannedRow,
  togglePlannedHold,
  type PlannedRow,
  type SetDraft,
} from "@/lib/workout-editor";
import { displayWeight, formatMeasure, weightUnit, type Units } from "@/lib/units";
import type { PreviousPerformance } from "@/lib/workout-references";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type PriorSet = PreviousPerformance["sets"][number];

type Controller = Pick<WorkoutSessionController, "workout" | "change">;
export function PlannedSetRows({
  controller,
  exercise,
  slot,
  initial,
  units,
  timed,
  ready,
  disabled,
  onComplete,
  previous = [],
}: {
  controller: Controller;
  exercise: string;
  slot: string;
  initial: SetDraft;
  units: Units;
  timed: boolean;
  ready: boolean;
  disabled: boolean;
  onComplete: (id: string, draft: SetDraft) => Promise<void>;
  /** Last session's working sets for this slot; set N lines up with row number N. */
  previous?: PriorSet[] | undefined;
}) {
  const { workout: w, change } = controller;
  const key = slotDraftKey(exercise, slot),
    rows = w.editor?.plannedRows?.[key];
  const { locale } = useI18n();
  const [error, setError] = useState("");
  const [showEffort, setShowEffort] = useState(false);
  const prepare = () => {
    setError("");
    void change((c) => initializePlannedRows(c, exercise, slot, initial)).catch((e: Error) =>
      setError(e.message),
    );
  };
  useEffect(() => {
    if (ready && rows === undefined) prepare();
    // Initialization is transactional and never regenerates consumed rows.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, key, rows === undefined]);
  return (
    <section
      aria-label={locale === "ar" ? "المجموعات المخططة" : "Planned working sets"}
      className="space-y-2"
    >
      {!!rows?.length && (
        <div
          aria-hidden
          className="grid grid-cols-[24px_40px_minmax(0,1fr)_minmax(0,1fr)_44px] items-center gap-2 px-2 text-center text-[10px] uppercase text-muted-foreground"
        >
          <span>{locale === "ar" ? "مجموعة" : "Set"}</span>
          <span>{locale === "ar" ? "السابق" : "Prev"}</span>
          <span>{weightUnit(units)}</span>
          <span>
            {timed ? (locale === "ar" ? "ثوانٍ" : "Secs") : locale === "ar" ? "تكرار" : "Reps"}
          </span>
          <span>{locale === "ar" ? "الحالة" : "Status"}</span>
        </div>
      )}
      {rows === undefined && (
        <p role="status" className="text-sm">
          {locale === "ar" ? "جارٍ تجهيز الصفوف…" : "Preparing planned sets…"}
        </p>
      )}
      {error && (
        <div role="alert" className="text-sm text-destructive">
          {error}
          <Button variant="outline" onClick={prepare}>
            {locale === "ar" ? "إعادة المحاولة" : "Retry preparation"}
          </Button>
        </div>
      )}
      {rows?.length === 0 && (
        <p role="status" className="text-sm text-success">
          {locale === "ar"
            ? "اكتملت الصفوف المخططة. يمكنك إضافة مجموعة أخرى من الخيارات المتقدمة."
            : "Planned rows completed. You can add another set using the advanced editor."}
        </p>
      )}
      {rows?.map((row, index) => (
        <PlannedRowInputs
          key={`${key}:${row.id}:${units}`}
          row={row}
          prior={previous[row.number - 1]}
          current={index === 0}
          showEffort={showEffort}
          units={units}
          timed={timed}
          disabled={disabled}
          onUpdate={(draft) =>
            change((c) => updatePlannedRow(c, key, row.id, draft)).then(() => {})
          }
          onComplete={onComplete}
          holdStartedAt={
            w.editor?.holdRow?.key === key && w.editor.holdRow.id === row.id
              ? (w.holdStartedAt ?? null)
              : null
          }
          otherHold={
            !!w.holdStartedAt && !(w.editor?.holdRow?.key === key && w.editor.holdRow.id === row.id)
          }
          onToggleHold={async () => {
            const next = await change((c) => togglePlannedHold(c, key, row.id));
            return next.editor!.plannedRows![key]!.find((r) => r.id === row.id)!.draft;
          }}
        />
      ))}
      {!!rows?.length && (
        <Button
          variant="ghost"
          type="button"
          className="w-full bg-background text-muted-foreground"
          aria-expanded={showEffort}
          onClick={() => setShowEffort(!showEffort)}
        >
          {locale === "ar" ? "تقييم الجهد (RPE)" : "Effort ratings (RPE)"}
        </Button>
      )}
    </section>
  );
}
function PlannedRowInputs({
  row,
  prior,
  units,
  timed,
  disabled,
  onUpdate,
  onComplete,
  holdStartedAt,
  otherHold,
  onToggleHold,
  current,
  showEffort,
}: {
  row: PlannedRow;
  prior: PriorSet | undefined;
  units: Units;
  timed: boolean;
  disabled: boolean;
  onUpdate: (value: Partial<SetDraft>) => Promise<void>;
  onComplete: (id: string, draft: SetDraft) => Promise<void>;
  holdStartedAt: number | null;
  otherHold: boolean;
  onToggleHold: () => Promise<SetDraft>;
  current: boolean;
  showEffort: boolean;
}) {
  const { locale, t } = useI18n();
  const [draft, setDraft] = useState(() => {
    try {
      return convertDraftUnits(row.draft, units);
    } catch {
      return row.draft;
    }
  });
  const [error, setError] = useState(""),
    [completing, setCompleting] = useState(false);
  const [focused, setFocused] = useState(false);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!holdStartedAt) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [holdStartedAt]);
  // Cross-tab refreshes update idle fields; never overwrite an actively typed input.
  useEffect(() => {
    if (!focused) {
      try {
        setDraft(convertDraftUnits(row.draft, units));
      } catch {
        /* Invalid drafts remain editable. */
      }
    }
  }, [row.draft, units, focused]);
  const label = locale === "ar" ? `مجموعة مخططة ${row.number}` : `Planned set ${row.number}`;
  return (
    <form
      id={`planned-${row.id}`}
      onSubmit={(event) => {
        event.preventDefault();
        if (disabled || completing || holdStartedAt || otherHold) return;
        setCompleting(true);
        setError("");
        void onComplete(row.id, draft)
          .catch((e: Error) => setError(e.message))
          .finally(() => setCompleting(false));
      }}
    >
      <fieldset
        aria-label={label}
        aria-busy={completing}
        className={`relative min-w-0 rounded-lg border bg-row p-2 ${current ? "border-gold/60" : "border-transparent"}`}
        onFocus={() => setFocused(true)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
        }}
      >
        <legend className="sr-only">{label}</legend>
        <div className="grid grid-cols-[24px_40px_minmax(0,1fr)_minmax(0,1fr)_44px] items-center gap-2">
          <span
            aria-hidden
            className={`text-center text-sm font-bold ${current ? "text-gold" : "text-muted-foreground"}`}
          >
            {row.number}
          </span>
          {(() => {
            const weight =
              prior?.weight_kg == null
                ? null
                : formatMeasure(displayWeight(prior.weight_kg, units));
            const amount =
              prior?.duration_seconds != null
                ? formatDuration(prior.duration_seconds)
                : prior?.reps;
            return prior && amount != null ? (
              <span
                className="flex flex-col items-center text-[11px] leading-tight tabular-nums text-muted-foreground"
                aria-label={
                  locale === "ar"
                    ? `المرة السابقة: ${weight != null ? `${weight} ${weightUnit(units)} × ` : ""}${amount}`
                    : `Last time: ${weight != null ? `${weight} ${weightUnit(units)} × ` : ""}${amount}`
                }
              >
                {weight != null && <bdi aria-hidden>{weight}</bdi>}
                <bdi aria-hidden>
                  {weight != null ? "×" : ""}
                  {amount}
                </bdi>
              </span>
            ) : (
              <span
                className="text-center text-xs text-muted-foreground"
                aria-label={
                  locale === "ar"
                    ? "لا يتوفر سجل مطابق لهذه المجموعة"
                    : "No matching history for this set"
                }
              >
                —
              </span>
            );
          })()}
          {(
            [
              ["weight", weightUnit(units)],
              ["reps", timed ? (locale === "ar" ? "ثوانٍ" : "Seconds") : t("reps")],
            ] as const
          ).map(([key, text]) => (
            <label className="min-w-0" key={key}>
              <span className="sr-only">{text}</span>
              <Input
                className="h-11 border-transparent bg-background px-1 text-center text-base font-semibold tabular-nums"
                disabled={disabled || completing}
                inputMode={key === "reps" ? "numeric" : "decimal"}
                value={draft[key]}
                onChange={(e) => {
                  const next = { ...draft, units, [key]: e.target.value };
                  setDraft(next);
                  setError("");
                  void onUpdate({ units, [key]: e.target.value }).catch((e: Error) =>
                    setError(e.message),
                  );
                }}
              />
            </label>
          ))}
          <Button
            type="submit"
            variant="outline"
            className={`h-11 w-11 border-transparent bg-background px-0 ${current ? "text-gold" : "text-muted-foreground"}`}
            aria-label={locale === "ar" ? "إكمال هذه المجموعة" : "Complete this set"}
            disabled={disabled || completing || !!holdStartedAt || otherHold}
          >
            <Check aria-hidden="true" />
          </Button>
        </div>
        {/* The row is removed only after persistence; never announce success while saving. */}
        {completing && (
          <p role="status" className="mt-2 text-xs text-muted-foreground">
            {locale === "ar" ? "جارٍ حفظ المجموعة على الجهاز…" : "Saving set on this device…"}
          </p>
        )}
        <label
          hidden={!showEffort}
          className="mt-2 flex items-center justify-end gap-2 text-xs text-muted-foreground"
        >
          RPE 1–10
          <Input
            className="h-11 w-16 border-transparent bg-background px-1 text-center tabular-nums"
            inputMode="decimal"
            disabled={disabled || completing}
            value={draft.rpe}
            onChange={(e) => {
              setDraft({ ...draft, units, rpe: e.target.value });
              setError("");
              void onUpdate({ units, rpe: e.target.value }).catch((e: Error) =>
                setError(e.message),
              );
            }}
          />
        </label>
        {error && (
          <p role="alert" className="mt-2 text-xs text-destructive">
            {error}
          </p>
        )}
        {timed && (
          <Button
            type="button"
            variant="outline"
            className="mt-3 w-full"
            disabled={disabled || completing || otherHold}
            onClick={() => {
              setError("");
              setCompleting(true);
              void onToggleHold()
                .then((value) => {
                  setDraft(convertDraftUnits(value, units));
                  setNow(Date.now());
                })
                .catch((e: Error) => setError(e.message))
                .finally(() => setCompleting(false));
            }}
          >
            {holdStartedAt
              ? `${locale === "ar" ? "إنهاء الثبات" : "Stop hold"} · ${formatDuration((now - holdStartedAt) / 1000)}`
              : locale === "ar"
                ? "بدء الثبات"
                : "Start hold"}
          </Button>
        )}
      </fieldset>
    </form>
  );
}
