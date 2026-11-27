import { useRef, useState, type ReactNode } from "react";
import { Eye, EyeOff, LockKeyhole } from "lucide-react";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { useI18n } from "@/lib/i18n";
import { authCopy } from "@/lib/auth-copy";

export function PasswordField({
  id,
  label,
  value,
  onChange,
  fresh = false,
  invalid = false,
  errorId,
  action,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  fresh?: boolean;
  invalid?: boolean;
  errorId?: string;
  /** A control shown on the label row, such as the forgot-password link. */
  action?: ReactNode;
}) {
  const { locale } = useI18n();
  const c = authCopy[locale];
  const [visible, setVisible] = useState(false);
  const [caps, setCaps] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const described = [fresh ? `${id}-rules` : "", caps ? `${id}-caps` : "", invalid ? errorId : ""]
    .filter(Boolean)
    .join(" ");
  return (
    <div className="space-y-2">
      <div className="flex min-h-6 items-center justify-between gap-3">
        <Label htmlFor={id}>{label}</Label>
        {action}
      </div>
      <div className="relative" dir="ltr">
        <LockKeyhole
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-muted-foreground"
        />
        <Input
          ref={ref}
          id={id}
          name={id}
          type={visible ? "text" : "password"}
          value={value}
          autoComplete={fresh ? "new-password" : "current-password"}
          required
          minLength={fresh ? 8 : undefined}
          className="h-12 pr-14 pl-11 text-base"
          aria-invalid={invalid}
          aria-describedby={described || undefined}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => setCaps(e.getModifierState("CapsLock"))}
          onKeyUp={(e) => setCaps(e.getModifierState("CapsLock"))}
          onBlur={() => setCaps(false)}
        />
        <button
          type="button"
          aria-label={visible ? c.hide : c.show}
          aria-controls={id}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-e-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
          onClick={() => {
            setVisible(!visible);
            ref.current?.focus();
          }}
        >
          {visible ? <EyeOff size={19} aria-hidden="true" /> : <Eye size={19} aria-hidden="true" />}
        </button>
      </div>
      {fresh && (
        <p id={`${id}-rules`} className="text-xs leading-relaxed text-muted-foreground">
          {c.rules}
        </p>
      )}
      {caps && (
        <p id={`${id}-caps`} role="status" className="text-xs text-amber-400">
          {c.caps}
        </p>
      )}
    </div>
  );
}

export function AuthNotice({ message, error = false }: { message: string; error?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref}
      id={error ? "auth-error" : "auth-notice"}
      role={error ? "alert" : "status"}
      className={`rounded-lg border p-3 text-sm leading-relaxed ${error ? "border-destructive/40 bg-destructive/10" : "border-gold/25 bg-gold/5"}`}
    >
      {message}
    </div>
  );
}
