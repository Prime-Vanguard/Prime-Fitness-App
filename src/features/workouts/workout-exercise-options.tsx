import { SelectionIndicator } from "@/components/selection-indicator";
import { NativeSelect } from "@/components/ui/native-select";
import { Input } from "@/components/ui/input";
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { Check, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { normalizeExercise } from "@/lib/exercise-guidance";
import { TrainingTools } from "@/components/training-tools";
import { useI18n } from "@/lib/i18n";
import { trainingLabel } from "@/lib/training-labels";
import { storedWeight, displayWeight, formatMeasure, type Units } from "@/lib/units";
import { inputNumber } from "@/lib/numeric-input";
import type { SetDraft } from "@/lib/workout-editor";
import type { SetDetails } from "@/lib/training-model";
import type { WorkoutSet } from "@/lib/workout-store";
import { AdvancedSetFields } from "./advanced-set-fields";

/** Advanced exercise controls; the session owns draft and relationship changes. */
export function WorkoutExerciseOptions({
  equipment,
  units,
  draft,
  logging,
  superset,
  onWarmup,
  onDraft,
  onEditSet,
  timed = false,
  error = "",
  disabled = false,
  rest,
  onClose,
  actions,
}: {
  equipment: string | null | undefined;
  units: Units;
  draft: SetDraft;
  logging: {
    enabled: boolean;
    role: SetDetails["set_role"];
    side: SetDetails["side"];
    root: string;
    rows: WorkoutSet[];
    onRoleChange: (role: SetDetails["set_role"]) => void;
    onSideChange: (side: SetDetails["side"]) => void;
    onRootChange: (id: string) => void;
  };
  superset: {
    value: string;
    options: { value: string; label: string }[];
    onChange: (reference: string) => void;
  };
  onWarmup: (kg: number, reps: number) => void;
  onDraft: (patch: Partial<SetDraft>) => void;
  onEditSet?: (restSeconds?: number) => void | Promise<void>;
  timed?: boolean;
  error?: string;
  disabled?: boolean;
  rest?: {
    seconds: number;
    ready: boolean;
    error?: string;
    onSave: (seconds: number) => Promise<void>;
  };
  onClose?: () => void;
  actions?: ReactNode;
}) {
  const { locale } = useI18n();
  const l = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const [search, setSearch] = useState("");
  const protocolId = useId();
  const [fieldError, setFieldError] = useState("");
  const [continuing, setContinuing] = useState(false);
  const [savingRest, setSavingRest] = useState(false);
  const [customRest, setCustomRest] = useState<string | undefined>();
  const errorMessage = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (fieldError || error) errorMessage.current?.scrollIntoView({ block: "nearest" });
  }, [fieldError, error]);
  const visiblePartners = useMemo(() => {
    const query = normalizeExercise(search.trim());
    const matches = query
      ? superset.options.filter((option) => normalizeExercise(option.label).includes(query))
      : superset.options;
    const visible = matches.slice(0, 100);
    const selected = superset.options.find((option) => option.value === superset.value);
    if (selected && !visible.some((option) => option.value === selected.value))
      visible.push(selected);
    return visible;
  }, [search, superset.options, superset.value]);
  let workingKg = 0;
  try {
    workingKg = storedWeight(inputNumber(draft.weight, { label: "Weight", max: 2205 }) ?? 0, units);
  } catch {
    /* Keep invalid/incomplete text in the editor for correction. */
  }
  return (
    <div className="space-y-5" data-stitch-set-options>
      {(fieldError || error) && (
        <p
          ref={errorMessage}
          role="alert"
          className="rounded-lg border border-destructive/40 p-3 text-sm text-destructive"
        >
          {fieldError || error}
        </p>
      )}
      <fieldset
        disabled={disabled || continuing || savingRest}
        className="min-w-0 space-y-5"
        aria-label={l("Additional set configuration", "إعداد المجموعة الإضافية")}
      >
        {logging.enabled && (
          <>
            <fieldset
              aria-label={l("Set type", "نوع المجموعة")}
              className="min-w-0 space-y-2 rounded-xl bg-card"
            >
              <legend className="mb-3 font-heading text-sm font-bold">
                {l("Set Protocol", "نوع المجموعة")}
              </legend>
              {(
                [
                  [
                    "working",
                    l(
                      "Counts towards completed working sets.",
                      "تُحسب ضمن مجموعات العمل المكتملة.",
                    ),
                  ],
                  [
                    "warmup",
                    l(
                      "Preparation set; excluded from strength records.",
                      "مجموعة تحضيرية؛ لا تدخل في الأرقام القياسية للقوة.",
                    ),
                  ],
                  [
                    "drop",
                    l("Linked to an original working set.", "مرتبطة بمجموعة العمل الأساسية."),
                  ],
                ] as const
              ).map(([role, description]) => (
                <label
                  key={role}
                  className={
                    "relative flex min-h-16 cursor-pointer items-start gap-3 rounded-xl p-3 focus-within:ring-2 focus-within:ring-gold " +
                    (logging.role === role ? "bg-raised" : "bg-background")
                  }
                >
                  <input
                    type="radio"
                    name={protocolId}
                    className="mt-0.5 size-5 shrink-0 appearance-none rounded-full border border-input checked:border-gold checked:bg-gold"
                    aria-label={trainingLabel(role, locale)}
                    value={role}
                    checked={logging.role === role}
                    onChange={() => logging.onRoleChange(role)}
                  />
                  <span
                    aria-hidden
                    className="pointer-events-none absolute start-3 top-3.5 flex size-5 items-center justify-center text-background"
                  >
                    {logging.role === role && <Check className="size-3.5" />}
                  </span>
                  <span className="min-w-0">
                    <span
                      className={
                        "block text-sm font-semibold " +
                        (logging.role === role ? "text-gold" : "text-foreground")
                      }
                    >
                      {trainingLabel(role, locale)}
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                      {description}
                    </span>
                  </span>
                </label>
              ))}
            </fieldset>
            <AdvancedSetFields
              draft={draft}
              units={units}
              timed={timed}
              onChange={onDraft}
              onError={setFieldError}
            />
            {rest && (
              <fieldset className="min-w-0 space-y-3">
                <legend className="mb-2 font-heading text-sm font-bold">
                  {l("Inter-Set Recovery", "الراحة بين المجموعات")}
                </legend>
                <div className="sliding-selection grid grid-cols-3 gap-2">
                  {/* Rest selection changes only through the existing persist-before-success handler. */}
                  <SelectionIndicator />
                  {[90, 120, 150, 180, 240, 300].map((seconds) => (
                    <Button
                      type="button"
                      variant="secondary"
                      className={
                        rest.seconds === seconds
                          ? "bg-raised font-sans text-gold"
                          : "bg-background font-sans text-muted-foreground"
                      }
                      disabled={!rest.ready}
                      key={seconds}
                      aria-pressed={rest.seconds === seconds}
                      aria-label={l("Rest ", "راحة ") + seconds + l(" seconds", " ثانية")}
                      onClick={() => {
                        setFieldError("");
                        setSavingRest(true);
                        setCustomRest(undefined);
                        void rest
                          .onSave(seconds)
                          .catch((reason: Error) => setFieldError(reason.message))
                          .finally(() => setSavingRest(false));
                      }}
                    >
                      {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
                    </Button>
                  ))}
                </div>
                <label className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                  {l("Custom interval · 15–600 seconds", "راحة مخصصة · 15–600 ثانية")}
                  <Input
                    aria-label={l("Additional-set rest seconds", "ثواني راحة المجموعة الإضافية")}
                    disabled={!rest.ready}
                    className="w-20 bg-background text-center tabular-nums"
                    inputMode="numeric"
                    dir="ltr"
                    value={customRest ?? String(rest.seconds)}
                    onChange={(event) => {
                      setCustomRest(event.target.value);
                      setFieldError("");
                    }}
                  />
                </label>
                <p className="text-xs text-muted-foreground">
                  {l(
                    "Custom rest is saved when you continue. It applies to this exercise slot.",
                    "تُحفظ الراحة المخصصة عند المتابعة وتُطبّق على خانة هذا التمرين.",
                  )}
                </p>
                {!rest.ready && (
                  <p role="status" className="text-xs">
                    {l("Loading rest settings…", "جارٍ تحميل إعدادات الراحة…")}
                  </p>
                )}
                {rest.error && (
                  <p role="status" className="text-xs text-amber-400">
                    {l(
                      "Saved rest preference unavailable; using the device default. Continue to retry saving this interval.",
                      "تفضيل الراحة غير متاح؛ يُستخدم إعداد الجهاز. تابع لإعادة محاولة حفظ هذه المدة.",
                    )}
                  </p>
                )}
              </fieldset>
            )}
            <label className="block text-sm min-w-0 max-w-full">
              {l("Side", "الجانب")}
              <NativeSelect
                className="mt-2"
                value={logging.side}
                onChange={(e) => logging.onSideChange(e.target.value as SetDetails["side"])}
              >
                {["bilateral", "left", "right"].map((v) => (
                  <option key={v} value={v}>
                    {trainingLabel(v, locale)}
                  </option>
                ))}
              </NativeSelect>
            </label>
            {logging.role === "drop" && (
              <label className="block text-sm min-w-0 max-w-full">
                {l("Root working set", "المجموعة الأساسية")}
                <NativeSelect
                  className="mt-2"
                  value={logging.root}
                  onChange={(e) => logging.onRootChange(e.target.value)}
                >
                  <option value="">—</option>
                  {logging.rows
                    .filter((s) => s.set_role === "working" && s.side === logging.side)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.set_number}
                      </option>
                    ))}
                </NativeSelect>
              </label>
            )}
          </>
        )}
        {superset.options.length > 100 && (
          <label className="block text-sm">
            {l("Find superset partner", "ابحث عن شريك السوبرست")}
            <Input
              aria-label={l("Find superset partner", "ابحث عن شريك السوبرست")}
              className="mt-2"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={l("Search exercise names", "ابحث بأسماء التمارين")}
            />
            <span role="status" className="mt-1 block text-xs text-muted-foreground">
              {l(
                "Showing up to 100 matches. Search to find any exercise.",
                "يُعرض حتى 100 نتيجة. ابحث للوصول إلى أي تمرين.",
              )}
            </span>
          </label>
        )}
        <label className="block text-sm min-w-0 max-w-full">
          {l("Superset partner", "شريك السوبرست")}
          <NativeSelect
            aria-label={l("Superset partner", "شريك السوبرست")}
            className="mt-2"
            value={superset.value}
            onChange={(e) => superset.onChange(e.target.value)}
          >
            <option value="">{l("No superset", "بدون سوبرست")}</option>
            {visiblePartners.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </NativeSelect>
        </label>
        <p className="text-xs text-muted-foreground">
          {l(
            "A1 and A2 alternate. Rest starts after A2; repeated exercises keep separate slots.",
            "تتناوب A1 و A2. تبدأ الراحة بعد A2؛ وتبقى خانات التمارين المكررة منفصلة.",
          )}
        </p>
        {equipment?.toLowerCase().includes("barbell") && (
          <TrainingTools
            onWorkingWeight={(kg) =>
              onDraft({ weight: String(formatMeasure(displayWeight(kg, units))) })
            }
            units={units}
            weight={workingKg}
            onWarmup={onWarmup}
          />
        )}
        {actions && (
          <section className="space-y-3 border-t border-border pt-4">
            <h3 className="font-heading text-sm font-bold">
              {l("Exercise actions", "إجراءات التمرين")}
            </h3>
            <div className="flex flex-wrap gap-2">{actions}</div>
          </section>
        )}
      </fieldset>
      {logging.enabled && onEditSet && (
        <div className="space-y-3 border-t border-border pt-4">
          <p className="text-xs text-muted-foreground">
            {l(
              "These settings apply to the additional-set editor. Planned working rows keep their working-set classification.",
              "تُطبّق هذه الإعدادات على محرر المجموعة الإضافية. تحتفظ الصفوف المخططة بتصنيف مجموعات العمل.",
            )}
          </p>
          <Button
            type="button"
            className="min-h-12 w-full"
            disabled={disabled || continuing || savingRest || (!!rest && !rest.ready)}
            onClick={() => {
              setFieldError("");
              setContinuing(true);
              void Promise.resolve()
                .then(async () => {
                  let seconds: number | undefined;
                  if (rest) {
                    const parsed = inputNumber(customRest ?? String(rest.seconds), {
                      label: l("Rest seconds", "ثواني الراحة"),
                      min: 15,
                      max: 600,
                      integer: true,
                    });
                    if (parsed == null)
                      throw new Error(l("Enter rest seconds.", "أدخل ثواني الراحة."));
                    seconds = parsed;
                  }
                  await onEditSet(seconds);
                })
                .catch((reason: Error) => setFieldError(reason.message))
                .finally(() => setContinuing(false));
            }}
          >
            <SlidersHorizontal aria-hidden />
            {l("Continue to set entry", "المتابعة إلى إدخال المجموعة")}
          </Button>
          {continuing && (
            <p role="status" className="text-xs text-muted-foreground">
              {l("Saving configuration on this device…", "جارٍ حفظ الإعدادات على الجهاز…")}
            </p>
          )}
          {onClose && (
            <Button
              type="button"
              variant="ghost"
              className="min-h-11 w-full"
              disabled={disabled || continuing || savingRest}
              onClick={onClose}
            >
              {l("Close options", "إغلاق الخيارات")}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
