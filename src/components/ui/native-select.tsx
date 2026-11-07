import * as React from "react";
import { cn } from "@/lib/utils";

/** Shared native control: consistent sizing with browser keyboard/picker support. */
const NativeSelect = React.forwardRef<HTMLSelectElement, React.ComponentProps<"select">>(
  ({ className, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        "block min-h-11 w-full min-w-0 max-w-full rounded-md border border-input bg-background py-2 ps-3 pe-9 text-start text-base leading-normal text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className,
      )}
      {...props}
    />
  ),
);
NativeSelect.displayName = "NativeSelect";
export { NativeSelect };
