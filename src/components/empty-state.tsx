import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

/** Empty states name the member's next step: one sentence and one action. */
export function EmptyState({
  icon: Icon,
  text,
  action,
}: {
  icon: LucideIcon;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="surface-card flex flex-col items-start gap-3 p-5">
      <Icon aria-hidden className="size-6 text-gold" />
      <p className="text-sm text-muted-foreground">{text}</p>
      {action}
    </div>
  );
}
