import { useEffect, useState } from "react";
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
import { weightUnit, type Units } from "@/lib/units";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

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
}) {
  const { workout: w, change } = controller;
  const key = slotDraftKey(exercise, slot),
    rows = w.editor?.plannedRows?.[key];
  const { locale } = useI18n();
  const [error, setError] = useState("");
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
      className="space-y-3"
    >
      <p className="text-xs text-muted-foreground">
        {locale === "ar"
          ? "الأهداف غير محددة كمكتملة. أكمل كل صف بعد أداء المجموعة."
          : "Targets are unchecked. Complete each row after performing the set."}
      </p>
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
      {rows?.map((row) => (
        <PlannedRowInputs
          key={`${key}:${row.id}:${units}`}
          row={row}
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
    </section>
  );
}
function PlannedRowInputs({
  row,
  units,
  timed,
  disabled,
  onUpdate,
  onComplete,
  holdStartedAt,
  otherHold,
  onToggleHold,
}: {
  row: PlannedRow;
  units: Units;
  timed: boolean;
  disabled: boolean;
  onUpdate: (value: SetDraft) => Promise<void>;
  onComplete: (id: string, draft: SetDraft) => Promise<void>;
  holdStartedAt: number | null;
  otherHold: boolean;
  onToggleHold: () => Promise<SetDraft>;
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
    <fieldset
      aria-label={label}
      className="min-w-0 rounded-xl border border-border bg-background/40 p-3"
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
      }}
    >
      <legend className="px-1 text-sm font-semibold">{label}</legend>
      <div className="grid grid-cols-3 gap-2">
        {(
          [
            ["weight", weightUnit(units)],
            ["reps", timed ? (locale === "ar" ? "ثوانٍ" : "Seconds") : t("reps")],
            ["rpe", "RPE 1–10"],
          ] as const
        ).map(([key, text]) => (
          <label className="min-w-0 text-xs text-muted-foreground" key={key}>
            {text}
            <Input
              className="mt-1 h-12 text-base tabular-nums"
              disabled={disabled || completing}
              inputMode={key === "reps" ? "numeric" : "decimal"}
              value={draft[key]}
              onChange={(e) => {
                const next = { ...draft, units, [key]: e.target.value };
                setDraft(next);
                setError("");
                void onUpdate(next).catch((e: Error) => setError(e.message));
              }}
            />
          </label>
        ))}
      </div>
      {error && (
        <p role="alert" className="mt-2 text-xs text-destructive">
          {error}
        </p>
      )}
      {timed && (
        <Button
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
            ? `${locale === "ar" ? "إنهاء الثبات" : "Stop hold"} · ${Math.max(0, Math.floor((now - holdStartedAt) / 1000))}s`
            : locale === "ar"
              ? "بدء الثبات"
              : "Start hold"}
        </Button>
      )}
      <Button
        className="mt-3 w-full"
        disabled={disabled || completing || !!holdStartedAt || otherHold}
        onClick={() => {
          setCompleting(true);
          setError("");
          void onComplete(row.id, draft)
            .catch((e: Error) => setError(e.message))
            .finally(() => setCompleting(false));
        }}
      >
        <Check />
        {locale === "ar" ? "إكمال هذه المجموعة" : "Complete this set"}
      </Button>
    </fieldset>
  );
}
