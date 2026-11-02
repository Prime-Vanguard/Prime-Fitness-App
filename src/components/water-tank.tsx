import { useI18n } from "@/lib/i18n";

export function WaterTank({
  value,
  target,
  pulse,
}: {
  value: number;
  target: number | null | undefined;
  pulse: number;
}) {
  const { t, locale } = useI18n();
  const pct = Math.min(100, Math.max(0, (value / (target || 2000)) * 100));
  return (
    <div
      className="flex flex-col items-center rounded-xl border border-border bg-card p-3"
      aria-live="polite"
    >
      <div
        key={pulse}
        className="water-tank relative h-16 w-14 overflow-hidden rounded-b-2xl rounded-t-lg border-2 border-sky-400/50"
        aria-hidden="true"
      >
        <div
          className="water-fill absolute inset-x-0 bottom-0 bg-sky-500/50 transition-[height] duration-700"
          style={{ height: `${pct}%` }}
        >
          <div className="water-wave absolute -top-2 h-4 w-[200%] rounded-[45%] bg-sky-300/50" />
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{t("water")}</p>
      <p className="text-sm font-semibold tabular-nums">
        {value}
        {target ? ` / ${target}` : ""} ml
      </p>
      {!target && (
        <span className="text-[10px] text-muted-foreground">
          {locale === "ar" ? "مقياس بصري: ٢ لتر" : "Visual scale: 2 L"}
        </span>
      )}
    </div>
  );
}
