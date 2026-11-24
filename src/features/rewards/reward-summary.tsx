import { useEffect, useRef, useState } from "react";
import { numberLocale } from "@/lib/i18n";
import { RollingNumber } from "@/components/rolling-number";
import { celebrationLevel } from "@/lib/celebrate";
import { Wallet } from "lucide-react";
import { RankCrest } from "@/components/rank-crest";
import { useI18n } from "@/lib/i18n";
import type { RANKS } from "@/lib/levels";

export function RewardSummary({
  data,
  compact = false,
}: {
  compact?: boolean;
  data:
    | {
        level: number;
        xp: number;
        cur: number;
        next: number | null;
        pct: number;
        pv: number;
        provisional: boolean;
        rank: { key: (typeof RANKS)[number]["key"]; ar: string };
      }
    | undefined;
}) {
  const { t, locale } = useI18n();
  const l = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const n = (value: number) => value.toLocaleString(numberLocale(locale));
  // Confirmed XP that arrives while this is on screen rises into the crest as "+XP".
  const [gain, setGain] = useState({ amount: 0, key: 0 });
  const lastXp = useRef<number | null>(null);
  const xp = data?.xp;
  useEffect(() => {
    if (xp == null) return;
    const before = lastXp.current;
    lastXp.current = xp;
    if (!compact && before != null && xp > before && celebrationLevel() !== "off")
      setGain((g) => ({ amount: xp - before, key: g.key + 1 }));
  }, [xp, compact]);
  useEffect(() => {
    if (compact) setGain((g) => (g.amount ? { ...g, amount: 0 } : g));
  }, [compact]);
  if (compact)
    return (
      <section
        className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-card p-3"
        data-stitch-reward-summary
      >
        <p className="text-sm">
          <span className="text-muted-foreground">{t("level")}</span> {data?.level ?? "—"} ·{" "}
          <bdi>{data ? <RollingNumber value={data.xp} format={n} /> : "—"} XP</bdi>
        </p>
        <p className="flex items-center gap-2 text-sm">
          <Wallet aria-hidden className="size-4 text-muted-foreground" />
          {t("pvWallet")}:{" "}
          <strong className="text-gold">
            <bdi>{data ? <RollingNumber value={data.pv} format={n} /> : "—"} PV</bdi>
          </strong>
        </p>
        {!data && (
          <p className="w-full text-xs text-muted-foreground">
            {l("Progress unavailable", "التقدم غير متاح")}
          </p>
        )}
      </section>
    );
  return (
    <section className="mt-4 rounded-xl bg-card p-4 sm:p-5" data-stitch-reward-summary>
      <div className="flex items-center gap-4">
        <div className="relative shrink-0">
          <div key={gain.key} className={gain.key ? "crest-pulse rounded-full" : undefined}>
            <RankCrest rank={data?.rank.key ?? "Recruit"} size={72} />
          </div>
          {gain.amount > 0 && (
            <span
              key={gain.key}
              role="status"
              className="xp-chip absolute inset-x-0 top-1/2 mx-auto w-max rounded-full bg-gold px-2 py-0.5 text-xs font-bold text-gold-foreground"
              onAnimationEnd={() => setGain((g) => ({ ...g, amount: 0 }))}
            >
              <bdi>+{n(gain.amount)} XP</bdi>
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted-foreground">
            {l("Your Vanguard rank", "رتبتك في فانغارد")}
          </p>
          <h2 className="mt-1 font-heading text-lg font-bold">
            {data ? (locale === "ar" ? data.rank.ar : data.rank.key) : "—"} · {t("level")}{" "}
            {data?.level ?? "—"}
          </h2>
          <p className="text-xs text-muted-foreground">
            <bdi className="tabular-nums">
              {data ? <RollingNumber value={data.xp} format={n} /> : "—"} XP
            </bdi>{" "}
            {l("total", "إجمالي")}
          </p>
          <div
            className="mt-3 h-2 overflow-hidden rounded-full bg-background"
            role="progressbar"
            aria-label={l("Progress to next level", "التقدم للمستوى التالي")}
            aria-valuenow={Math.round((data?.pct ?? 0) * 100)}
          >
            <div
              className="h-full rounded-full bg-gold transition-[width] duration-300 ease-out motion-reduce:transition-none"
              style={{ width: `${Math.round((data?.pct ?? 0) * 100)}%` }}
            />
          </div>
          <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
            {/* Progress inside this level, so an empty bar still reads correctly. */}
            <bdi className="tabular-nums">
              {data
                ? data.next == null
                  ? `${n(data.xp)} XP`
                  : `${n(data.xp - data.cur)} / ${n(data.next - data.cur)} XP`
                : "— XP"}
            </bdi>
            <span>
              {!data
                ? l("Progress unavailable", "التقدم غير متاح")
                : data.next == null
                  ? t("maxLevel")
                  : `${(data.next - data.xp).toLocaleString(numberLocale(locale))} ${t("toNext")}`}
            </span>
          </div>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-background p-3">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Wallet aria-hidden className="size-4" />
          {t("pvWallet")}
        </p>
        <p className="font-heading text-xl font-bold tabular-nums text-gold">
          <bdi>{data ? <RollingNumber value={data.pv} format={n} /> : "—"} PV</bdi>
        </p>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        {l("XP = your level. PV = points to spend.", "XP = مستواك. PV = نقاط تنفقها.")}
      </p>
      {data?.provisional && (
        <p className="mt-2 text-xs text-muted-foreground">{t("provisional")}</p>
      )}
    </section>
  );
}
