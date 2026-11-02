export function adminDate(value: string | null, locale: string) {
  if (!value) return locale === "ar" ? "غير مسجل" : "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? locale === "ar"
      ? "غير متاح"
      : "Unavailable"
    : new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-GB", {
        timeZone: "Africa/Cairo",
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
}
