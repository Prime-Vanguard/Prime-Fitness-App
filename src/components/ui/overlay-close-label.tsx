import { useI18n } from "@/lib/i18n";
export function OverlayCloseLabel() {
  const { locale } = useI18n();
  return <span className="sr-only">{locale === "ar" ? "إغلاق" : "Close"}</span>;
}
