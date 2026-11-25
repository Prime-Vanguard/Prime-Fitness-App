import { numberLocale } from "@/lib/number-locale";
import { useI18n } from "@/lib/i18n";

/** Neutral comparison of two recorded values; no success or health interpretation. */
export function RecordComparison({
  before,
  after,
  unit,
  compact = false,
}: {
  before: { date: string; value: number };
  after: { date: string; value: number };
  unit: string;
  /** Metric cards show the delta first; date evidence remains screen-reader accessible. */
  compact?: boolean;
}) {
  const { locale } = useI18n();
  const delta = Math.round((after.value - before.value) * 100) / 100;
  const percent =
    before.value !== 0 ? Math.round((delta / Math.abs(before.value)) * 1000) / 10 : null;
  const fmt = (n: number) => `${n > 0 ? "+" : ""}${n.toLocaleString(numberLocale(locale))}`;
  return (
    <p className="mt-2 text-xs text-muted-foreground" data-record-comparison>
      <bdi>
        {fmt(delta)} {unit === "%" ? (locale === "ar" ? "نقطة مئوية" : "percentage points") : unit}
        {percent == null ? "" : ` (${fmt(percent)}%)`}
      </bdi>{" "}
      <span className={compact ? "sr-only" : undefined}>
        · <bdi>{before.date}</bdi> → <bdi>{after.date}</bdi>
      </span>
      <span className="sr-only">
        {locale === "ar"
          ? " مقارنة بين سجلات فعلية؛ ليست تقييماً للصحة."
          : " Comparison of recorded values; not a health assessment."}
      </span>
    </p>
  );
}
