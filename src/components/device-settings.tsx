import { useEffect, useState } from "react";
import { Download, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/lib/i18n";
import { haptic, primeAudio, waterSound } from "@/lib/device-feedback";
import {
  currentInstallPrompt,
  rememberInstallPrompt,
  type InstallEvent,
} from "@/lib/install-prompt";

export function DeviceSettings() {
  const { locale } = useI18n();
  const l = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const [install, setInstall] = useState<InstallEvent>();
  const [installed, setInstalled] = useState(false);
  const [sound, setSound] = useState(false);
  const [vibration, setVibration] = useState(true);
  const [supported, setSupported] = useState(false);
  useEffect(() => {
    setInstalled(
      matchMedia("(display-mode: standalone)").matches ||
        !!(navigator as Navigator & { standalone?: boolean }).standalone,
    );
    setSound(localStorage.getItem("pf-water-sound") === "on");
    setVibration(localStorage.getItem("pf-haptics") !== "off");
    setSupported(typeof navigator.vibrate === "function");
    setInstall(currentInstallPrompt());
    const prompt = () => setInstall(currentInstallPrompt());
    const done = () => {
      setInstalled(true);
      setInstall(undefined);
    };
    window.addEventListener("pf-install-prompt", prompt);
    window.addEventListener("appinstalled", done);
    return () => {
      window.removeEventListener("pf-install-prompt", prompt);
      window.removeEventListener("appinstalled", done);
    };
  }, []);
  return (
    <section className="mt-6 space-y-4 rounded-xl border border-gold/30 bg-card p-5">
      <h2 className="flex items-center gap-2 font-semibold">
        <Smartphone size={20} className="text-gold" />
        {l("App & gym experience", "تجربة التطبيق والنادي")}
      </h2>
      {installed ? (
        <p className="text-sm text-success">
          {l("Running as an installed app", "يعمل كتطبيق مثبت")}
        </p>
      ) : install ? (
        <Button
          onClick={() => {
            void install
              .prompt()
              .then(() => install.userChoice)
              .then(() => rememberInstallPrompt(undefined))
              .catch(console.error);
          }}
        >
          <Download size={16} />
          {l("Install Prime Fitness", "تثبيت برايم فيتنس")}
        </Button>
      ) : (
        <p className="text-sm text-muted-foreground">
          {l(
            "On iPhone/iPad: Safari → Share → Add to Home Screen. On Android: browser menu → Install app or Add to Home Screen. Installation requires HTTPS (or localhost while developing).",
            "على آيفون وآيباد: سفاري ← مشاركة ← إضافة إلى الشاشة الرئيسية. على أندرويد: قائمة المتصفح ← تثبيت التطبيق أو إضافة للشاشة الرئيسية. يتطلب التثبيت اتصال HTTPS.",
          )}
        </p>
      )}
      <label className="flex items-center justify-between gap-3 text-sm">
        {l("Water logging sound", "صوت تسجيل الماء")}
        <Switch
          checked={sound}
          onCheckedChange={(value) => {
            localStorage.setItem("pf-water-sound", value ? "on" : "off");
            setSound(value);
            if (value) {
              primeAudio();
              waterSound();
            }
          }}
        />
      </label>
      <label className="flex items-center justify-between gap-3 text-sm">
        {l("Haptic feedback", "الاهتزاز اللمسي")}
        <Switch
          checked={vibration}
          disabled={!supported}
          onCheckedChange={(value) => {
            localStorage.setItem("pf-haptics", value ? "on" : "off");
            setVibration(value);
            if (value) haptic();
          }}
        />
      </label>
      <p className="text-xs text-muted-foreground">
        {l(
          "Sound is off by default. Haptics require browser support and respect reduced motion. Open training once online before using it offline; unsynced workouts remain on this device until accepted by the server.",
          "الصوت معطل افتراضياً. الاهتزاز حسب دعم المتصفح ويحترم تقليل الحركة. افتح التدريب مرة أثناء الاتصال لاستخدامه دون اتصال؛ تبقى التمارين غير المتزامنة على هذا الجهاز حتى يقبلها الخادم.",
        )}
      </p>
    </section>
  );
}
