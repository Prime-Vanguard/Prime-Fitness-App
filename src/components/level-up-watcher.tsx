import { useCallback, useEffect, useState } from "react";
import { BadgeUnlock } from "@/components/badge-unlock";
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

/** Compare server-derived levels with the last level seen on this device. */
export function LevelUpWatcher({ userId }: { userId: string }) {
  const { data: me } = useMe(userId);
  const { data: g } = useGamification(userId);
  const { t, locale } = useI18n();
  const [show, setShow] = useState<null | { level: number; promoted: boolean }>(null);
  const [fresh, setFresh] = useState<{ code: string; title: string }[]>([]);
  const { data: badges } = useQuery({
    queryKey: ["earned-badges", userId],
    refetchInterval: 60000,
    queryFn: async () => {
      const result = await supabase
        .from("member_badges")
        .select("badge_code,badges(title_en,title_ar)")
        .eq("member_id", userId);
      if (result.error) throw result.error;
      return result.data;
    },
  });
  useEffect(() => {
    if (!badges) return;
    try {
      const key = `pf-earned-badges-${userId}`;
      const previous = localStorage.getItem(key);
      const seen: unknown = previous ? JSON.parse(previous) : null;
      // The first read on a device is a baseline, so old badges never celebrate again.
      const added = Array.isArray(seen) ? badges.filter((b) => !seen.includes(b.badge_code)) : [];
      if (added.length) {
        haptic("badge");
        setFresh((queue) => [
          ...queue,
          ...added.map((b) => ({
            code: b.badge_code,
            title:
              (locale === "ar" ? b.badges?.title_ar : b.badges?.title_en) ??
              b.badges?.title_en ??
              t("badges"),
          })),
        ]);
      }
      localStorage.setItem(key, JSON.stringify(badges.map((b) => b.badge_code)));
    } catch {
      /* Celebration is optional when device storage is restricted. */
    }
    // Titles are read once per change; a later language switch need not replay it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [badges, userId]);
  const dismissBadge = useCallback(() => setFresh((queue) => queue.slice(1)), []);

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

  // A level-up takes the stage first; badges follow once it closes.
  const badgeCard = !show && fresh[0] && (
    <BadgeUnlock
      key={fresh[0].code}
      code={fresh[0].code}
      title={fresh[0].title}
      onDone={dismissBadge}
    />
  );
  if (!g) return badgeCard || null;
  return (
    <>
      {badgeCard}
      <Dialog open={!!show} onOpenChange={(o) => !o && setShow(null)}>
        <DialogContent className="gold-glow max-w-sm border-gold/50 text-center">
          <div className="crest-reveal mx-auto">
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
    </>
  );
}
