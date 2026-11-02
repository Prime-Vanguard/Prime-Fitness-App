import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ShareAchievement } from "@/components/share-achievement";
import { useMe } from "@/hooks/use-me";
import { haptic } from "@/lib/device-feedback";
import { RankCrest } from "@/components/rank-crest";
import { useGamification } from "@/hooks/use-gamification";
import { useI18n } from "@/lib/i18n";

/** Celebrates when the member's level rises since their last visit on this device. */
export function LevelUpWatcher({ userId }: { userId: string }) {
  const { data: me } = useMe(userId);
  const { data: g } = useGamification(userId);
  const { t, locale } = useI18n();
  const [show, setShow] = useState<null | { level: number; promoted: boolean }>(null);
  const { data: badges } = useQuery({
    queryKey: ["earned-badges", userId],
    refetchInterval: 60000,
    queryFn: async () => {
      const result = await supabase
        .from("member_badges")
        .select("badge_code")
        .eq("member_id", userId);
      if (result.error) throw result.error;
      return result.data.map((b) => b.badge_code);
    },
  });
  useEffect(() => {
    if (!badges) return;
    try {
      const key = `pf-earned-badges-${userId}`;
      const previous = localStorage.getItem(key);
      const seen: unknown = previous ? JSON.parse(previous) : null;
      if (Array.isArray(seen) && badges.some((badge) => !seen.includes(badge))) haptic("badge");
      localStorage.setItem(key, JSON.stringify(badges));
    } catch {
      /* Celebration is optional when device storage is restricted. */
    }
  }, [badges, userId]);

  useEffect(() => {
    if (!g) return;
    const k = `pf-level-${userId}`;
    const prev = Number(localStorage.getItem(k) ?? "0");
    localStorage.setItem(k, String(g.level));
    const prevRank = localStorage.getItem(`${k}-rank`);
    localStorage.setItem(`${k}-rank`, g.rank.key);
    if (prev > 0 && g.level > prev) {
      setShow({ level: g.level, promoted: !!prevRank && prevRank !== g.rank.key });
      haptic("badge");
    }
  }, [g, userId]);

  if (!g) return null;
  return (
    <Dialog open={!!show} onOpenChange={(o) => !o && setShow(null)}>
      <DialogContent className="gold-glow max-w-sm border-gold/50 text-center">
        <div className="mx-auto motion-safe:animate-in motion-safe:zoom-in-50 motion-safe:duration-700">
          <RankCrest rank={g.rank.key} size={160} />
        </div>
        <DialogTitle className="font-display text-2xl">
          {show?.promoted ? t("rankUp") : t("levelUp")}
        </DialogTitle>
        <DialogDescription className="text-base">
          <span className="block text-xs uppercase tracking-widest text-gold">
            {locale === "ar" ? g.rank.ar : g.rank.key}
          </span>
          {t("level")} {show?.level}
        </DialogDescription>
        <ShareAchievement
          name={me?.profile?.display_name || t("member")}
          title={`${t("level")} ${g.level}`}
          detail={locale === "ar" ? g.rank.ar : g.rank.key}
          rank={g.rank.key}
        />
        <Button onClick={() => setShow(null)}>{t("keepGoing")}</Button>
      </DialogContent>
    </Dialog>
  );
}
