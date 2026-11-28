import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** The one hero surface per screen: gold hairline, hammered texture. */
export function ForgeBand({ className, ...props }: ComponentProps<"section">) {
  return <section className={cn("surface-forge p-5", className)} {...props} />;
}
