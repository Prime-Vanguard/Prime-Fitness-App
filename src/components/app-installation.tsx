import { useEffect, useRef, useState } from "react";
import { Download, Smartphone } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import {
  currentInstallPrompt,
  rememberInstallPrompt,
  type InstallEvent,
} from "@/lib/install-prompt";
import { Button } from "./ui/button";

/** Installation is optional. A prompt acceptance is not proof of installation. */
export function AppInstallation() {
  const { locale } = useI18n();
  const l = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const [prompt, setPrompt] = useState<InstallEvent>();
  const [installed, setInstalled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<"" | "accepted" | "dismissed" | "failed">("");
  const lock = useRef(false);
  useEffect(() => {
    const display = matchMedia("(display-mode: standalone)");
    const refresh = () => {
      setInstalled(
        display.matches || !!(navigator as Navigator & { standalone?: boolean }).standalone,
      );
      setPrompt(currentInstallPrompt());
    };
    const done = () => {
      rememberInstallPrompt(undefined);
      // Clearing the shared prompt emits a refresh synchronously; apply the
      // confirmed installation after that notification, not before it.
      setInstalled(true);
      setResult("");
    };
    refresh();
    window.addEventListener("pf-install-prompt", refresh);
    window.addEventListener("appinstalled", done);
    display.addEventListener("change", refresh);
    return () => {
      window.removeEventListener("pf-install-prompt", refresh);
      window.removeEventListener("appinstalled", done);
      display.removeEventListener("change", refresh);
    };
  }, []);
  async function install() {
    if (!prompt || lock.current) return;
    lock.current = true;
    setBusy(true);
    setResult("");
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome !== "accepted" && choice.outcome !== "dismissed")
        throw new Error("Unexpected install outcome");
      setResult(choice.outcome);
      rememberInstallPrompt(undefined);
    } catch {
      setResult("failed");
      rememberInstallPrompt(undefined);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <section
      className="space-y-4 rounded-xl border border-border bg-card p-4 sm:p-5"
      aria-label={l("App installation", "تثبيت التطبيق")}
    >
      <div className="flex items-center gap-3">
        <span className="rounded-lg bg-background p-3 text-gold">
          <Smartphone aria-hidden className="size-5" />
        </span>
        <h2 className="font-heading text-lg font-semibold">
          {l("Add to Home Screen", "الإضافة إلى الشاشة الرئيسية")}
        </h2>
      </div>
      {installed ? (
        <p role="status" className="text-sm text-success">
          {l("Running as an installed app", "يعمل كتطبيق مثبت")}
        </p>
      ) : (
        <>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {l(
              "Open Prime Fitness directly from your home screen. Installation is optional.",
              "افتح برايم فيتنس مباشرة من الشاشة الرئيسية. التثبيت اختياري.",
            )}
          </p>
          {prompt && (
            <Button disabled={busy} className="min-h-12 w-full" onClick={() => void install()}>
              <Download aria-hidden className="size-4" />
              {busy
                ? l("Opening install prompt…", "جارٍ فتح نافذة التثبيت…")
                : l("Install Prime Fitness", "تثبيت برايم فيتنس")}
            </Button>
          )}
          {result && (
            <p role={result === "failed" ? "alert" : "status"} className="text-sm">
              {result === "accepted"
                ? l(
                    "Installation requested. Complete your browser's installation steps.",
                    "تم طلب التثبيت. أكمل خطوات التثبيت في المتصفح.",
                  )
                : result === "dismissed"
                  ? l(
                      "Installation skipped. You can keep using the browser.",
                      "تم تخطي التثبيت. يمكنك متابعة استخدام المتصفح.",
                    )
                  : l(
                      "The install prompt could not open. Use the browser menu instructions below.",
                      "تعذر فتح نافذة التثبيت. استخدم إرشادات قائمة المتصفح أدناه.",
                    )}
            </p>
          )}
          {!prompt && (
            <p className="rounded-lg bg-background p-3 text-sm leading-relaxed text-muted-foreground">
              {l(
                "On iPhone/iPad: Safari → Share → Add to Home Screen. On Android: browser menu → Install app or Add to Home Screen. Installation requires HTTPS (or localhost while developing).",
                "على آيفون وآيباد: سفاري ← مشاركة ← إضافة إلى الشاشة الرئيسية. على أندرويد: قائمة المتصفح ← تثبيت التطبيق أو إضافة للشاشة الرئيسية. يتطلب التثبيت اتصال HTTPS.",
              )}
            </p>
          )}
        </>
      )}
      <p className="text-xs leading-relaxed text-muted-foreground">
        {l(
          "Open training online before using it offline. Pending workout changes stay on this device until accepted by the server.",
          "افتح التدريب أثناء الاتصال قبل استخدامه دون اتصال. تبقى تغييرات التمرين المعلقة على هذا الجهاز حتى يقبلها الخادم.",
        )}
      </p>
    </section>
  );
}
