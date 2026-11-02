import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { CheckCircle2, LoaderCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BrandShell } from "@/components/brand-shell";
import { AuthNotice, PasswordField } from "@/components/auth-fields";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { authCopy, type AuthMessage } from "@/lib/auth-copy";
import { authErrorMessage, hasAuthLinkError, clearRecovery, recoveryExpiry } from "@/lib/auth-flow";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Reset password — Prime Fitness" },
      { name: "description", content: "Choose a new password for your Prime Fitness account." },
    ],
  }),
  component: ResetPassword,
});
function ResetPassword() {
  const { locale } = useI18n();
  const c = authCopy[locale];
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const completed = useRef(false);
  const grantUntil = useRef(0);
  const [status, setStatus] = useState<"checking" | "ready" | "invalid" | "network" | "done">(
    "checking",
  );
  const [error, setError] = useState<AuthMessage | "">("");
  const [initial] = useState(() => {
    const url = new URL(window.location.href);
    return {
      invalid: hasAuthLinkError(url),
    };
  });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    let generation = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];
    let expires: ReturnType<typeof setTimeout> | undefined;
    async function verify() {
      const revision = ++generation;
      if (completed.current) return;
      try {
        const session = await supabase.auth.getSession();
        if (!alive || revision !== generation || completed.current) return;
        if (session.error) {
          const retry =
            session.error.status === 0 ||
            session.error.status === 429 ||
            (session.error.status ?? 0) >= 500;
          setError(authErrorMessage(session.error));
          setStatus(retry ? "network" : "invalid");
          return;
        }
        if (initial.invalid || !session.data.session) {
          setStatus("invalid");
          return;
        }
        const user = session.data.session.user;
        const until = recoveryExpiry(user.id);
        if (!until) {
          setStatus("invalid");
          return;
        }
        const verified = await supabase.auth.getUser();
        if (!alive || revision !== generation || completed.current) return;
        if (verified.error) {
          const retry =
            verified.error.status === 0 ||
            verified.error.status === 429 ||
            (verified.error.status ?? 0) >= 500;
          setError(authErrorMessage(verified.error));
          setStatus(retry ? "network" : "invalid");
          return;
        }
        if (!verified.data.user || verified.data.user.id !== user.id) {
          setStatus("invalid");
          return;
        }
        setError("");
        grantUntil.current = until;
        setStatus("ready");
        clearTimeout(expires);
        expires = setTimeout(
          () => {
            if (alive && !completed.current) {
              setStatus("invalid");
              setPassword("");
              setRepeat("");
            }
          },
          Math.max(0, until - Date.now()),
        );
      } catch {
        if (alive) setStatus("network");
      }
    }
    // Schedule outside the SDK callback: auth methods may hold its session lock.
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        timers.push(setTimeout(() => void verify(), 0));
      }
      if (event === "SIGNED_OUT") {
        generation++;
        setStatus("invalid");
        setPassword("");
        setRepeat("");
        clearRecovery();
      }
    });
    void verify();
    return () => {
      alive = false;
      data.subscription.unsubscribe();
      timers.forEach(clearTimeout);
      clearTimeout(expires);
    };
  }, [initial, attempt]);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (pending.current || status !== "ready") return;
    if (Date.now() >= grantUntil.current) {
      setStatus("invalid");
      return;
    }
    setError("");
    if (password.length < 8) {
      setError("tooShort");
      document.getElementById("new-password")?.focus();
      return;
    }
    if (password !== repeat) {
      setError("mismatch");
      document.getElementById("confirm-password")?.focus();
      return;
    }
    pending.current = true;
    setBusy(true);
    try {
      const r = await supabase.auth.updateUser({ password });
      if (r.error) throw r.error;
      completed.current = true;
      clearRecovery();
      setPassword("");
      setRepeat("");
      setStatus("done");
    } catch (e) {
      const key = authErrorMessage(e);
      setError(key);
      if (key === "invalidLink") setStatus("invalid");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <BrandShell title={status === "done" ? c.done : c.forgot} subtitle={c.members}>
      {status === "checking" && (
        <p role="status" className="flex items-center gap-2 text-sm">
          <LoaderCircle
            className="size-4 animate-spin motion-reduce:animate-none"
            aria-hidden="true"
          />
          {c.checkingLink}
        </p>
      )}
      {(status === "invalid" || status === "network") && (
        <div className="space-y-4">
          <AuthNotice
            error
            message={status === "invalid" ? c.invalidLink : c[error || "network"]}
          />
          <p className="text-sm text-muted-foreground">{c.recoveryHint}</p>
          {status === "network" && (
            <Button
              className="h-12 w-full"
              onClick={() => {
                setStatus("checking");
                setAttempt((v) => v + 1);
              }}
            >
              {c.retry}
            </Button>
          )}
          <Button asChild className="h-12 w-full">
            <Link to="/auth" search={{ mode: "forgot", redirect: "/today" }}>
              {c.requestNew}
            </Link>
          </Button>
        </div>
      )}
      {status === "ready" && (
        <form onSubmit={submit} noValidate aria-busy={busy} className="space-y-4">
          {error && <AuthNotice error message={c[error]} />}
          <fieldset disabled={busy} className="space-y-4">
            <PasswordField
              id="new-password"
              label={c.newPassword}
              value={password}
              onChange={setPassword}
              fresh
              invalid={error === "tooShort" || error === "weak"}
              errorId="auth-error"
            />
            <PasswordField
              id="confirm-password"
              label={c.repeat}
              value={repeat}
              onChange={setRepeat}
              fresh
              invalid={error === "mismatch"}
              errorId="auth-error"
            />
            <Button type="submit" className="h-12 w-full" disabled={busy}>
              {busy && (
                <LoaderCircle
                  className="size-4 animate-spin motion-reduce:animate-none"
                  aria-hidden="true"
                />
              )}
              {busy ? c.saving : c.save}
            </Button>
          </fieldset>
        </form>
      )}
      {status === "done" && (
        <div className="space-y-5">
          <CheckCircle2 className="size-9 text-gold" aria-hidden="true" />
          <AuthNotice message={c.doneHint} />
          <Button asChild className="h-12 w-full">
            <Link to="/today">{c.continue}</Link>
          </Button>
        </div>
      )}
    </BrandShell>
  );
}
