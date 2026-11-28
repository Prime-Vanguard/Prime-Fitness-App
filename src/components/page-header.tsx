import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  children,
  compact = false,
  eyebrowTone = "muted",
  accessory,
}: {
  eyebrow?: string;
  title: string;
  children?: ReactNode;
  compact?: boolean;
  eyebrowTone?: "muted" | "accent";
  /** Optional contextual status shares the eyebrow row without absolute positioning. */
  accessory?: ReactNode;
}) {
  return (
    <div className="pt-5 pb-3 md:pt-0" data-page-header>
      {(eyebrow || accessory) && (
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          {eyebrow && (
            <p
              className={
                "text-sm font-medium " +
                (eyebrowTone === "accent" ? "text-gold" : "text-muted-foreground")
              }
            >
              {eyebrow}
            </p>
          )}
          {accessory}
        </div>
      )}
      <h1
        className={
          compact
            ? "font-heading text-2xl font-bold leading-8"
            : "font-display text-[40px] leading-[1.05] font-extrabold md:text-5xl"
        }
      >
        {title}
      </h1>
      {children}
    </div>
  );
}

export function ComingSoon({ text }: { text: string }) {
  return (
    <div className="mt-8 rounded-xl border border-dashed border-border bg-card/50 p-8 text-center text-muted-foreground">
      {text}
    </div>
  );
}
