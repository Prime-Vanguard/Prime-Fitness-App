/** A static placeholder reserves space while keeping one readable status announcement. */
export function LoadingPlaceholder({ label }: { label: string }) {
  return (
    <div role="status" className="my-4 space-y-3 text-sm text-muted-foreground">
      <span>{label}</span>
      <div aria-hidden="true" className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div
            key={item}
            className={`h-32 rounded-xl border border-border bg-card p-4 ${item === 2 ? "col-span-2 lg:col-span-1" : ""}`}
          >
            <div className="h-2 w-2/3 rounded bg-raised" />
            <div className="mt-4 h-5 w-1/2 rounded bg-raised" />
          </div>
        ))}
      </div>
    </div>
  );
}
