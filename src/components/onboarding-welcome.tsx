import { useI18n, type Locale } from "@/lib/i18n";
import logo from "@/assets/logo.png";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "./ui/button";

/** Language selection is an introduction; only Finish commits the member setup. */
export function OnboardingWelcome({ onContinue }: { onContinue: () => void }) {
  const { locale, setLocale } = useI18n();
  const ar = locale === "ar";
  return (
    <main dir={ar ? "rtl" : "ltr"} className="min-h-dvh bg-background" data-onboarding-welcome>
      <div className="mx-auto w-full max-w-lg space-y-6 px-4 py-5 sm:py-8">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {ar ? "مرحباً بك في برايم فيتنس" : "Protocol initialization"}
        </p>
        <div className="py-3 text-center" dir="ltr">
          <img
            src={logo}
            alt="Prime Vanguard"
            width={64}
            height={64}
            className="mx-auto size-16 object-contain"
          />
          <h1 className="mt-3 font-heading text-xl font-bold tracking-[0.18em]">PRIME VANGUARD</h1>
          <p className="mt-2 text-xs font-semibold tracking-[0.3em] text-gold">PRIME FITNESS</p>
          <p className="mt-5 text-sm italic text-muted-foreground">“Excellence over ease.”</p>
        </div>
        <fieldset className="space-y-3">
          <legend className="mb-4 text-sm leading-relaxed text-muted-foreground">
            {ar
              ? "اختر لغة الواجهة للبدء. يمكنك تغييرها لاحقاً من إعدادات الملف الشخصي."
              : "Select your interface language to begin. You can switch at any time in Profile Settings."}
          </legend>
          {(["en", "ar"] as Locale[]).map((value) => (
            <label
              key={value}
              className={`flex min-h-[76px] cursor-pointer items-center justify-between gap-3 rounded-xl border p-4 text-start focus-within:ring-2 focus-within:ring-gold ${locale === value ? "border-gold bg-raised" : "border-border bg-card"}`}
            >
              <span className="min-w-0">
                <span className="block font-heading font-semibold" lang={value}>
                  {value === "en" ? "English" : "العربية"}
                </span>
                <span
                  className="mt-1 block text-xs leading-relaxed text-muted-foreground"
                  lang={value}
                >
                  {value === "en"
                    ? "Metric and imperial units"
                    : "واجهة باللغة العربية من اليمين إلى اليسار"}
                </span>
              </span>
              <input
                type="radio"
                name="welcome-language"
                aria-label={value === "en" ? "English" : "العربية"}
                value={value}
                checked={locale === value}
                onChange={() => setLocale(value)}
                className="size-5 shrink-0 accent-[var(--gold)]"
              />
            </label>
          ))}
        </fieldset>
        <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 text-xs leading-relaxed text-muted-foreground">
          <ShieldCheck aria-hidden className="size-5 shrink-0 text-gold" />
          <p>
            {ar
              ? "برايم فيتنس متاح بالدعوة فقط. أكمل تفضيلات حسابك قبل بدء التدريب."
              : "Prime Fitness is invite-only. Complete your account preferences before starting your training."}
          </p>
        </div>
        <Button className="min-h-[50px] w-full text-base" onClick={onContinue}>
          {ar ? "بدء الإعداد" : "Begin setup"}
          <ArrowRight aria-hidden className="size-5 rtl:rotate-180" />
        </Button>
      </div>
    </main>
  );
}
