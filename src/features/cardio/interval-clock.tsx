import { useI18n } from "@/lib/i18n";
import { intervalPosition, type IntervalPlan } from "./model";
import { intervalTime } from "./format";

/** Display only: the durable timer owns elapsed time and all state changes. */
export function IntervalClock({
  plan,
  elapsed,
  started,
  paused,
}: {
  plan: IntervalPlan | null;
  elapsed: number;
  started: boolean;
  paused: boolean;
}) {
  const { locale } = useI18n();
  const l = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const position = plan ? intervalPosition(plan, elapsed) : null;
  const phase = started ? position?.phase : "ready";
  const remaining = started ? position?.remaining : plan?.work;
  const duration =
    plan && position
      ? position.phase === "prepare"
        ? plan.prepare
        : position.phase === "work"
          ? plan.work
          : plan.rest
      : 0;
  const fraction = started && duration > 0 ? Math.min(1, (remaining ?? 0) / duration) : 0;
  const label =
    phase === "work"
      ? l("Work interval", "فترة العمل")
      : phase === "rest"
        ? l("Rest interval", "فترة الراحة")
        : phase === "prepare"
          ? l("Preparation", "الاستعداد")
          : phase === "done"
            ? l("Protocol complete", "اكتمل البروتوكول")
            : l("Ready to start", "جاهز للبدء");
  const next =
    plan && position && (phase === "prepare" || phase === "rest")
      ? `${intervalTime(plan.work)} ${l("work", "عمل")}`
      : plan && phase === "work" && position!.round < plan.rounds
        ? plan.rest > 0
          ? `${intervalTime(plan.rest)} ${l("rest", "راحة")}`
          : `${intervalTime(plan.work)} ${l("work", "عمل")}`
        : null;
  return (
    <div className="rounded-xl border border-border bg-card p-4 text-center" data-interval-clock>
      <div className="relative mx-auto flex size-52 items-center justify-center">
        <svg
          viewBox="0 0 160 160"
          className="absolute inset-0 size-full -rotate-90"
          aria-hidden="true"
        >
          <circle
            cx="80"
            cy="80"
            r="70"
            fill="none"
            strokeWidth="8"
            strokeDasharray="6 3"
            className="stroke-border"
          />
          <circle
            cx="80"
            cy="80"
            r="70"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            strokeDasharray="440"
            strokeDashoffset={440 * (1 - (phase === "done" ? 1 : fraction))}
            strokeLinecap="round"
            className={phase === "work" || phase === "done" ? "text-emerald-400" : "text-gold"}
          />
        </svg>
        <div className="relative">
          <p
            className="font-heading text-4xl font-extrabold tabular-nums"
            dir="ltr"
            aria-live="off"
          >
            {remaining == null ? "—:—" : intervalTime(remaining)}
          </p>
          <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
            {l("Minutes : seconds", "دقائق : ثوانٍ")}
          </p>
        </div>
      </div>
      <p
        role="status"
        className={
          "mt-3 text-xs font-bold uppercase tracking-wide " +
          (phase === "work" || phase === "done" ? "text-emerald-400" : "text-gold")
        }
      >
        {label}
        {started && plan && position
          ? ` · ${l("Round", "الجولة")} ${position.round} / ${plan.rounds}`
          : ""}
        {paused ? ` · ${l("Paused", "متوقف مؤقتاً")}` : ""}
      </p>
      <p className="mt-1 min-h-5 text-xs text-muted-foreground">
        {next
          ? `${l("Next", "التالي")}: ${next}`
          : started
            ? l("Your interval plan is shown below", "خطة الفترات موضحة أدناه")
            : l("Preview · the timer has not started", "معاينة · لم يبدأ المؤقت")}
      </p>
    </div>
  );
}
