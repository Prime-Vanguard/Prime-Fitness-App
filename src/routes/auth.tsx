import { useEffect, useRef, useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { appPath } from "@/lib/app-path";
import { LoaderCircle, MailCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BrandShell } from "@/components/brand-shell";
import { AuthNotice, PasswordField } from "@/components/auth-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n";
import { authCopy, type AuthMessage } from "@/lib/auth-copy";
import {
  authErrorMessage,
  confirmationUrl,
  hasAuthLinkError,
  safeAuthRedirect,
} from "@/lib/auth-flow";

type Mode = "signin" | "signup" | "forgot" | "confirm";
type AuthSearch = { redirect?: string | undefined; mode?: Mode | undefined };
export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>): AuthSearch => ({
    redirect: typeof s["redirect"] === "string" ? safeAuthRedirect(s["redirect"]) : undefined,
    mode: (["signup", "forgot", "confirm"].includes(String(s["mode"])) ? s["mode"] : undefined) as
      Mode | undefined,
  }),
  head: () => ({
    meta: [
      { title: "Sign in — Prime Fitness" },
      { name: "description", content: "Sign in to Prime Fitness or activate your invitation." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const search = Route.useSearch();
  const target = safeAuthRedirect(search.redirect);
  const navigate = useNavigate();
  const { locale } = useI18n();
  const c = authCopy[locale];
  const [mode, setMode] = useState<Mode>(search.mode ?? "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<AuthMessage | "">(() =>
    hasAuthLinkError(new URL(window.location.href)) ? "invalidLink" : "",
  );
  const [notice, setNotice] = useState<AuthMessage | "">("");
  const [fields, setFields] = useState<Record<string, AuthMessage>>({});
  const [deadline, setDeadline] = useState(0);
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const session = await supabase.auth.getSession();
        if (session.data.session) {
          const verified = await supabase.auth.getUser();
          if (!verified.error && verified.data.user && alive)
            await navigate({ to: target, replace: true });
        }
      } catch {
        /* A failed check must not prevent manual sign-in. */
      } finally {
        if (alive) setChecking(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [navigate, target]);
  useEffect(() => {
    const tick = () => setSeconds(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    tick();
    if (!deadline) return;
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [deadline]);
  function changeMode(next: Mode) {
    if (pending.current) return;
    setMode(next);
    setError("");
    setNotice("");
    setFields({});
    setPassword("");
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (
      pending.current ||
      checking ||
      ((mode === "forgot" || mode === "confirm") && Date.now() < deadline)
    )
      return;
    const cleanEmail = email.trim();
    const invalid: Record<string, AuthMessage> = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) invalid["email"] = "requiredEmail";
    if (mode === "signup" && !name.trim()) invalid["name"] = "requiredName";
    if ((mode === "signin" || mode === "signup") && !password)
      invalid["password"] = "requiredPassword";
    else if (mode === "signup" && password.length < 8) invalid["password"] = "tooShort";
    setFields(invalid);
    setError("");
    setNotice("");
    const first = Object.keys(invalid)[0];
    if (first) {
      document.getElementById(first)?.focus();
      return;
    }
    pending.current = true;
    setBusy(true);
    setEmail(cleanEmail);
    try {
      if (mode === "signin") {
        const r = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
        if (r.error) throw r.error;
        setPassword("");
        await navigate({ to: target, replace: true });
      } else if (mode === "signup") {
        const r = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            emailRedirectTo: confirmationUrl(window.location.origin, target),
            data: { display_name: name.trim() },
          },
        });
        if (r.error) throw r.error;
        setPassword("");
        if (r.data.session) await navigate({ to: target, replace: true });
        else {
          setMode("confirm");
          setNotice("inbox");
          setDeadline(Date.now() + 60000);
        }
      } else {
        const r =
          mode === "forgot"
            ? await supabase.auth.resetPasswordForEmail(cleanEmail, {
                redirectTo: window.location.origin + appPath("reset-password"),
              })
            : await supabase.auth.resend({
                type: "signup",
                email: cleanEmail,
                options: { emailRedirectTo: confirmationUrl(window.location.origin, target) },
              });
        if (r.error) throw r.error;
        setNotice(mode === "forgot" ? "resetSent" : "inbox");
        setDeadline(Date.now() + 60000);
      }
    } catch (e) {
      const key = authErrorMessage(e);
      setError(key);
      if (key === "rate") setDeadline(Date.now() + 60000);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  const sending = mode === "forgot" || mode === "confirm";
  const button = busy
    ? mode === "signin"
      ? c.signing
      : mode === "signup"
        ? c.creating
        : c.sending
    : mode === "signin"
      ? c.signIn
      : mode === "signup"
        ? c.create
        : mode === "forgot"
          ? c.send
          : c.resend;
  return (
    <BrandShell title={c[mode]} subtitle={c.members} focusKey={mode}>
      {checking ? (
        <p role="status" className="flex items-center gap-2 text-sm">
          <LoaderCircle
            className="size-4 animate-spin motion-reduce:animate-none"
            aria-hidden="true"
          />
          {c.checking}
        </p>
      ) : (
        <>
          <section
            aria-label={locale === "ar" ? "حالة الدخول" : "Access context"}
            className={`mb-4 rounded-lg border p-3 text-sm ${mode === "signin" ? "border-border bg-background/50" : mode === "signup" ? "border-gold/30 bg-gold/5" : mode === "forgot" ? "border-primary/30 bg-primary/5" : "border-success/30 bg-success/5"}`}
          >
            <p className="font-medium">
              {mode === "signin"
                ? locale === "ar"
                  ? "تسجيل دخول الأعضاء"
                  : "Member sign-in"
                : mode === "signup"
                  ? locale === "ar"
                    ? "دعوة من مدربك مطلوبة"
                    : "Your coach’s invitation is required"
                  : mode === "forgot"
                    ? locale === "ar"
                      ? "اطلب رابطاً آمناً من بريدك"
                      : "Request a secure email link"
                    : locale === "ar"
                      ? "تأكيد البريد قبل تسجيل الدخول"
                      : "Confirm your email before signing in"}
            </p>
            {mode === "forgot" && (
              <p className="mt-1 text-xs text-muted-foreground">
                {locale === "ar"
                  ? "استخدم بريد حسابك. ستبقى هذه الصفحة متاحة لإعادة المحاولة."
                  : "Use your account email. This page stays available for a retry."}
              </p>
            )}
          </section>
          {mode === "signup" && (
            <p className="mb-5 text-sm leading-relaxed text-muted-foreground">{c.inviteHint}</p>
          )}
          {mode === "confirm" && <MailCheck className="mb-4 size-8 text-gold" aria-hidden="true" />}
          <div className="mb-4 space-y-3">
            {error && <AuthNotice error message={c[error]} />}
            {notice && <AuthNotice message={c[notice]} />}
          </div>
          <form onSubmit={submit} noValidate aria-busy={busy} className="space-y-4">
            <fieldset disabled={busy} className="space-y-4">
              {mode === "signup" && (
                <div className="space-y-2">
                  <Label htmlFor="name">{c.name}</Label>
                  <Input
                    id="name"
                    name="name"
                    autoComplete="name"
                    maxLength={100}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="h-12"
                    aria-invalid={!!fields["name"]}
                    aria-describedby={fields["name"] ? "name-error" : undefined}
                  />
                  {fields["name"] && (
                    <p id="name-error" role="alert" className="text-sm text-destructive">
                      {c[fields["name"]]}
                    </p>
                  )}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">{c.email}</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  dir="ltr"
                  inputMode="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-12 text-start"
                  aria-invalid={!!fields["email"] || error === "credentials"}
                  aria-describedby={
                    fields["email"]
                      ? "email-error"
                      : error === "credentials"
                        ? "auth-error"
                        : undefined
                  }
                />
                {fields["email"] && (
                  <p id="email-error" role="alert" className="text-sm text-destructive">
                    {c[fields["email"]]}
                  </p>
                )}
              </div>
              {!sending && (
                <>
                  <PasswordField
                    key={mode}
                    id="password"
                    label={c.password}
                    value={password}
                    onChange={setPassword}
                    fresh={mode === "signup"}
                    invalid={!!fields["password"] || error === "credentials"}
                    errorId={fields["password"] ? "password-error" : "auth-error"}
                  />
                  {fields["password"] && (
                    <p id="password-error" role="alert" className="text-sm text-destructive">
                      {c[fields["password"]]}
                    </p>
                  )}
                </>
              )}
              <Button
                type="submit"
                className="h-12 w-full text-base"
                disabled={busy || (sending && seconds > 0)}
              >
                {busy && (
                  <LoaderCircle
                    className="size-4 animate-spin motion-reduce:animate-none"
                    aria-hidden="true"
                  />
                )}
                {button}
              </Button>
            </fieldset>
            {sending && seconds > 0 && (
              <p role="status" className="text-xs text-muted-foreground">
                {c.wait} {seconds} {c.seconds}.
              </p>
            )}
          </form>
          <div className="mt-5 flex flex-col gap-1 text-center text-sm">
            {mode === "signin" ? (
              <>
                <button
                  type="button"
                  disabled={busy}
                  className="min-h-11 rounded-md text-gold hover:underline disabled:opacity-50"
                  onClick={() => changeMode("forgot")}
                >
                  {c.forgotLink}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  className="min-h-11 rounded-md text-muted-foreground hover:text-foreground disabled:opacity-50"
                  onClick={() => changeMode("signup")}
                >
                  {c.invitationLink}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  className="min-h-11 rounded-md text-muted-foreground hover:text-foreground disabled:opacity-50"
                  onClick={() => changeMode("confirm")}
                >
                  {c.confirmationLink}
                </button>
              </>
            ) : (
              <button
                type="button"
                disabled={busy}
                className="min-h-11 rounded-md text-gold hover:underline disabled:opacity-50"
                onClick={() => changeMode("signin")}
              >
                {c.back}
              </button>
            )}
            {(mode === "confirm" || notice === "resetSent") && (
              <button
                type="button"
                disabled={busy}
                className="min-h-11 rounded-md text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setEmail("");
                  setNotice("");
                  setError("");
                  document.getElementById("email")?.focus();
                }}
              >
                {c.changeEmail}
              </button>
            )}
          </div>
        </>
      )}
    </BrandShell>
  );
}
