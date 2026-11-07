import { NativeSelect } from "@/components/ui/native-select";
import { useState, useEffect, useRef } from "react";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { restSound, primeAudio } from "@/lib/device-feedback";
import { RestAlertSettings } from "./rest-alert-settings";
import { toast } from "sonner";
import { Settings2 } from "lucide-react";
import { inputNumber } from "@/lib/numeric-input";
function useClock() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}
export function SessionTime({ started }: { started: string }) {
  const now = useClock();
  return (
    <span className="tabular-nums">
      {Math.max(0, Math.floor((now - new Date(started).getTime()) / 60000))} min
    </span>
  );
}
export function HoldTimer({ started, onToggle }: { started: number | null; onToggle: () => void }) {
  const now = useClock();
  const { locale } = useI18n();
  return (
    <Button variant="outline" className="mt-3 w-full" onClick={onToggle}>
      {started
        ? `${locale === "ar" ? "إنهاء الثبات" : "Stop hold"} · ${Math.max(0, Math.floor((now - started) / 1000))}s`
        : locale === "ar"
          ? "بدء الثبات"
          : "Start hold"}
    </Button>
  );
}
export function RestTimer({
  end,
  seconds,
  locked,
  onChange,
  onDuration,
  ready,
}: {
  end: number;
  seconds: number;
  locked: boolean;
  onChange: (end: number) => void;
  onDuration: (n: number) => Promise<void>;
  ready: boolean;
}) {
  const now = useClock(),
    done = useRef(0);
  const { locale, t } = useI18n();
  const [settings, setSettings] = useState(false),
    [custom, setCustom] = useState(String(seconds)),
    [saving, setSaving] = useState(false),
    [preferenceError, setPreferenceError] = useState("");
  const remaining = Math.max(0, Math.ceil((end - now) / 1000));
  useEffect(() => {
    if (end && now >= end && done.current !== end) {
      done.current = end;
      onChange(0);
      restSound();
      toast.success(t("restDone"));
    }
  }, [end, now, onChange, t]);
  if (locked) return null;
  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-sidebar px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:inset-x-auto md:bottom-4 md:w-[min(48rem,calc(100%-4rem))] md:rounded-xl md:border">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-2">
          <label
            className={`text-xs text-muted-foreground ${remaining > 0 ? "hidden min-[380px]:block" : ""}`}
          >
            <span className="sr-only">{locale === "ar" ? "الراحة" : "Rest"}</span>
            <NativeSelect
              value={seconds}
              disabled={!ready || saving}
              onChange={(e) => {
                void onDuration(Number(e.target.value)).catch((e: Error) =>
                  setPreferenceError(e.message),
                );
              }}
            >
              {[
                30,
                60,
                90,
                120,
                180,
                ...(![30, 60, 90, 120, 180].includes(seconds) ? [seconds] : []),
              ].map((s) => (
                <option key={s} value={s}>
                  {s}s
                </option>
              ))}
            </NativeSelect>
          </label>
          <Button
            variant="ghost"
            size="icon"
            disabled={!ready || saving}
            aria-label={locale === "ar" ? "إعداد الراحة" : "Rest settings"}
            title={locale === "ar" ? "إعداد الراحة" : "Rest settings"}
            onClick={() => {
              setCustom(String(seconds));
              setPreferenceError("");
              setSettings(true);
            }}
          >
            <Settings2 />
          </Button>
          {remaining > 0 ? (
            <>
              <strong className="text-xl tabular-nums text-gold">
                {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}
              </strong>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  aria-label={locale === "ar" ? "تقليل الراحة ١٥ ثانية" : "Shorten rest 15 seconds"}
                  onClick={() => onChange(Math.max(now, end - 15000))}
                >
                  −15
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label={locale === "ar" ? "زيادة الراحة ١٥ ثانية" : "Extend rest 15 seconds"}
                  onClick={() => onChange(end + 15000)}
                >
                  +15
                </Button>
                <Button variant="ghost" className="px-2" onClick={() => onChange(0)}>
                  {t("skip")}
                </Button>
              </div>
            </>
          ) : (
            <Button
              variant="outline"
              onClick={() => {
                primeAudio();
                onChange(Date.now() + seconds * 1000);
              }}
            >
              {locale === "ar" ? "بدء الراحة" : "Start rest"}
            </Button>
          )}
        </div>
        {preferenceError && (
          <p role="alert" className="text-xs text-destructive">
            {preferenceError}
          </p>
        )}
      </div>
      <Sheet open={settings} onOpenChange={setSettings}>
        <SheetContent side="bottom" className="rounded-t-2xl p-5">
          <div className="mx-auto max-w-lg space-y-4">
            <SheetTitle>
              {locale === "ar" ? "راحة هذا التمرين" : "Rest for this exercise slot"}
            </SheetTitle>
            <SheetDescription>
              {locale === "ar"
                ? "يُحفظ لهذا العضو وهذه الخانة. لا تتغير بقية التمارين. المدة من ١٥ إلى ٦٠٠ ثانية."
                : "Saved for this member and slot. Other exercises keep their settings. Choose 15–600 seconds."}
            </SheetDescription>
            <label className="block text-sm">
              {locale === "ar" ? "الثواني" : "Seconds"}
              <Input
                inputMode="numeric"
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
              />
            </label>
            <RestAlertSettings />
            {preferenceError && (
              <p role="alert" className="text-sm text-destructive">
                {preferenceError}
              </p>
            )}
            <Button
              disabled={saving}
              className="w-full"
              onClick={() => {
                setSaving(true);
                setPreferenceError("");
                void Promise.resolve()
                  .then(async () => {
                    const value = inputNumber(custom, {
                      label: "Rest seconds",
                      min: 15,
                      max: 600,
                      integer: true,
                    });
                    if (value == null) throw new Error("Enter rest seconds.");
                    await onDuration(value);
                    setSettings(false);
                  })
                  .catch((e: Error) => setPreferenceError(e.message))
                  .finally(() => setSaving(false));
              }}
            >
              {t("save")}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
