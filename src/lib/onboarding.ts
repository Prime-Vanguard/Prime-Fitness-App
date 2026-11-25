import { supabase } from "@/integrations/supabase/client";
import { parseTrainingPreferences, type TrainingPreferences } from "./onboarding-preferences";
export type OnboardingDraft = {
  name: string;
  locale: "ar" | "en";
  units: "metric" | "imperial";
  consent_at: string;
  training?: TrainingPreferences;
};
export function onboardingErrorText(error: unknown, locale: "ar" | "en") {
  const message =
    error && typeof error === "object" && "message" in error ? String(error.message) : "";
  const copies = [
    [
      "Training setup needs a database update. Your choices remain here; contact your administrator.",
      "يحتاج إعداد التدريب إلى تحديث قاعدة البيانات. تبقى اختياراتك هنا؛ تواصل مع المسؤول.",
    ],
    [
      "Sign in to the same account before finishing setup.",
      "سجّل الدخول إلى الحساب نفسه قبل إنهاء الإعداد.",
    ],
    [
      "Active membership is required to finish setup. Contact your coach.",
      "يلزم اشتراك نشط لإنهاء الإعداد. تواصل مع مدربك.",
    ],
    [
      "Setup was completed elsewhere. Reload saved setup to review your preferences.",
      "اكتمل الإعداد من مكان آخر. أعد تحميل الإعداد المحفوظ لمراجعة تفضيلاتك.",
    ],
    [
      "Setup was not confirmed. Retry the same request or reload saved setup.",
      "لم يتم تأكيد الإعداد. أعد محاولة الطلب نفسه أو حمّل الإعداد المحفوظ.",
    ],
    ["Enter a display name of 1–100 characters.", "أدخل اسماً من 1 إلى 100 حرف."],
    [
      "Review your language, units and consent before saving.",
      "راجع اللغة والوحدات والموافقة قبل الحفظ.",
    ],
  ];
  return (
    copies.find(([english]) => english === message)?.[locale === "ar" ? 1 : 0] ??
    (locale === "ar"
      ? "تعذر تأكيد الإعداد. أعد المحاولة دون تغيير أو أعد تحميل الإعداد المحفوظ."
      : "Setup could not be confirmed. Retry unchanged or reload saved setup.")
  );
}
export function onboardingInput(draft: OnboardingDraft) {
  const name = draft.name.trim();
  if (!name || name.length > 100) throw new Error("Enter a display name of 1–100 characters.");
  if (
    !["ar", "en"].includes(draft.locale) ||
    !["metric", "imperial"].includes(draft.units) ||
    !Number.isFinite(Date.parse(draft.consent_at))
  )
    throw new Error("Review your language, units and consent before saving.");
  return {
    display_name: name,
    locale: draft.locale,
    units: draft.units,
    consent_at: draft.consent_at,
    onboarding_completed: true,
    ...(draft.training ? { training_preferences: parseTrainingPreferences(draft.training) } : {}),
  };
}
export async function completeOnboarding(actor: string, draft: OnboardingDraft) {
  const values = onboardingInput(draft);
  const verified = await supabase.auth.getUser();
  if (verified.error) throw verified.error;
  if (verified.data.user?.id !== actor)
    throw new Error("Sign in to the same account before finishing setup.");
  const before = await supabase
    .from("profiles")
    .select("*")
    .eq("id", actor)
    .maybeSingle()
    .retry(false);
  if (before.error) throw before.error;
  if (!before.data?.access_active)
    throw new Error("Active membership is required to finish setup. Contact your coach.");
  const matches = (row: typeof before.data | null) =>
    !!row &&
    row.id === actor &&
    row.onboarding_completed &&
    Date.parse(row.consent_at ?? "") === Date.parse(values.consent_at) &&
    Object.entries(values)
      .filter(([key]) => key !== "consent_at")
      .every(([key, value]) =>
        key === "training_preferences"
          ? JSON.stringify(
              row.training_preferences && parseTrainingPreferences(row.training_preferences),
            ) === JSON.stringify(value)
          : row[key as keyof typeof row] === value,
      );
  if (matches(before.data)) return before.data;
  if (before.data.onboarding_completed)
    throw new Error(
      "Setup was completed elsewhere. Reload saved setup to review your preferences.",
    );
  const result = await supabase
    .from("profiles")
    .update(values)
    .eq("id", actor)
    .eq("onboarding_completed", false)
    .eq("access_active", true)
    .select("*")
    .maybeSingle()
    .retry(false);
  if (result.error) {
    // Never silently drop new preferences when an older backend lacks this column.
    if (["PGRST204", "42703"].includes(result.error.code))
      throw new Error(
        "Training setup needs a database update. Your choices remain here; contact your administrator.",
      );
    throw result.error;
  }
  if (!matches(result.data))
    throw new Error("Setup was not confirmed. Retry the same request or reload saved setup.");
  return result.data!;
}
