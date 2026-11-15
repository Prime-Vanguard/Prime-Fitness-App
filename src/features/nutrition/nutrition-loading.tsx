/** Static shapes match the calorie card and macro tiles without suggesting values. */
export function NutritionLoading({ label }: { label: string }) {
  return (
    <div role="status" className="space-y-2 text-sm text-muted-foreground">
      <span>{label}</span>
      <div aria-hidden="true" className="space-y-4 rounded-xl bg-card p-4">
        <div className="flex justify-between gap-3">
          <div className="h-10 w-1/2 rounded-lg bg-raised" />
          <div className="h-10 w-1/4 rounded-lg bg-raised" />
        </div>
        <div className="h-2 rounded-full bg-raised" />
        <div className="grid grid-cols-3 gap-2">
          {[0, 1, 2].map((item) => (
            <div key={item} className="h-20 rounded-lg bg-background" />
          ))}
        </div>
      </div>
    </div>
  );
}
