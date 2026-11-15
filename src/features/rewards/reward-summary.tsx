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
  if (compact)
    return (
      <section
        className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-card p-3"
        data-stitch-reward-summary
      >
        <p className="text-sm">
          <span className="text-muted-foreground">{t("level")}</span> {data?.level ?? "—"} ·{" "}
          <bdi>{data?.xp.toLocaleString(locale) ?? "—"} XP</bdi>
        </p>
        <p className="flex items-center gap-2 text-sm">
          <Wallet aria-hidden className="size-4 text-muted-foreground" />
          {t("pvWallet")}:{" "}
          <strong className="text-gold">
            <bdi>{data?.pv.toLocaleString(locale) ?? "—"} PV</bdi>
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
        <RankCrest rank={data?.rank.key ?? "Recruit"} size={72} />
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            {l("Your Vanguard rank", "رتبتك في فانغارد")}
          </p>
          <h2 className="mt-1 font-heading text-lg font-bold">
            {data ? (locale === "ar" ? data.rank.ar : data.rank.key) : "—"} · {t("level")}{" "}
            {data?.level ?? "—"}
          </h2>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-background">
            <div
              className="h-full rounded-full bg-gold"
              style={{ width: `${Math.round((data?.pct ?? 0) * 100)}%` }}
            />
          </div>
          <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
            <bdi className="tabular-nums">{data?.xp.toLocaleString(locale) ?? "—"} XP</bdi>
            <span>
              {!data
                ? l("Progress unavailable", "التقدم غير متاح")
                : data.next == null
                  ? t("maxLevel")
                  : `${(data.next - data.xp).toLocaleString(locale)} ${t("toNext")}`}
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
          <bdi>{data?.pv.toLocaleString(locale) ?? "—"} PV</bdi>
        </p>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        {l(
          "XP builds your rank. Spend PV on rewards without reducing your level. There is no automatic conversion.",
          "يبني XP رتبتك. أنفق نقاط PV على المكافآت دون خفض مستواك. لا يوجد تحويل تلقائي بينهما.",
        )}
      </p>
      {data?.provisional && (
        <p className="mt-2 text-xs text-muted-foreground">{t("provisional")}</p>
      )}
    </section>
  );
}
