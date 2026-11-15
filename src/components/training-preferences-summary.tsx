import { useI18n } from "@/lib/i18n";
import { trainingPreferenceSchema, trainingPreferenceLabels } from "@/lib/onboarding-preferences";

/** Member review and authorized staff views consume the same saved context. */
export function TrainingPreferencesSummary({ value }: { value: unknown }) {
  const { locale } = useI18n();
  const parsed = trainingPreferenceSchema.safeParse(value);
  if (!parsed.success) return null;
  const ar = locale === "ar",
    p = parsed.data;
  const label = (key: keyof typeof trainingPreferenceLabels) =>
    trainingPreferenceLabels[key][ar ? 1 : 0];
  const missing = ar ? "غير محدد" : "Not specified";
  const rows = [
    [ar ? "الأهداف" : "Goals", p.goals.map(label).join(ar ? "، " : ", ") || missing],
    [ar ? "الخبرة" : "Experience", p.experience ? label(p.experience) : missing],
    [ar ? "الأيام أسبوعياً" : "Days per week", String(p.weekly_days ?? missing)],
    [ar ? "المعدات" : "Equipment", p.equipment.map(label).join(ar ? "، " : ", ") || missing],
  ];
  return (
    <section
      className="space-y-3 rounded-xl border border-border bg-card p-4"
      aria-label={ar ? "تفضيلات التدريب المحفوظة" : "Saved training preferences"}
    >
      <h3 className="font-heading font-semibold">
        {ar ? "تفضيلات التدريب" : "Training preferences"}
      </h3>
      <dl className="space-y-3 text-sm">
        {rows.map(([key, val]) => (
          <div key={key} className="flex flex-wrap justify-between gap-2">
            <dt className="text-muted-foreground">{key}</dt>
            <dd>{val}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
