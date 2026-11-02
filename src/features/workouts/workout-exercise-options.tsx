import { TrainingTools } from "@/components/training-tools";
import { useI18n } from "@/lib/i18n";
import { trainingLabel } from "@/lib/training-labels";
import { storedWeight, type Units } from "@/lib/units";
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
}) {
  const { locale } = useI18n();
  const l = (en: string, ar: string) => (locale === "ar" ? ar : en);
  return (
    <div className="space-y-3 rounded-xl border border-border p-3">
      {equipment?.toLowerCase().includes("barbell") && (
        <TrainingTools
          units={units}
          weight={draft.weight ? storedWeight(Number(draft.weight), units) : 0}
          onWarmup={onWarmup}
        />
      )}
      {logging.enabled && (
        <>
          <label className="block text-sm">
            {l("Set type", "نوع المجموعة")}
            <select
              className="mt-1 h-11 w-full rounded-md border bg-background px-2"
              value={logging.role}
              onChange={(e) => logging.onRoleChange(e.target.value as SetDetails["set_role"])}
            >
              {["working", "warmup", "drop"].map((v) => (
                <option key={v} value={v}>
                  {trainingLabel(v, locale)}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            {l("Side", "الجانب")}
            <select
              className="mt-1 h-11 w-full rounded-md border bg-background px-2"
              value={logging.side}
              onChange={(e) => logging.onSideChange(e.target.value as SetDetails["side"])}
            >
              {["bilateral", "left", "right"].map((v) => (
                <option key={v} value={v}>
                  {trainingLabel(v, locale)}
                </option>
              ))}
            </select>
          </label>
          {logging.role === "drop" && (
            <label className="block text-sm">
              {l("Root working set", "المجموعة الأساسية")}
              <select
                className="mt-1 h-11 w-full rounded-md border bg-background px-2"
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
              </select>
            </label>
          )}
        </>
      )}
      <label className="block text-sm">
        {l("Superset partner", "شريك السوبرست")}
        <select
          aria-label={l("Superset partner", "شريك السوبرست")}
          className="mt-1 h-11 w-full rounded-md border bg-background px-2"
          value={superset.value}
          onChange={(e) => superset.onChange(e.target.value)}
        >
          <option value="">{l("No superset", "بدون سوبرست")}</option>
          {superset.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
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
