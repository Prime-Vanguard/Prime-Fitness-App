import { useEffect, useState } from "react";
import { appPath } from "@/lib/app-path";
import { rememberInstallPrompt, type InstallEvent } from "@/lib/install-prompt";
import { useI18n } from "@/lib/i18n";
import { Button } from "./ui/button";

export function PwaRegistration() {
  const { locale } = useI18n();
  const [updateReady, setUpdateReady] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    let disposed = false;
    let registration: ServiceWorkerRegistration | undefined;
    let installing: ServiceWorker | null = null;
    const prompt = (event: Event) => {
      event.preventDefault();
      rememberInstallPrompt(event as InstallEvent);
    };
    const checkWaiting = () => {
      if (!disposed)
        setUpdateReady(
          !!navigator.serviceWorker.controller &&
            (!!registration?.waiting || installing?.state === "installed"),
        );
    };
    const observeInstall = () => {
      installing?.removeEventListener("statechange", checkWaiting);
      installing = registration?.installing ?? null;
      installing?.addEventListener("statechange", checkWaiting);
      checkWaiting();
    };
    window.addEventListener("beforeinstallprompt", prompt);
    if (import.meta.env.PROD && "serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("controllerchange", checkWaiting);
      void navigator.serviceWorker
        .register(appPath("sw.js"), { scope: appPath(""), updateViaCache: "none" })
        .then((registered) => {
          if (disposed) return;
          registration = registered;
          registration.addEventListener("updatefound", observeInstall);
          observeInstall();
        })
        .catch(console.error);
    }
    return () => {
      disposed = true;
      window.removeEventListener("beforeinstallprompt", prompt);
      navigator.serviceWorker?.removeEventListener("controllerchange", checkWaiting);
      registration?.removeEventListener("updatefound", observeInstall);
      installing?.removeEventListener("statechange", checkWaiting);
    };
  }, []);
  if (!updateReady || dismissed) return null;
  const arabic = locale === "ar";
  return (
    <aside className="fixed inset-x-3 top-20 z-40 mx-auto flex max-w-lg items-start gap-2 rounded-xl border border-border bg-card p-3 shadow-lg">
      <p className="grow text-sm" role="status">
        <strong>{arabic ? "تحديث التطبيق جاهز." : "App update ready."}</strong>{" "}
        {arabic
          ? "احفظ أي تعديلات مفتوحة، ثم أغلق كل نوافذ برايم فتنس وأعد فتح التطبيق."
          : "Save any open forms, then close all Prime Fitness windows and reopen the app."}
      </p>
      <Button variant="ghost" size="sm" onClick={() => setDismissed(true)}>
        {arabic ? "إخفاء" : "Dismiss"}
      </Button>
    </aside>
  );
}
