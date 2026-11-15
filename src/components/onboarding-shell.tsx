import { useEffect, useRef, type ReactNode } from "react";
import { useI18n } from "@/lib/i18n";
import { BrandLockup } from "./brand-lockup";

/** Access and setup share this compact stack layout; recovery uses its own shell. */
export function OnboardingShell({
  title,
  subtitle,
  children,
  languageLocked = false,
  focusKey,
  setup = false,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  languageLocked?: boolean;
  focusKey?: string;
  setup?: boolean;
}) {
  const { locale, setLocale } = useI18n();
  const heading = useRef<HTMLHeadingElement>(null);
  const previous = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (previous.current !== focusKey) {
      previous.current = focusKey;
      heading.current?.focus();
    }
  }, [focusKey]);
  return (
    <main
      dir={locale === "ar" ? "rtl" : "ltr"}
      className="min-h-dvh bg-background"
      data-onboarding-screen
    >
      <header className="border-b border-border bg-background px-4 py-3">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
          <BrandLockup />
          <button
            type="button"
            disabled={languageLocked}
            onClick={() => setLocale(locale === "ar" ? "en" : "ar")}
            className="min-h-11 rounded-lg px-3 text-sm text-muted-foreground hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
            lang={locale === "ar" ? "en" : "ar"}
          >
            {locale === "ar" ? "English" : "العربية"}
          </button>
        </div>
      </header>
      <div className="mx-auto w-full max-w-lg space-y-5 px-4 py-5 pb-8">
        <h1
          ref={heading}
          tabIndex={-1}
          className={
            setup
              ? "sr-only"
              : "font-heading text-[30px] font-extrabold leading-tight focus:outline-none"
          }
        >
          {title}
        </h1>
        {subtitle && <p className="text-xs font-medium text-gold">{subtitle}</p>}
        {children}
      </div>
    </main>
  );
}
