import { numberLocale } from "@/lib/i18n";
import { useEffect, useRef, useState } from "react";
import { Button } from "./ui/button";
import { Lock, Map } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { RANKS, rankFor } from "@/lib/levels";
import { RankCrest } from "@/components/rank-crest";
import { useI18n } from "@/lib/i18n";

export function VanguardRoadmap({ level, xp }: { level: number; xp: number }) {
  const { locale, t } = useI18n();
  const l = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const [selected, setSelected] = useState(level);
  const rank = rankFor(selected);
  const mapRef = useRef<HTMLDivElement>(null);
  function jumpCurrent() {
    setSelected(level);
    const container = mapRef.current,
      button = container?.querySelector<HTMLElement>('[aria-current="step"]');
    if (container && button) container.scrollTop = button.offsetTop - container.clientHeight / 2;
    button?.focus({ preventScroll: true });
  }
  useEffect(() => {
    const container = mapRef.current,
      button = container?.querySelector<HTMLElement>('[aria-current="step"]');
    if (container && button) container.scrollTop = button.offsetTop - container.clientHeight / 2;
  }, [level]);
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
  const nextRank = RANKS.find((tier) => tier.min > level);
  const nextThreshold = thresholds?.find((row) => row.level === nextRank?.min);
  const fmt = (value: number) => value.toLocaleString(numberLocale(locale));
  return (
    <section className="mt-4 overflow-hidden rounded-xl bg-card p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <Map size={20} className="text-gold" />
        <h2 className="font-display text-lg font-bold">
          {l("Your Vanguard journey", "رحلتك في فانغارد")}
        </h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        {l("Select a level to preview it.", "اختر مستوى لمعاينته.")}
      </p>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <Button variant="outline" size="sm" onClick={jumpCurrent}>
          {l("Jump to my level", "الانتقال إلى مستواي")}
        </Button>
        {nextRank && nextThreshold && (
          <p className="text-xs text-muted-foreground">
            {l("Next rank", "الرتبة التالية")}: {locale === "ar" ? nextRank.ar : nextRank.key} ·{" "}
            <bdi>{fmt(Math.max(0, nextThreshold.xp_required - xp))} XP</bdi>
          </p>
        )}
      </div>
      <div
        ref={mapRef}
        className="relative mt-4 max-h-80 space-y-6 overflow-y-auto rounded-xl bg-background/40 p-3"
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
                  aria-label={`${t("level")} ${n} ${n > level ? t("locked") : n < level ? l("Reached", "تم الوصول") : ""}`.trim()}
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
        <RankCrest rank={rank.key} size={64} />
        <div className="min-w-0 flex-1">
          <h3 className="font-bold">
            {t("level")} {selected} · {locale === "ar" ? rank.ar : rank.key}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {selected > level && <Lock size={12} className="me-1 inline" />}
            {!target ? (
              l("XP threshold unavailable", "حد نقاط الخبرة غير متاح")
            ) : selected <= level ? (
              <>
                <bdi>{fmt(target.xp_required)} XP</bdi> · {l("Reached", "تم الوصول")}
              </>
            ) : (
              <>
                <bdi>{fmt(target.xp_required)} XP</bdi> ·{" "}
                <bdi>{fmt(Math.max(0, target.xp_required - xp))} XP</bdi> {l("to go", "متبقية")}
              </>
            )}
          </p>
        </div>
      </div>
      {thresholds?.some((row) => row.provisional) && (
        <p className="mt-3 text-xs text-muted-foreground">{t("provisional")}</p>
      )}
    </section>
  );
}
