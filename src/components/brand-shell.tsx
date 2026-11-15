import { useEffect, useRef, type ReactNode } from "react";
import { useI18n } from "@/lib/i18n";
import { authCopy } from "@/lib/auth-copy";
import { BrandLockup } from "./brand-lockup";

/** Shared access/setup composition; focus changes follow the existing workflow key. */
export function BrandShell({
  title,
  subtitle,
  children,
  languageLocked = false,
  focusKey,
  topAligned = false,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  languageLocked?: boolean;
  focusKey?: string;
  topAligned?: boolean;
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
      className={`bg-hero flex min-h-dvh justify-center px-4 py-4 sm:py-8 ${topAligned ? "items-start sm:items-center" : "items-center"}`}
    >
      <div className="w-full max-w-md">
        <div className="mb-3 flex items-center justify-between gap-3 sm:mb-6">
          <BrandLockup />
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
        <div className="flex flex-col items-start text-start">
          <div aria-hidden className="mt-5 h-1 w-16 rounded-full bg-gold" />
          <h1
            ref={heading}
            tabIndex={-1}
            className="mt-3 break-words font-heading text-2xl font-extrabold focus:outline-none sm:mt-5 sm:text-3xl"
          >
            {title}
          </h1>
          {subtitle && <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        <div className="app-auth-flow app-page-flow mt-6 rounded-xl bg-card p-5 sm:mt-8 sm:p-6">
          {children}
        </div>
        <p className="mt-5 text-center text-xs leading-relaxed text-muted-foreground">
          {authCopy[locale].subtitle}
        </p>
      </div>
    </main>
  );
}
