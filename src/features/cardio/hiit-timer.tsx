import { useEffect, useRef, useState, type ReactNode } from "react";
import { Play, Pause, CheckCircle2 } from "lucide-react";
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
import { IntervalClock } from "./interval-clock";
import { intervalTime } from "./format";

export function HiitTimer({
  userId,
  timer,
  summary,
}: {
  userId: string;
  timer: IntervalTimer | null;
  summary?: ReactNode;
}) {
  const { locale } = useI18n();
  const l = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const [form, setForm] = useState({ work: "30", rest: "30", rounds: "8", prepare: "10" });
  const [now, setNow] = useState(Date.now()),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const locked = useRef(false);
  const errorMessage = useRef<HTMLParagraphElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (error) errorMessage.current?.scrollIntoView({ block: "nearest" });
  }, [error]);
  const active = !!timer && !timer.saved;
  useEffect(() => {
    // Starting or restoring a timer reveals its relocated controls, without
    // scrolling again on each tick or pause/resume acknowledgement.
    if (active) controlsRef.current?.scrollIntoView({ block: "nearest" });
  }, [active, timer?.id]);
  useEffect(() => {
    if (timer?.anchor == null || timer.saved) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [timer?.id, timer?.anchor, timer?.saved]);
  const elapsed = active ? timerElapsed(timer, now) : 0;
  const position = active ? intervalPosition(timer.plan, elapsed) : null;
  function readPlan() {
    try {
      return intervalPlan.parse(
        Object.fromEntries(
          Object.entries(form).map(([key, value]) => [
            key,
            inputNumber(value, { label: key, integer: true, max: 3600 }),
          ]),
        ),
      );
    } catch {
      throw new Error(
        l(
          "Use 1–100 rounds, 1–3600 work seconds, 0–3600 rest seconds and 0–600 preparation seconds. Total duration must be within 24 hours.",
          "استخدم ١–١٠٠ جولة، و١–٣٦٠٠ ثانية للعمل، و٠–٣٦٠٠ ثانية للراحة، و٠–٦٠٠ ثانية للاستعداد. يجب ألا تتجاوز المدة ٢٤ ساعة.",
        ),
      );
    }
  }
  let preview = null;
  try {
    preview = readPlan();
  } catch {
    /* Partial input remains editable; validate on start. */
  }
  const plan = active ? timer.plan : preview;
  const previousPhase = useRef("");
  const phaseKey = active && position ? `${timer.id}:${position.round}:${position.phase}` : "";
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
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError("");
    try {
      await action();
      setNow(Date.now());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  // Keep pause/resume and completion ahead of read-only configuration while training.
  const controls = (
    <div ref={controlsRef} className="space-y-3" data-hiit-actions>
      {!active ? (
        <Button
          className="min-h-12 w-full font-heading text-base font-bold"
          disabled={busy}
          onClick={() => {
            void primeAudio();
            void run(async () => {
              const selected = readPlan();
              await saveIntervalTimer(userId, {
                id: crypto.randomUUID(),
                plan: selected,
                anchor: Date.now(),
                elapsed: 0,
                log_date: activityDay(),
                saved: false,
              });
            });
          }}
        >
          <Play aria-hidden className="size-5" />
          {l("Start HIIT", "بدء HIIT")}
        </Button>
      ) : position!.phase === "done" ? (
        <Button
          className="min-h-12 w-full font-heading text-base font-bold"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              await completeIntervalTimer(userId, timer);
              restSound();
            })
          }
        >
          <CheckCircle2 aria-hidden className="size-5" />
          {l("Save completed HIIT", "حفظ HIIT المكتمل")}
        </Button>
      ) : (
        <Button
          className="min-h-12 w-full font-heading text-base font-bold"
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
          {timer.anchor == null ? (
            <Play aria-hidden className="size-5" />
          ) : (
            <Pause aria-hidden className="size-5" />
          )}
          {timer.anchor == null
            ? l("Resume intervals", "متابعة الفترات")
            : l("Pause intervals", "إيقاف الفترات مؤقتاً")}
        </Button>
      )}
      {active && (
        <Button
          variant="ghost"
          className="min-h-11 w-full text-muted-foreground"
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
      )}
    </div>
  );
  return (
    <section className="space-y-4" aria-label="HIIT" data-stitch-hiit>
      <IntervalClock
        plan={plan}
        elapsed={elapsed}
        started={active}
        paused={active && timer.anchor == null && position?.phase !== "done"}
      />
      {active && controls}
      <div className="space-y-4 rounded-xl border border-border bg-card p-4">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
            {l("Interval blueprint", "مخطط الفترات")}
          </p>
          <h2 className="mt-1 font-heading text-xl font-bold">
            {l("Your interval protocol", "بروتوكول الفترات الخاص بك")}
          </h2>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-border bg-background p-3">
            <p className="text-xs uppercase text-muted-foreground">
              {l("Total duration", "المدة الإجمالية")}
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums" dir="ltr">
              {plan ? intervalTime(intervalTotal(plan)) : "—"}
            </p>
          </div>
          {(
            [
              ["rounds", l("Rounds", "الجولات")],
              ["work", l("Work seconds", "ثواني العمل")],
              ["rest", l("Rest seconds", "ثواني الراحة")],
            ] as const
          ).map(([key, label]) => (
            <label
              key={key}
              className="min-w-0 rounded-lg border border-border bg-background p-3 text-xs text-muted-foreground"
            >
              {label}
              {active ? (
                <span
                  className="mt-1 block text-xl font-semibold tabular-nums text-foreground"
                  dir="ltr"
                >
                  {key === "rounds" ? timer.plan[key] : intervalTime(timer.plan[key])}
                </span>
              ) : (
                <Input
                  className="mt-1 h-11 border-transparent bg-transparent px-0 text-xl font-semibold text-foreground tabular-nums md:text-xl"
                  dir="ltr"
                  inputMode="numeric"
                  value={form[key]}
                  disabled={busy}
                  onChange={(e) => setForm((v) => ({ ...v, [key]: e.target.value }))}
                />
              )}
            </label>
          ))}
        </div>
        <label className="flex min-h-11 items-center justify-between gap-3 text-xs text-muted-foreground">
          {l("Preparation seconds", "ثواني الاستعداد")}
          {active ? (
            <span className="font-semibold tabular-nums text-foreground" dir="ltr">
              {intervalTime(timer.plan.prepare)}
            </span>
          ) : (
            <Input
              className="h-11 w-20 bg-background text-center text-foreground"
              dir="ltr"
              inputMode="numeric"
              value={form.prepare}
              disabled={busy}
              onChange={(e) => setForm((v) => ({ ...v, prepare: e.target.value }))}
            />
          )}
        </label>
        <p className="text-xs leading-5 text-muted-foreground">
          {l(
            "Preparation is included. Rest runs between rounds, with no rest after the last round.",
            "تشمل المدة الاستعداد. تكون الراحة بين الجولات، دون راحة بعد الجولة الأخيرة.",
          )}
        </p>
      </div>
      {summary}
      {active && (
        <p className="text-xs text-muted-foreground">
          <span dir="ltr">
            {Math.floor(elapsed)} / {intervalTotal(timer.plan)}
          </span>{" "}
          {l("seconds, paused time excluded", "ثانية، دون وقت الإيقاف")}
        </p>
      )}
      {timer?.saved && (
        <p role="status" className="rounded-lg bg-card p-3 text-sm text-emerald-400">
          {l(
            "HIIT saved on this device. Sync status is shown below.",
            "تم حفظ HIIT على الجهاز. تظهر حالة المزامنة أدناه.",
          )}
        </p>
      )}
      {error && (
        <p
          ref={errorMessage}
          role="alert"
          className="rounded-lg border border-destructive/40 p-3 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      {!active && controls}
      <p className="text-center text-xs leading-5 text-muted-foreground">
        {l(
          "Timing uses stored timestamps and recovers after refresh. A locked/background browser may delay sound or display updates. Device rest-alert volume settings apply.",
          "يستخدم المؤقت أوقاتاً محفوظة ويستعيدها بعد التحديث. قد يتأخر الصوت أو العرض عند قفل الشاشة أو في الخلفية. تُطبق إعدادات صوت تنبيه الراحة.",
        )}
      </p>
    </section>
  );
}
