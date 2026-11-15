import { ShieldCheck, Link2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { OnboardingShell } from "./onboarding-shell";
import { Button } from "./ui/button";

/** Connections are informational until real integration contracts exist. */
export function OnboardingSystemSetup({
  onContinue,
  onBack,
}: {
  onContinue: () => void;
  onBack: () => void;
}) {
  const { locale } = useI18n();
  const ar = locale === "ar";
  return (
    <OnboardingShell
      title={ar ? "تطبيقات برايم فانجارد" : "Your Prime Vanguard apps"}
      subtitle={ar ? "الاتصالات والخصوصية" : "Connections & privacy"}
      focusKey="ecosystem"
    >
      <section className="space-y-3 rounded-xl border border-border bg-card p-4">
        <ShieldCheck aria-hidden className="size-8 text-gold" />
        <h2 className="font-heading text-lg font-semibold">Prime Fitness</h2>
        <p className="text-sm text-success">
          {ar ? "تم إعداد حسابك في برايم فيتنس." : "Your Prime Fitness account is set up."}
        </p>
      </section>
      {["The System", "Prime Finance"].map((name) => (
        <section key={name} className="space-y-3 rounded-xl border border-border bg-card p-4">
          <Link2 aria-hidden className="size-6 text-muted-foreground" />
          <h2 className="font-heading text-lg font-semibold">{name}</h2>
          <p className="text-sm text-muted-foreground">
            {ar
              ? "الربط غير متاح بعد. لا تتم مشاركة سجلاتك مع هذا التطبيق من هنا."
              : "Account linking is not available yet. Your records are not shared with this app from here."}
          </p>
        </section>
      ))}
      <p className="text-xs text-muted-foreground">
        {ar
          ? "لن يؤدي تخطي هذه الخطوة إلى تغيير نقاطك أو رتبتك أو صلاحية حسابك."
          : "Skipping connections does not change your points, rank or account access."}
      </p>
      <Button className="min-h-12 w-full" onClick={onContinue}>
        {ar ? "متابعة إلى إعداد الجهاز" : "Continue to device setup"}
      </Button>
      <Button variant="ghost" className="min-h-11 w-full" onClick={onBack}>
        {ar ? "العودة إلى شاشة الاستعداد" : "Return to ready screen"}
      </Button>
    </OnboardingShell>
  );
}
