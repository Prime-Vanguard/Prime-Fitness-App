import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { BrandLockup } from "./brand-lockup";
import { Button } from "./ui/button";

/** Root failures can render outside I18nProvider; read only the language preference.
 * Keep the error itself out of the page so private request details are not exposed. */
export function RouteFallback({ retry }: { retry?: () => void }) {
  const [ar, setAr] = useState(false);
  useEffect(() => {
    try {
      setAr(localStorage.getItem("pf-locale") !== "en");
    } catch {
      setAr(document.documentElement.lang === "ar");
    }
  }, []);
  return (
    <main
      dir={ar ? "rtl" : "ltr"}
      lang={ar ? "ar" : "en"}
      className="flex min-h-dvh items-center justify-center bg-background p-5"
    >
      <section className="w-full max-w-md space-y-6 rounded-xl bg-card p-6 sm:p-8">
        <BrandLockup />
        <p className="text-xs font-semibold uppercase tracking-wider text-gold">
          {retry ? (ar ? "تعذر تحميل الصفحة" : "Page unavailable") : "404"}
        </p>
        <h1 className="font-heading text-2xl font-bold">
          {retry
            ? ar
              ? "لم تُحمّل هذه الصفحة"
              : "This page didn't load"
            : ar
              ? "الصفحة غير موجودة"
              : "Page not found"}
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {retry
            ? ar
              ? "أعد المحاولة أو ارجع إلى الصفحة الرئيسية."
              : "Try again or return to the home page."
            : ar
              ? "قد يكون الرابط غير صحيح أو لم تعد الصفحة متاحة."
              : "The link may be incorrect or the page may no longer be available."}
        </p>
        <div className="flex flex-wrap gap-3">
          {retry && <Button onClick={retry}>{ar ? "إعادة المحاولة" : "Try again"}</Button>}
          <Button variant="outline" asChild>
            <Link to="/">{ar ? "الصفحة الرئيسية" : "Go home"}</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
