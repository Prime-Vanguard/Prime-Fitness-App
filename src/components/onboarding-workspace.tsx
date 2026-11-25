import { SelectionIndicator } from "./selection-indicator";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMe } from "@/hooks/use-me";
import { useI18n, type Locale } from "@/lib/i18n";
import { completeOnboarding, onboardingErrorText, type OnboardingDraft } from "@/lib/onboarding";
import { supabase } from "@/integrations/supabase/client";
import { BrandShell } from "./brand-shell";
import { OnboardingShell } from "./onboarding-shell";
import { OnboardingWelcome } from "./onboarding-welcome";
import { OnboardingDeviceSetup } from "./onboarding-device-setup";
import { OnboardingTrainingPreferences } from "./onboarding-training-preferences";
import { OnboardingSystemSetup } from "./onboarding-system-setup";
import { TrainingPreferencesSummary } from "./training-preferences-summary";
import { emptyTrainingPreferences, trainingPreferenceSchema } from "@/lib/onboarding-preferences";
import { ShieldCheck } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import type { Database } from "@/integrations/supabase/types";
type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export function OnboardingWorkspace({ actor }: { actor: string }) {
  const me = useMe(actor),
    { t, locale } = useI18n(),
    l = (en: string, ar: string) => (locale === "ar" ? ar : en);
  if (me.isPending)
    return (
      <BrandShell title={t("onboardingTitle")}>
        <p role="status">{l("Loading your setup…", "جارٍ تحميل إعداد حسابك…")}</p>
      </BrandShell>
    );
  if (!me.data?.profile)
    return (
      <BrandShell title={t("onboardingTitle")}>
        <p role="alert">
          {l(
            "Your profile could not be loaded. Retry to check the saved setup.",
            "تعذر تحميل ملفك. أعد المحاولة لفحص الإعداد المحفوظ.",
          )}
        </p>
        <Button className="mt-4" onClick={() => void me.refetch()}>
          {l("Retry setup", "إعادة تحميل الإعداد")}
        </Button>
      </BrandShell>
    );
  if (!me.data.profile.access_active)
    return (
      <BrandShell title={t("onboardingTitle")}>
        <p role="status">
          {l(
            "Your account access is paused. Contact your coach before continuing setup.",
            "صلاحية حسابك متوقفة. تواصل مع مدربك قبل متابعة الإعداد.",
          )}
        </p>
        <Link to="/today" className="mt-4 block min-h-11 text-gold">
          {l("View account access", "عرض حالة الحساب")}
        </Link>
      </BrandShell>
    );
  return (
    <SetupForm
      key={actor}
      actor={actor}
      profile={me.data.profile}
      refreshFailed={!!me.error}
      reload={() => void me.refetch()}
    />
  );
}
function SetupForm({
  actor,
  profile,
  reload,
  refreshFailed,
}: {
  actor: string;
  profile: Profile;
  reload: () => void;
  refreshFailed: boolean;
}) {
  const { t, locale, setLocale } = useI18n(),
    qc = useQueryClient(),
    l = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const [step, setStep] = useState(0),
    [welcome, setWelcome] = useState(true),
    [deviceSetup, setDeviceSetup] = useState(false),
    [systemSetup, setSystemSetup] = useState(false),
    [training, setTraining] = useState(() => {
      const p = trainingPreferenceSchema.safeParse(profile.training_preferences);
      return p.success ? p.data : emptyTrainingPreferences();
    }),
    [name, setName] = useState(profile.display_name ?? ""),
    [units, setUnits] = useState<"metric" | "imperial">(
      profile.units === "imperial" ? "imperial" : "metric",
    ),
    [agree, setAgree] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [nameError, setNameError] = useState(false),
    [saved, setSaved] = useState<OnboardingDraft | null>(null);
  const pending = useRef(false),
    request = useRef<OnboardingDraft | null>(null),
    heading = useRef<HTMLHeadingElement>(null),
    previousStep = useRef(0);
  const complete = !!saved || profile.onboarding_completed;
  useEffect(() => {
    if (!welcome) heading.current?.focus({ preventScroll: true });
  }, [welcome]);
  const assignment = useQuery({
    queryKey: ["onboarding-next-program", actor],
    enabled: complete,
    retry: false,
    queryFn: async ({ signal }) => {
      const r = await supabase
        .from("program_assignments")
        .select("id,program_version_id")
        .eq("member_id", actor)
        .eq("active", true)
        .limit(1)
        .abortSignal(signal)
        .retry(false);
      if (r.error) throw r.error;
      return r.data.length > 0;
    },
  });
  useEffect(() => {
    if (previousStep.current !== step) {
      previousStep.current = step;
      heading.current?.focus({ preventScroll: true });
    }
  }, [step]);
  const labels = [
    l("About you", "عن حسابك"),
    l("Training preferences", "تفضيلات التدريب"),
    l("Review & consent", "المراجعة والموافقة"),
  ];
  function next() {
    setError("");
    if (!name.trim() || name.trim().length > 100) {
      setNameError(true);
      document.getElementById("onboarding-name")?.focus();
      return;
    }
    setNameError(false);
    setStep(step + 1);
  }
  async function finish(event: FormEvent) {
    event.preventDefault();
    if (step < 2) {
      next();
      return;
    }
    if (pending.current) return;
    setError("");
    if (!agree) {
      setError(
        l(
          "Review the guidance and confirm your agreement before finishing.",
          "راجع الإرشادات وأكد موافقتك قبل الإنهاء.",
        ),
      );
      return;
    }
    pending.current = true;
    setBusy(true);
    const payload = request.current ?? {
      name,
      locale,
      units,
      training,
      consent_at: new Date().toISOString(),
    };
    request.current = payload;
    try {
      const receipt = await completeOnboarding(actor, payload);
      qc.setQueryData<NonNullable<ReturnType<typeof useMe>["data"]>>(["me", actor], (cached) =>
        cached?.profile ? { ...cached, profile: { ...cached.profile, ...receipt } } : cached,
      );
      setSaved(payload);
      void qc.invalidateQueries({ queryKey: ["me", actor] });
    } catch (e) {
      setError(onboardingErrorText(e, locale));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  const option =
    "flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-border p-3 text-sm has-[:checked]:border-gold has-[:checked]:bg-gold/5";
  const refreshNotice = refreshFailed && (
    <div role="alert" className="mb-4 space-y-2 rounded-lg border border-border p-3 text-sm">
      <p>
        {l(
          "The profile refresh failed. Showing the last confirmed settings.",
          "تعذر تحديث الملف. تُعرض آخر تفضيلات مؤكدة.",
        )}
      </p>
      <Button variant="outline" onClick={reload}>
        {l("Retry profile refresh", "إعادة تحديث الملف")}
      </Button>
    </div>
  );
  if (complete && systemSetup)
    return (
      <OnboardingSystemSetup
        onBack={() => setSystemSetup(false)}
        onContinue={() => {
          setSystemSetup(false);
          setDeviceSetup(true);
        }}
      />
    );
  if (complete && deviceSetup)
    return <OnboardingDeviceSetup onDone={() => setDeviceSetup(false)} />;
  if (complete)
    return (
      <OnboardingShell
        title={l("Your setup is complete", "اكتمل إعداد حسابك")}
        focusKey="setup-complete"
        subtitle={l("Choose your next step", "اختر خطوتك التالية")}
      >
        <section className="space-y-4" aria-label={l("Setup completion", "اكتمال الإعداد")}>
          {refreshNotice}
          <div
            aria-hidden
            className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-raised text-gold"
          >
            <ShieldCheck className="size-8" />
          </div>
          <p className="text-center text-sm leading-relaxed text-muted-foreground">
            {l(
              "Your preferences are saved. Review them in Profile; language and units can be changed there. Discuss training changes with your coach.",
              "تفضيلاتك محفوظة ويمكن مراجعتها في الملف الشخصي وتغيير اللغة والوحدات هناك. ناقش تغييرات التدريب مع مدربك.",
            )}
          </p>
          <TrainingPreferencesSummary value={saved?.training ?? profile.training_preferences} />
          <dl className="grid grid-cols-2 gap-3 rounded-xl border border-border bg-card p-4 text-sm">
            <div>
              <dt className="text-muted-foreground">{t("displayName")}</dt>
              <dd className="break-words">{saved?.name.trim() ?? profile.display_name}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t("units")}</dt>
              <dd>{t((saved?.units ?? profile.units) === "imperial" ? "imperial" : "metric")}</dd>
            </div>
          </dl>
          <section
            className="space-y-4 rounded-xl border border-border bg-card p-4 sm:p-5"
            aria-label={l("Your training plan", "خطتك التدريبية")}
          >
            <h2 className="font-heading text-lg font-semibold">
              {l("Your training plan", "خطتك التدريبية")}
            </h2>
            {assignment.isPending ? (
              <p role="status">
                {l("Checking your assigned program…", "جارٍ فحص برنامجك المعين…")}
              </p>
            ) : assignment.error ? (
              <div role="alert">
                <p>
                  {l(
                    "Program availability could not be checked. Your setup remains saved.",
                    "تعذر فحص توفر البرنامج. يبقى إعداد حسابك محفوظاً.",
                  )}
                </p>
                <Button variant="outline" onClick={() => void assignment.refetch()}>
                  {l("Retry program check", "إعادة فحص البرنامج")}
                </Button>
              </div>
            ) : assignment.data ? (
              <>
                <p>
                  {l(
                    "Your coach has assigned a program. Preview the next session before starting.",
                    "عيّن مدربك برنامجاً لك. عاين الجلسة القادمة قبل البدء.",
                  )}
                </p>
                <Button asChild className="w-full">
                  <Link to="/train" search={{ section: "program" }}>
                    {l("View my program", "عرض برنامجي")}
                  </Link>
                </Button>
              </>
            ) : (
              <p>
                {l(
                  "No active program is assigned yet. Open Today for daily actions and contact your coach about your training plan.",
                  "لا يوجد برنامج نشط معين بعد. افتح اليوم للمهام اليومية وتواصل مع مدربك بشأن خطتك.",
                )}
              </p>
            )}
          </section>
          <Button asChild className="min-h-[50px] w-full">
            <Link to="/today">{l("Go to Today", "الانتقال إلى اليوم")}</Link>
          </Button>
          <Button
            variant="outline"
            className="min-h-12 w-full"
            onClick={() => setDeviceSetup(true)}
          >
            {l("App & notifications", "التطبيق والإشعارات")}
          </Button>
          <Button variant="ghost" className="min-h-11 w-full" onClick={() => setSystemSetup(true)}>
            {l("Prime Vanguard apps", "تطبيقات برايم فانجارد")}
          </Button>
        </section>
      </OnboardingShell>
    );
  if (welcome) return <OnboardingWelcome onContinue={() => setWelcome(false)} />;
  return (
    <OnboardingShell
      title={t("onboardingTitle")}
      setup
      languageLocked={busy || !!request.current}
      subtitle={`${t("step")} ${step + 1} ${t("of")} 3 · ${labels[step]}`}
    >
      {refreshNotice}
      <ol
        aria-label={l("Setup steps", "خطوات الإعداد")}
        className="mb-5 grid grid-cols-3 gap-3 text-xs"
      >
        {labels.map((label, i) => (
          <li
            key={label}
            aria-current={i === step ? "step" : undefined}
            className={`space-y-2 py-2 ${i === step ? "font-semibold text-gold" : "text-muted-foreground"}`}
          >
            <span>{i + 1}. </span>
            {/* Show the three real setup steps, rather than copying unsupported mock steps. */}
            <span
              aria-hidden
              className={`block h-1 rounded-full ${i <= step ? "bg-gold" : "bg-border"}`}
            />
            {label}
          </li>
        ))}
      </ol>
      <h2
        ref={heading}
        tabIndex={-1}
        className="mb-4 font-heading text-[30px] font-extrabold leading-tight focus:outline-none"
      >
        {labels[step]}
      </h2>
      <form onSubmit={finish} aria-busy={busy} className="space-y-4">
        <fieldset disabled={busy || !!request.current} className="space-y-4">
          {step === 0 && (
            <>
              <fieldset className="space-y-2">
                <legend className="mb-2 text-sm font-medium">{t("language")}</legend>
                <div className="sliding-selection grid grid-cols-2 gap-2">
                  {/* Native radios retain their focus and arrow-key semantics. */}
                  <SelectionIndicator />
                  {(["ar", "en"] as Locale[]).map((value) => (
                    <label key={value} className={option}>
                      <input
                        type="radio"
                        name="setup-language"
                        value={value}
                        checked={locale === value}
                        onChange={() => setLocale(value)}
                        className="h-5 w-5 accent-[var(--gold)]"
                      />
                      <span lang={value}>{value === "ar" ? "العربية" : "English"}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="space-y-3 rounded-xl border border-border bg-card p-4">
                <label htmlFor="onboarding-name" className="text-sm font-medium">
                  {t("displayName")}
                </label>
                <Input
                  id="onboarding-name"
                  autoComplete="name"
                  maxLength={100}
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setNameError(false);
                  }}
                  aria-invalid={nameError}
                  aria-describedby={nameError ? "setup-name-error" : "setup-name-hint"}
                />
                <p id="setup-name-hint" className="text-xs text-muted-foreground">
                  {l(
                    "Use the name your coach will recognize. 1–100 characters.",
                    "استخدم الاسم الذي يعرفك به مدربك. من 1 إلى 100 حرف.",
                  )}
                </p>
                {nameError && (
                  <p id="setup-name-error" role="alert" className="text-sm text-destructive">
                    {l("Enter a display name of 1–100 characters.", "أدخل اسماً من 1 إلى 100 حرف.")}
                  </p>
                )}
              </div>
            </>
          )}
          {step === 1 && (
            <OnboardingTrainingPreferences
              units={units}
              onChange={setUnits}
              preferences={training}
              onPreferences={setTraining}
            />
          )}
          {step === 2 && (
            <>
              <TrainingPreferencesSummary value={training} />
              <dl className="grid grid-cols-2 gap-3 rounded-xl border border-border bg-card p-4 text-sm">
                <div>
                  <dt className="text-muted-foreground">{t("displayName")}</dt>
                  <dd className="break-words">{name.trim()}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{t("language")}</dt>
                  <dd>{locale === "ar" ? "العربية" : "English"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{t("units")}</dt>
                  <dd>{t(units)}</dd>
                </div>
              </dl>
              {/* Keep the actual consent text and single required choice intact;
                  the reference's additional agreements are not implemented. */}
              <section
                className="space-y-3 rounded-xl border border-border bg-card p-4"
                aria-labelledby="setup-consent-title"
              >
                <h3 id="setup-consent-title" className="font-heading font-semibold">
                  {t("consentTitle")}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{t("consentText")}</p>
                <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border border-border bg-background p-3 text-sm focus-within:ring-2 focus-within:ring-gold">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--gold)]"
                    checked={agree}
                    onChange={(e) => setAgree(e.target.checked)}
                  />
                  {t("consentAgree")}
                </label>
              </section>
            </>
          )}
        </fieldset>
        {request.current && (
          <p role="status" className="text-xs text-muted-foreground">
            {l(
              "This request is fixed while its outcome is uncertain. Retry it unchanged, or reload saved setup to check the server.",
              "هذا الطلب ثابت ما دامت نتيجته غير مؤكدة. أعد محاولته دون تغيير، أو أعد تحميل الإعداد المحفوظ لفحص الخادم.",
            )}
          </p>
        )}
        {error && (
          <div role="alert" className="space-y-2 text-sm text-destructive">
            <p className="break-words">{error}</p>
            <Button type="button" variant="outline" disabled={busy} onClick={reload}>
              {l("Reload saved setup", "إعادة تحميل الإعداد المحفوظ")}
            </Button>
          </div>
        )}
        {busy && (
          <p role="status" className="text-sm">
            {l("Saving your setup…", "جارٍ حفظ إعدادك…")}
          </p>
        )}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            disabled={busy || !!request.current}
            onClick={() => {
              if (step === 0) setWelcome(true);
              else setStep(step - 1);
              setError("");
            }}
          >
            {t("back")}
          </Button>
          {step < 2 ? (
            <Button type="button" className="min-h-[50px] w-full sm:w-auto" onClick={next}>
              {t("next")}
            </Button>
          ) : (
            <Button
              type="submit"
              className="min-h-[50px] w-full sm:w-auto"
              disabled={busy || !agree}
            >
              {busy ? l("Saving…", "جارٍ الحفظ…") : t("finish")}
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {l(
            "Choices stay on this page when you go back. They are saved only when you finish.",
            "تبقى اختياراتك في هذه الصفحة عند العودة. لا تُحفظ إلا عند الإنهاء.",
          )}
        </p>
      </form>
    </OnboardingShell>
  );
}
