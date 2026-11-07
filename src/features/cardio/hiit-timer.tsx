import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { activityDay } from "@/lib/dates";
import { inputNumber } from "@/lib/numeric-input";
import { primeAudio, restSound } from "@/lib/device-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  intervalPlan,
  intervalPosition,
  intervalTotal,
  timerElapsed,
  type IntervalTimer,
} from "./model";
import { completeIntervalTimer, saveIntervalTimer } from "./store";
export function HiitTimer({ userId, timer }: { userId: string; timer: IntervalTimer | null }) {
  const { locale } = useI18n();
  const l = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const [form, setForm] = useState({ work: "30", rest: "30", rounds: "8", prepare: "10" });
  const [now, setNow] = useState(Date.now()),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);
  const elapsed = timer ? timerElapsed(timer, now) : 0,
    position = timer ? intervalPosition(timer.plan, elapsed) : null;
  const previousPhase = useRef("");
  const phaseKey = timer && position ? `${timer.id}:${position.round}:${position.phase}` : "";
  useEffect(() => {
    if (
      previousPhase.current &&
      phaseKey &&
      previousPhase.current !== phaseKey &&
      timer?.anchor != null &&
      !timer.saved
    )
      restSound();
    previousPhase.current = phaseKey;
  }, [phaseKey, timer?.anchor, timer?.saved]);
  async function run(action: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await action();
      setNow(Date.now());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-3 rounded-xl border p-4" aria-label="HIIT">
      <h3 className="font-semibold">HIIT · {l("Intervals", "فترات التدريب")}</h3>
      {!timer || timer.saved ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            {(
              [
                ["work", l("Work seconds", "ثواني العمل")],
                ["rest", l("Rest seconds", "ثواني الراحة")],
                ["rounds", l("Rounds", "الجولات")],
                ["prepare", l("Preparation seconds", "ثواني الاستعداد")],
              ] as const
            ).map(([key, label]) => (
              <label key={key}>
                {label}
                <Input
                  inputMode="numeric"
                  value={form[key]}
                  onChange={(e) => setForm((v) => ({ ...v, [key]: e.target.value }))}
                />
              </label>
            ))}
          </div>
          <Button
            disabled={busy}
            onClick={() => {
              void primeAudio();
              void run(async () => {
                const plan = intervalPlan.parse(
                  Object.fromEntries(
                    Object.entries(form).map(([key, value]) => [
                      key,
                      inputNumber(value, { label: key, integer: true, max: 3600 }),
                    ]),
                  ),
                );
                await saveIntervalTimer(userId, {
                  id: crypto.randomUUID(),
                  plan,
                  anchor: Date.now(),
                  elapsed: 0,
                  log_date: activityDay(),
                  saved: false,
                });
              });
            }}
          >
            {l("Start HIIT", "بدء HIIT")}
          </Button>
        </>
      ) : (
        <>
          <p className="text-sm">
            {l("Round", "الجولة")} {position!.round} / {timer.plan.rounds} ·{" "}
            {position!.phase === "work"
              ? l("Work", "عمل")
              : position!.phase === "rest"
                ? l("Rest", "راحة")
                : position!.phase === "prepare"
                  ? l("Prepare", "استعد")
                  : l("Complete", "اكتمل")}
          </p>
          <p className="text-4xl tabular-nums" aria-live="off">
            {Math.floor(position!.remaining / 60)}:
            {String(position!.remaining % 60).padStart(2, "0")}
          </p>
          <p>
            {Math.floor(elapsed)} / {intervalTotal(timer.plan)}{" "}
            {l("seconds, paused time excluded", "ثانية، دون وقت الإيقاف")}
          </p>
          <div className="flex flex-wrap gap-2">
            {position!.phase !== "done" && (
              <Button
                disabled={busy}
                onClick={() => {
                  void primeAudio();
                  void run(() =>
                    saveIntervalTimer(
                      userId,
                      {
                        ...timer,
                        elapsed: timerElapsed(timer),
                        anchor: timer.anchor == null ? Date.now() : null,
                      },
                      timer.id,
                      timer,
                    ),
                  );
                }}
              >
                {timer.anchor == null
                  ? l("Resume intervals", "متابعة الفترات")
                  : l("Pause intervals", "إيقاف الفترات مؤقتاً")}
              </Button>
            )}
            {position!.phase === "done" && (
              <Button
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await completeIntervalTimer(userId, timer);
                    restSound();
                  })
                }
              >
                {l("Save completed HIIT", "حفظ HIIT المكتمل")}
              </Button>
            )}
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => {
                if (
                  window.confirm(
                    l(
                      "Clear this interval timer? Logged cardio remains saved.",
                      "مسح هذا المؤقت؟ تبقى سجلات الكارديو محفوظة.",
                    ),
                  )
                )
                  void run(() => saveIntervalTimer(userId, null, timer.id, timer));
              }}
            >
              {l("Clear interval timer", "مسح مؤقت الفترات")}
            </Button>
          </div>
        </>
      )}
      <p className="text-xs text-muted-foreground">
        {l(
          "Timing uses stored timestamps and recovers after refresh. A locked/background browser may delay sound or display updates. Device rest-alert volume settings apply.",
          "يستخدم المؤقت أوقاتاً محفوظة ويستعيدها بعد التحديث. قد يتأخر الصوت أو العرض عند قفل الشاشة أو في الخلفية. تُطبق إعدادات صوت تنبيه الراحة.",
        )}
      </p>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
