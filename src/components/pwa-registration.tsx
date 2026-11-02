import { useEffect } from "react";
import { rememberInstallPrompt, type InstallEvent } from "@/lib/install-prompt";
export function PwaRegistration() {
  useEffect(() => {
    const prompt = (event: Event) => {
      event.preventDefault();
      rememberInstallPrompt(event as InstallEvent);
    };
    window.addEventListener("beforeinstallprompt", prompt);
    if (import.meta.env.PROD && "serviceWorker" in navigator) {
      void navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .catch(console.error);
    }
    return () => window.removeEventListener("beforeinstallprompt", prompt);
  }, []);
  return null;
}
