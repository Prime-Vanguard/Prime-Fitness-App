import { Bell } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { AppInstallation } from "./app-installation";
import { OnboardingShell } from "./onboarding-shell";
import { Button } from "./ui/button";

/** Device choices follow confirmed setup and never gate saved membership access. */
export function OnboardingDeviceSetup({ onDone }: { onDone: () => void }) {
  const { locale } = useI18n();
  const l = (en: string, ar: string) => (locale === "ar" ? ar : en);
  return (
    <OnboardingShell
      title={l("Stay accountable & ready", "استعد والتزم بخطتك")}
      subtitle={l("Optional device setup", "إعداد الجهاز الاختياري")}
      focusKey="device-setup"
    >
      <section
        className="space-y-4 rounded-xl border border-border bg-card p-4 sm:p-5"
        aria-label={l("In-app notifications", "إشعارات داخل التطبيق")}
      >
        <div className="flex items-center gap-3">
          <span className="rounded-lg bg-background p-3 text-gold">
            <Bell aria-hidden className="size-5" />
          </span>
          <h2 className="font-heading text-lg font-semibold">
            {l("Your notification inbox", "صندوق إشعاراتك")}
          </h2>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {l(
            "Open the bell in the app navigation for your account notifications. No browser notification permission is needed for this inbox.",
            "افتح رمز الجرس في قائمة التطبيق لعرض إشعارات حسابك. لا يتطلب هذا الصندوق إذن إشعارات المتصفح.",
          )}
        </p>
        <p className="rounded-lg bg-background p-3 text-xs leading-relaxed text-muted-foreground">
          {l(
            "Background push alerts and scheduled reminders are not available yet.",
            "تنبيهات الدفع في الخلفية والتذكيرات المجدولة غير متاحة بعد.",
          )}
        </p>
      </section>
      <AppInstallation />
      <Button className="min-h-[50px] w-full" onClick={onDone}>
        {l("Return to ready screen", "العودة إلى شاشة الاستعداد")}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        {l(
          "You can revisit installation from Profile at any time.",
          "يمكنك العودة إلى التثبيت من الملف الشخصي في أي وقت.",
        )}
      </p>
    </OnboardingShell>
  );
}
