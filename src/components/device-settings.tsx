import { useEffect, useState } from "react";
import { Smartphone } from "lucide-react";
import { AppInstallation } from "./app-installation";
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/lib/i18n";
import { celebrationSound, haptic, primeAudio, waterSound } from "@/lib/device-feedback";
import { NativeSelect } from "@/components/ui/native-select";
import { setCelebrationLevel, useCelebration, type CelebrationLevel } from "@/lib/celebrate";
import { OfflinePreparationPanel } from "./offline-preparation-panel";
import { StaffOfflineDownloads } from "./staff-offline-downloads";
import { OfflineNutritionTargets } from "./offline-nutrition-targets";

// Keep the existing durable operations; this surface groups their review and recovery states.
export function DeviceSettings({
  memberId,
  showStaffDownloads,
}: {
  memberId: string;
  showStaffDownloads: boolean;
}) {
  const { locale } = useI18n();
  const l = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const [sound, setSound] = useState(false);
  const [vibration, setVibration] = useState(true);
  const [supported, setSupported] = useState(false);
  const [fanfare, setFanfare] = useState(false);
  const { level: celebrations } = useCelebration();
  useEffect(() => {
    setSound(localStorage.getItem("pf-water-sound") === "on");
    setVibration(localStorage.getItem("pf-haptics") !== "off");
    setSupported(typeof navigator.vibrate === "function");
    setFanfare(localStorage.getItem("pf-celebration-sound") === "on");
  }, []);
  return (
    <section className="mt-0 space-y-4 rounded-xl bg-card p-4 sm:p-5">
      <h2 className="flex items-center gap-2 font-semibold">
        <Smartphone size={20} className="text-gold" />
        {l("App & gym experience", "تجربة التطبيق والنادي")}
      </h2>
      <AppInstallation />
      <OfflinePreparationPanel key={memberId} memberId={memberId} />
      <StaffOfflineDownloads key={memberId} actor={memberId} showEmpty={showStaffDownloads} />
      <OfflineNutritionTargets actor={memberId} />
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
        {l("Celebrations", "الاحتفالات")}
        <NativeSelect
          className="w-auto"
          value={celebrations}
          onChange={(e) => setCelebrationLevel(e.target.value as CelebrationLevel)}
        >
          <option value="full">{l("Full", "كاملة")}</option>
          <option value="subtle">{l("Subtle", "خفيفة")}</option>
          <option value="off">{l("Off", "متوقفة")}</option>
        </NativeSelect>
      </label>
      <label className="flex items-center justify-between gap-3 text-sm">
        {l("Celebration sound", "صوت الاحتفالات")}
        <Switch
          checked={fanfare}
          onCheckedChange={(value) => {
            localStorage.setItem("pf-celebration-sound", value ? "on" : "off");
            setFanfare(value);
            if (value) void primeAudio().then(() => celebrationSound("chime"));
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
          "Celebrations play for confirmed progress only; Subtle swaps motion for a fade. Sound is off by default. Haptics require browser support and respect reduced motion. Open training once online before using it offline; unsynced workouts remain on this device until accepted by the server.",
          "تظهر الاحتفالات للتقدم المؤكد فقط؛ الخفيفة تستبدل الحركة بظهور تدريجي. الصوت معطل افتراضياً. الاهتزاز حسب دعم المتصفح ويحترم تقليل الحركة. افتح التدريب مرة أثناء الاتصال لاستخدامه دون اتصال؛ تبقى التمارين غير المتزامنة على هذا الجهاز حتى يقبلها الخادم.",
        )}
      </p>
    </section>
  );
}
