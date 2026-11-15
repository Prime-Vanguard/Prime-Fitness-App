import { SelectionIndicator } from "./selection-indicator";
import { Button } from "./ui/button";
/** Section changes retain their existing handlers; the shared marker is decorative
 * for both segmented surfaces and underlines, including wrapped translated labels. */
export function MemberSections<T extends string>({
  label,
  value,
  items,
  onSelect,
  disabled = false,
  appearance = "underline",
  equalWidth = false,
  animated = true,
}: {
  label: string;
  value: T;
  items: readonly (readonly [T, string])[];
  onSelect: (value: T) => void;
  disabled?: boolean;
  appearance?: "underline" | "segmented";
  equalWidth?: boolean;
  animated?: boolean;
}) {
  const sliding = animated;
  return (
    <nav
      aria-label={label}
      className={
        (appearance === "segmented"
          ? `mt-5 flex min-w-0 gap-1 rounded-lg bg-card p-1 ${sliding ? "relative isolate" : ""}`
          : equalWidth
            ? "mt-5 grid min-w-0 border-b border-border"
            : "mt-5 flex min-w-0 flex-wrap gap-x-4 gap-y-1 border-b border-border") +
        (sliding ? " sliding-selection" : "")
      }
      style={
        equalWidth
          ? { gridTemplateColumns: "repeat(" + items.length + ", minmax(0, 1fr))" }
          : undefined
      }
      data-studio-sections
    >
      {sliding && <SelectionIndicator underline={appearance === "underline"} />}
      {items.map(([id, title]) => (
        <Button
          className={
            appearance === "segmented"
              ? `h-auto min-h-11 min-w-0 flex-1 rounded-md px-2 whitespace-normal break-words ${sliding ? "relative z-10 hover:bg-transparent" : ""} ${value === id ? `${sliding ? "" : "bg-raised"} text-foreground` : "text-muted-foreground"}`
              : `h-auto min-h-11 min-w-0 rounded-none border-b-2 px-1 whitespace-normal break-words ${equalWidth ? "font-sans font-medium" : ""} ${value === id ? `${sliding ? "border-transparent" : "border-gold"} text-foreground` : "border-transparent text-muted-foreground"}`
          }
          key={id}
          disabled={disabled}
          variant="ghost"
          aria-pressed={value === id}
          onClick={() => onSelect(id)}
        >
          {title}
        </Button>
      ))}
    </nav>
  );
}
