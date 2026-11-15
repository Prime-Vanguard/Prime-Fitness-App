/** Staff overview values describe already-loaded records. Undefined means the
 * read is unavailable or incomplete, so it must never be presented as zero. */
export function StaffSummary({
  label,
  items,
  compact = false,
}: {
  label: string;
  items: readonly { label: string; value: number | undefined }[];
  /** Compact queue summaries sit beside the heading; counts retain their read scope. */
  compact?: boolean;
}) {
  return (
    <dl
      aria-label={label}
      className={`grid grid-cols-2 gap-3 ${compact ? "" : "mt-5 sm:grid-cols-3"}`}
    >
      {items.map((item) => (
        <div
          key={item.label}
          className={`min-w-0 rounded-xl border border-border bg-card ${compact ? "p-3" : "p-4"}`}
        >
          <dt className="text-xs text-muted-foreground">{item.label}</dt>
          <dd
            className={`font-heading font-bold tabular-nums ${compact ? "mt-1 text-xl" : "mt-2 text-2xl"}`}
          >
            {item.value ?? "—"}
          </dd>
        </div>
      ))}
    </dl>
  );
}
