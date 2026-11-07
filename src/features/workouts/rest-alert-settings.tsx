import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import {
  readRestPreferences,
  saveRestPreferences,
  type RestPreferences,
} from "@/lib/rest-preferences";
import { primeAudio, restSound } from "@/lib/device-feedback";
import { Button } from "@/components/ui/button";
export function RestAlertSettings() {
  const { locale } = useI18n();
  const l = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const [value, setValue] = useState(readRestPreferences);
  const [error, setError] = useState("");
  function update(patch: Partial<RestPreferences>) {
    try {
      const next = { ...value, ...patch };
      saveRestPreferences(next);
      setValue(next);
      setError("");
    } catch {
      setError(l("Device settings could not be saved.", "تعذر حفظ إعدادات الجهاز."));
    }
  }
  return (
    <fieldset className="space-y-3 rounded-xl border p-3">
      <legend>{l("Rest completion alert", "تنبيه انتهاء الراحة")}</legend>
      <label className="block">
        {l("Alert volume", "مستوى التنبيه")} {Math.round(value.volume * 100)}%
        <input
          className="block min-h-11 w-full"
          type="range"
          min="0"
          max="100"
          value={Math.round(value.volume * 100)}
          onChange={(e) => update({ volume: Number(e.target.value) / 100 })}
        />
      </label>
      <label className="flex min-h-11 items-center gap-2">
        <input
          type="checkbox"
          checked={value.muted}
          onChange={(e) => update({ muted: e.target.checked })}
        />
        {l("Mute rest sound", "كتم صوت الراحة")}
      </label>
      <label className="flex min-h-11 items-center gap-2">
        <input
          type="checkbox"
          checked={value.vibration}
          onChange={(e) => update({ vibration: e.target.checked })}
        />
        {l("Vibrate if supported", "اهتزاز إذا كان مدعوماً")}
      </label>
      <Button
        variant="outline"
        onClick={() => {
          void primeAudio().then(restSound);
        }}
      >
        {l("Preview alert", "معاينة التنبيه")}
      </Button>
      <p className="text-xs text-muted-foreground">
        {l(
          "Your device volume also applies. Browsers may pause audio when locked or in the background; keep the app open for reliable alerts.",
          "يُطبق مستوى صوت الجهاز أيضاً. قد يتوقف الصوت عند قفل الشاشة أو في الخلفية؛ أبقِ التطبيق مفتوحاً للتنبيه.",
        )}
      </p>
      {error && <p role="alert">{error}</p>}
    </fieldset>
  );
}
