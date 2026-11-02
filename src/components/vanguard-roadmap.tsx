import { useState } from "react";
import { Lock, Map } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { RANKS, rankFor } from "@/lib/levels";
import { RankCrest } from "@/components/rank-crest";
import { useI18n } from "@/lib/i18n";

export function VanguardRoadmap({
  level,
  xp,
  displayName,
  avatarPath,
}: {
  level: number;
  xp: number;
  displayName: string;
  avatarPath: string | null | undefined;
}) {
  const { locale, t } = useI18n();
  const l = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const [selected, setSelected] = useState(level);
  const rank = rankFor(selected);
  const { data: avatar } = useQuery({
    queryKey: ["avatar", avatarPath],
    enabled: !!avatarPath,
    staleTime: 3000000,
    queryFn: async () => {
      const r = await supabase.storage.from("progress-photos").createSignedUrl(avatarPath!, 3600);
      if (r.error) throw r.error;
      return r.data.signedUrl;
    },
  });
  const { data: thresholds } = useQuery({
    queryKey: ["roadmap-thresholds"],
    queryFn: async () => {
      const r = await supabase
        .from("level_thresholds")
        .select("level,xp_required,provisional")
        .order("level");
      if (r.error) throw r.error;
      return r.data;
    },
  });
  const target = thresholds?.find((row) => row.level === selected);
  return (
    <section className="mt-6 overflow-hidden rounded-2xl border border-gold/30 bg-card p-5">
      <div className="flex items-center gap-2">
        <Map size={20} className="text-gold" />
        <h2 className="font-display text-lg font-bold">
          {l("Your Vanguard journey", "رحلتك في فانغارد")}
        </h2>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {l(
          "100 levels. Six ranks. Select a level to preview your next milestone.",
          "١٠٠ مستوى. ست رتب. اختر مستوى لاستكشاف محطتك التالية.",
        )}
      </p>
      <div className="mt-4 flex items-center gap-3 rounded-xl bg-background p-3">
        {avatar ? (
          <img
            src={avatar}
            alt={displayName}
            className="h-12 w-12 rounded-full border border-gold object-cover"
          />
        ) : (
          <span className="flex h-12 w-12 items-center justify-center rounded-full border border-gold font-bold text-gold">
            {displayName.slice(0, 2).toUpperCase()}
          </span>
        )}
        <div>
          <p className="text-sm font-semibold">{displayName}</p>
          <p className="text-xs text-gold">
            {t("level")} {level} · {xp} XP
          </p>
        </div>
      </div>
      <div
        className="mt-4 max-h-80 space-y-6 overflow-y-auto rounded-xl bg-background/40 p-3"
        aria-label={l("100-level journey map", "خريطة رحلة المئة مستوى")}
      >
        {RANKS.map((tier) => (
          <div key={tier.key}>
            <div className="mb-3 flex items-center gap-2">
              <RankCrest rank={tier.key} size={48} />
              <h3 className="text-sm font-bold">
                {locale === "ar" ? tier.ar : tier.key}{" "}
                <span className="font-normal text-muted-foreground">
                  {tier.min}–{tier.max}
                </span>
              </h3>
            </div>
            <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
              {Array.from({ length: tier.max - tier.min + 1 }, (_, i) => i + tier.min).map((n) => (
                <button
                  key={n}
                  aria-pressed={selected === n}
                  aria-current={level === n ? "step" : undefined}
                  aria-label={`${t("level")} ${n} ${n > level ? t("locked") : ""}`}
                  onClick={() => setSelected(n)}
                  className={`relative flex min-h-11 items-center justify-center rounded-full border text-sm font-bold ${selected === n ? "ring-2 ring-gold ring-offset-2 ring-offset-card" : ""} ${n <= level ? "border-gold/60 bg-gold/15 text-gold" : "border-border text-muted-foreground"}`}
                >
                  {n}
                  {n === level && (
                    <span
                      aria-hidden
                      className="absolute -top-1 end-0 h-2 w-2 rounded-full bg-success"
                    />
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div
        className="mt-4 flex items-center gap-4 rounded-xl border border-border p-4"
        aria-live="polite"
      >
        <RankCrest rank={rank.key} size={104} />
        <div className="min-w-0 flex-1">
          <h3 className="font-bold">
            {t("level")} {selected} · {locale === "ar" ? rank.ar : rank.key}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {selected > level && <Lock size={12} className="me-1 inline" />}
            {target
              ? `${target.xp_required} XP · ${Math.max(0, target.xp_required - xp)} ${l("XP to reach", "نقطة للوصول")}`
              : l("XP threshold unavailable", "حد نقاط الخبرة غير متاح")}
          </p>
          <p className="mt-1 text-xs text-gold">
            {l("Title & crest", "اللقب والشعار")}: {locale === "ar" ? rank.ar : rank.key}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {l(
              "Rank perks: awaiting approval. No reward entitlement is attached to this preview.",
              "مزايا الرتبة بانتظار الاعتماد. هذا العرض لا يمنح استحقاقاً لمكافأة.",
            )}
          </p>
        </div>
      </div>
      {thresholds?.some((row) => row.provisional) && (
        <p className="mt-3 text-[11px] text-muted-foreground">{t("provisional")}</p>
      )}
    </section>
  );
}
