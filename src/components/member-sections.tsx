import { Button } from "./ui/button";
export function MemberSections<T extends string>({
  label,
  value,
  items,
  onSelect,
  disabled = false,
}: {
  label: string;
  value: T;
  items: readonly (readonly [T, string])[];
  onSelect: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <nav aria-label={label} className="mt-5 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
      {items.map(([id, title]) => (
        <Button
          className="h-auto min-h-11 min-w-0 whitespace-normal break-words"
          key={id}
          disabled={disabled}
          variant={value === id ? "default" : "outline"}
          aria-pressed={value === id}
          onClick={() => onSelect(id)}
        >
          {title}
        </Button>
      ))}
    </nav>
  );
}
