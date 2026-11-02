import { useEffect, useRef, type ReactNode } from "react";
import logo from "@/assets/logo.png";
import { useI18n } from "@/lib/i18n";
import { authCopy } from "@/lib/auth-copy";

export function BrandShell({
  title,
  subtitle,
  children,
  languageLocked = false,
  focusKey,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  languageLocked?: boolean;
  focusKey?: string;
}) {
  const { locale, setLocale } = useI18n();
  const heading = useRef<HTMLHeadingElement>(null),
    previousTitle = useRef(focusKey);
  useEffect(() => {
    if (previousTitle.current !== focusKey) {
      previousTitle.current = focusKey;
      heading.current?.focus({ preventScroll: true });
    }
  }, [focusKey]);
  return (
    <main
      dir={locale === "ar" ? "rtl" : "ltr"}
      className="bg-hero flex min-h-dvh items-center justify-center px-4 py-4 sm:py-8"
    >
      <div className="w-full max-w-md">
        <div className="mb-3 flex items-center justify-between gap-3 sm:mb-6">
          <span className="text-xs font-semibold tracking-wide text-gold">PRIME FITNESS</span>
          <button
            type="button"
            disabled={languageLocked}
            className="min-h-11 rounded-lg border border-border px-4 text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
            onClick={() => setLocale(locale === "ar" ? "en" : "ar")}
            lang={locale === "ar" ? "en" : "ar"}
          >
            {locale === "ar" ? "English" : "العربية"}
          </button>
        </div>
        <div className="flex flex-col items-center text-center">
          <img
            src={logo}
            alt="Prime Vanguard"
            width={80}
            height={80}
            className="h-14 w-14 rounded-2xl border border-gold/30 bg-white object-contain p-1 shadow-lg sm:h-20 sm:w-20"
          />
          <div className="mt-3 h-px w-16 bg-gold sm:mt-5" />
          <h1
            ref={heading}
            tabIndex={-1}
            className="mt-3 break-words font-heading text-2xl font-extrabold focus:outline-none sm:mt-5 sm:text-3xl"
          >
            {title}
          </h1>
          {subtitle && <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        <div className="mt-4 rounded-2xl border border-gold/20 bg-card p-5 shadow-xl sm:mt-7 sm:p-8">
          {children}
        </div>
        <p className="mt-5 text-center text-xs leading-relaxed text-muted-foreground">
          {authCopy[locale].subtitle}
        </p>
      </div>
    </main>
  );
}
