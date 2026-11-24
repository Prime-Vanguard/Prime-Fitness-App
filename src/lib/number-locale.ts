import type { Locale } from "./i18n";

// Arabic text with Western digits (0-9), matching the numbers members type and see in data.
export const numberLocale = (locale: Locale | string) =>
  locale === "ar" ? "ar-EG-u-nu-latn" : "en-GB";
