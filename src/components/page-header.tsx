import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="pt-6">
      {eyebrow && (
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gold">{eyebrow}</p>
      )}
      <h1 className="mt-2 text-3xl font-extrabold md:text-4xl">{title}</h1>
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
