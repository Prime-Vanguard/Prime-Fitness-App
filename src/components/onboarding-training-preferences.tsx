import { Dumbbell, Ruler, Gauge } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { displayWeight, formatMeasure, weightUnit } from "@/lib/units";
import { SelectionIndicator } from "./selection-indicator";
import { trainingPreferenceLabels, type TrainingPreferences } from "@/lib/onboarding-preferences";
import { NativeSelect } from "./ui/native-select";

/** Collect only preferences covered by the existing setup save/restore contract. */
export function OnboardingTrainingPreferences({
  units,
  onChange,
  preferences,
  onPreferences,
}: {
  units: "metric" | "imperial";
  onChange: (value: "metric" | "imperial") => void;
  preferences: TrainingPreferences;
  onPreferences: (value: TrainingPreferences) => void;
}) {
  const { t, locale } = useI18n();
  const l = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const label = (key: keyof typeof trainingPreferenceLabels) =>
    trainingPreferenceLabels[key][locale === "ar" ? 1 : 0];
  return (
    <div className="space-y-5" data-onboarding-training-preferences>
      <p className="text-sm text-muted-foreground">
        {l(
          "Share your preferences with your coach. These choices inform your plan; they do not automatically change it. All training choices are optional.",
          "شارك تفضيلاتك مع مدربك. تساعد هذه الاختيارات في إعداد خطتك ولا تغيرها تلقائياً. جميع تفضيلات التدريب اختيارية.",
        )}
      </p>
      <fieldset className="space-y-3 rounded-xl border border-border bg-card p-4">
        <legend className="px-1 font-semibold">
          {l("Primary training focus", "هدف التدريب الأساسي")}
        </legend>
        {(["hypertrophy", "strength", "conditioning", "recomposition"] as const).map((goal) => (
          <label
            key={goal}
            className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg bg-background p-3 text-sm"
          >
            <input
              type="checkbox"
              className="size-5 accent-[var(--gold)]"
              checked={preferences.goals.includes(goal)}
              onChange={(e) =>
                onPreferences({
                  ...preferences,
                  goals: e.target.checked
                    ? [...preferences.goals, goal]
                    : preferences.goals.filter((g) => g !== goal),
                })
              }
            />
            {label(goal)}
          </label>
        ))}
      </fieldset>
      <fieldset className="space-y-3 rounded-xl border border-border bg-card p-4">
        <legend className="px-1 font-semibold">
          {l("Lifting experience", "خبرة تدريب المقاومة")}
        </legend>
        {([null, "novice", "intermediate", "advanced"] as const).map((experience) => (
          <label
            key={experience ?? "none"}
            className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg bg-background p-3 text-sm"
          >
            <input
              type="radio"
              name="training-experience"
              className="size-5 accent-[var(--gold)]"
              checked={preferences.experience === experience}
              onChange={() => onPreferences({ ...preferences, experience })}
            />
            {experience ? label(experience) : l("Not specified", "غير محدد")}
          </label>
        ))}
      </fieldset>
      <label className="block space-y-2 rounded-xl border border-border bg-card p-4 text-sm">
        <span className="font-semibold">
          {l("Available training days per week", "أيام التدريب المتاحة أسبوعياً")}
        </span>
        <NativeSelect
          value={preferences.weekly_days ?? ""}
          onChange={(e) =>
            onPreferences({
              ...preferences,
              weekly_days: e.target.value ? Number(e.target.value) : null,
            })
          }
        >
          <option value="">{l("Not specified", "غير محدد")}</option>
          {[1, 2, 3, 4, 5, 6, 7].map((days) => (
            <option key={days} value={days}>
              {days}
            </option>
          ))}
        </NativeSelect>
      </label>
      <fieldset className="space-y-3 rounded-xl border border-border bg-card p-4">
        <legend className="px-1 font-semibold">
          {l("Available equipment", "المعدات المتاحة")}
        </legend>
        <div className="flex flex-wrap gap-2">
          {(["full_gym", "barbell", "dumbbells", "bodyweight"] as const).map((equipment) => (
            <label
              key={equipment}
              className="flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-border bg-background px-3 text-sm"
            >
              <input
                type="checkbox"
                className="size-4 accent-[var(--gold)]"
                checked={preferences.equipment.includes(equipment)}
                onChange={(e) =>
                  onPreferences({
                    ...preferences,
                    equipment: e.target.checked
                      ? [...preferences.equipment, equipment]
                      : preferences.equipment.filter((v) => v !== equipment),
                  })
                }
              />
              {label(equipment)}
            </label>
          ))}
        </div>
      </fieldset>
      <p className="text-sm leading-relaxed text-muted-foreground">
        {l(
          "Choose how weights and measurements appear while you train. You can change these preferences later in Profile.",
          "اختر طريقة عرض الأوزان والقياسات أثناء التدريب. يمكنك تغيير هذه التفضيلات لاحقاً من الملف الشخصي.",
        )}
      </p>
      <fieldset className="min-w-0 space-y-4 rounded-xl border border-border bg-card p-4 sm:p-5">
        <legend className="px-1 font-heading font-semibold">
          <Ruler aria-hidden className="me-2 inline size-5 text-gold" />
          {t("units")}
        </legend>
        <div className="sliding-selection grid gap-3">
          <SelectionIndicator />
          {(["metric", "imperial"] as const).map((value) => (
            <label
              key={value}
              className="flex min-h-[76px] cursor-pointer items-center gap-3 rounded-xl border border-border bg-background p-4 text-sm focus-within:ring-2 focus-within:ring-gold has-[:checked]:border-gold has-[:checked]:bg-gold/5"
            >
              <input
                type="radio"
                name="setup-units"
                value={value}
                checked={units === value}
                onChange={() => onChange(value)}
                className="size-5 shrink-0 accent-[var(--gold)]"
              />
              <span className="min-w-0">
                <span className="block font-semibold">{t(value)}</span>
                <span className="mt-1 block text-xs text-muted-foreground" dir="ltr">
                  {value === "metric" ? "kg · cm" : "lb · in"}
                </span>
              </span>
            </label>
          ))}
        </div>
        <div className="rounded-lg bg-background p-3 text-sm" aria-live="polite" aria-atomic="true">
          <p className="text-xs text-muted-foreground">
            {l("Weight display example", "مثال لعرض الوزن")}
          </p>
          <p className="mt-2 font-heading text-lg font-semibold">
            <bdi dir="ltr">
              60 kg = {formatMeasure(displayWeight(60, units))} {weightUnit(units)}
            </bdi>
          </p>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {l(
            "This changes display/input preferences. Stored training measurements keep their canonical units.",
            "هذا يغير تفضيلات العرض والإدخال. تحتفظ القياسات المخزنة بوحداتها الأساسية.",
          )}
        </p>
      </fieldset>
      <section
        className="space-y-3 rounded-xl border border-border bg-card p-4 sm:p-5"
        aria-labelledby="setup-plan-heading"
      >
        <h3 id="setup-plan-heading" className="flex items-center gap-2 font-heading font-semibold">
          <Dumbbell aria-hidden className="size-5 text-gold" />
          {l("Your coach-led plan", "خطتك بإشراف المدرب")}
        </h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {l(
            "Your coach assigns your program and schedule. Choosing units does not change your exercises, prescribed loads or weekly sessions.",
            "يحدد مدربك برنامجك وجدولك. اختيار الوحدات لا يغير التمارين أو الأوزان المقررة أو جلساتك الأسبوعية.",
          )}
        </p>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {l(
            "After setup, review an assigned program from the ready screen. If no program is assigned, contact your coach.",
            "بعد الإعداد، راجع البرنامج المعين من شاشة الاستعداد. إذا لم يوجد برنامج، تواصل مع مدربك.",
          )}
        </p>
      </section>
      <details className="rounded-xl border border-border bg-card p-4 sm:p-5">
        <summary className="min-h-11 cursor-pointer rounded font-heading font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold">
          <Gauge aria-hidden className="me-2 inline size-5 text-gold" />
          {l("Understanding effort ratings", "فهم تقييم الجهد")}
        </summary>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {l(
            "RPE describes how hard a set felt on a 1–10 scale. Log your actual effort; it is separate from the prescribed target. Progression suggestions appear only when your coach enables them.",
            "يصف تقييم الجهد RPE صعوبة المجموعة على مقياس من 1 إلى 10. سجل جهدك الفعلي؛ فهو منفصل عن الهدف المقرر. تظهر اقتراحات التقدم فقط عندما يفعلها مدربك.",
          )}
        </p>
      </details>
    </div>
  );
}
