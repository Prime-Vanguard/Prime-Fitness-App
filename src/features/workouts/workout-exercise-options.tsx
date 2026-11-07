import { NativeSelect } from "@/components/ui/native-select";
import { TrainingTools } from "@/components/training-tools";
import { useI18n } from "@/lib/i18n";
import { trainingLabel } from "@/lib/training-labels";
import { storedWeight, displayWeight, formatMeasure, type Units } from "@/lib/units";
import { inputNumber } from "@/lib/numeric-input";
import type { SetDraft } from "@/lib/workout-editor";
import type { SetDetails } from "@/lib/training-model";
import type { WorkoutSet } from "@/lib/workout-store";

/** Advanced exercise controls; the session owns draft and relationship changes. */
export function WorkoutExerciseOptions({
  equipment,
  units,
  draft,
  logging,
  superset,
  onWarmup,
  onDraft,
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
}) {
  const { locale } = useI18n();
  const l = (en: string, ar: string) => (locale === "ar" ? ar : en);
  let workingKg = 0;
  try {
    workingKg = storedWeight(inputNumber(draft.weight, { label: "Weight", max: 2205 }) ?? 0, units);
  } catch {
    /* Keep invalid/incomplete text in the editor for correction. */
  }
  return (
    <div className="space-y-3 rounded-xl border border-border p-3">
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
      {logging.enabled && (
        <>
          <label className="block text-sm min-w-0 max-w-full">
            {l("Set type", "نوع المجموعة")}
            <NativeSelect
              className="mt-2"
              value={logging.role}
              onChange={(e) => logging.onRoleChange(e.target.value as SetDetails["set_role"])}
            >
              {["working", "warmup", "drop"].map((v) => (
                <option key={v} value={v}>
                  {trainingLabel(v, locale)}
                </option>
              ))}
            </NativeSelect>
          </label>
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
      <label className="block text-sm min-w-0 max-w-full">
        {l("Superset partner", "شريك السوبرست")}
        <NativeSelect
          aria-label={l("Superset partner", "شريك السوبرست")}
          className="mt-2"
          value={superset.value}
          onChange={(e) => superset.onChange(e.target.value)}
        >
          <option value="">{l("No superset", "بدون سوبرست")}</option>
          {superset.options.map((option) => (
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
    </div>
  );
}
