import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { BadgeUnlock } from "@/components/badge-unlock";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ShareAchievement } from "@/components/share-achievement";
import { useMe } from "@/hooks/use-me";
import { celebrationSound, haptic, primeAudio } from "@/lib/device-feedback";
import { RankCrest } from "@/components/rank-crest";
import { useGamification } from "@/hooks/use-gamification";
import { useI18n } from "@/lib/i18n";
import { celebrate, celebrationDone, useCelebration } from "@/lib/celebrate";
import { embersFrom } from "@/lib/embers";

/**
 * Watches server-confirmed level, rank and badges against the last values seen on this
 * device, queues celebrations, and plays the one on stage. The first read is a baseline,
 * so a refresh never repeats a celebration.
 */
export function LevelUpWatcher({ userId }: { userId: string }) {
  const { data: me } = useMe(userId);
  const { data: g } = useGamification(userId);
  const { t, locale } = useI18n();
  const { current, level: setting } = useCelebration();
  const keepGoing = useRef<HTMLButtonElement>(null);
  const crest = useRef<HTMLDivElement>(null);
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
      if (Array.isArray(seen))
        for (const b of badges.filter((b) => !seen.includes(b.badge_code)))
          celebrate({
            kind: "badge",
            code: b.badge_code,
            title:
              (locale === "ar" ? b.badges?.title_ar : b.badges?.title_en) ??
              b.badges?.title_en ??
              t("badges"),
          });
      localStorage.setItem(key, JSON.stringify(badges.map((b) => b.badge_code)));
    } catch {
      /* Celebration is optional when device storage is restricted. */
    }
    // Titles are read once per change; a later language switch need not replay it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [badges, userId]);

  useEffect(() => {
    if (!g) return;
    try {
      const k = `pf-level-${userId}`;
      const prev = Number(localStorage.getItem(k) ?? "0");
      const prevRank = localStorage.getItem(`${k}-rank`);
      localStorage.setItem(k, String(g.level));
      localStorage.setItem(`${k}-rank`, g.rank.key);
      if (prev > 0 && g.level > prev)
        celebrate(
          prevRank && prevRank !== g.rank.key
            ? { kind: "rank", level: g.level, rank: g.rank.key }
            : { kind: "level", level: g.level },
        );
    } catch {
      /* Celebration is optional when device storage is restricted. */
    }
  }, [g, userId]);

  useEffect(() => {
    document.documentElement.dataset["celebrate"] = setting;
  }, [setting]);
  // Unlock audio on the first tap, so a celebration found later in the visit can sound.
  useEffect(() => {
    const unlock = () => {
      if (localStorage.getItem("pf-celebration-sound") === "on") void primeAudio();
    };
    addEventListener("pointerdown", unlock, { once: true, capture: true });
    return () => removeEventListener("pointerdown", unlock, { capture: true });
  }, []);

  // Each event announces itself once when it takes the stage.
  useEffect(() => {
    if (!current) return;
    if (setting === "off") {
      // Off: no motion, sound or vibration; the plain text still tells the member.
      if (current.kind === "badge")
        toast.success(`${locale === "ar" ? "وسام جديد" : "New badge"}: ${current.title}`);
      else if (current.kind === "level" || current.kind === "rank")
        toast.success(
          `${t(current.kind === "rank" ? "rankUp" : "levelUp")} ${t("level")} ${current.level}`,
        );
      celebrationDone(current);
      return;
    }
    haptic("badge");
    if (setting !== "full") return;
    void celebrationSound(
      current.kind === "rank" ? "fanfare" : current.kind === "badge" ? "chime" : "strike",
    );
    // Sparks are motion: a device asking for reduced motion never gets them, even on Full.
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Let the overlay mount and lay out before sparks start from it.
    const frame = requestAnimationFrame(() =>
      embersFrom(
        current.kind === "badge"
          ? document.querySelector(".badge-unlock-card .badge-art")
          : crest.current,
        current.kind === "rank" ? 48 : 28,
      ),
    );
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, setting]);

  const finish = useCallback(() => current && celebrationDone(current), [current]);
  // Kinds without a renderer yet (XP, quests, streaks, redemptions) must not block the queue.
  const unrendered =
    !!current && current.kind !== "badge" && current.kind !== "level" && current.kind !== "rank";
  useEffect(() => {
    if (current && unrendered) celebrationDone(current);
  }, [current, unrendered]);
  if (!current || setting === "off") return null;
  if (current.kind === "badge")
    return (
      <BadgeUnlock key={current.code} code={current.code} title={current.title} onDone={finish} />
    );
  if ((current.kind !== "level" && current.kind !== "rank") || !g) return null;
  return (
    <Dialog open onOpenChange={(o) => !o && finish()}>
      <DialogContent
        className="gold-glow max-w-sm border-gold/50 text-center"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          keepGoing.current?.focus();
        }}
      >
        <div ref={crest} className="crest-reveal mx-auto">
          <RankCrest rank={g.rank.key} size={160} />
        </div>
        <DialogTitle className="font-display text-2xl">
          {current.kind === "rank" ? t("rankUp") : t("levelUp")}
        </DialogTitle>
        <DialogDescription className="text-base">
          <span className="block text-sm font-semibold text-gold">
            {locale === "ar" ? g.rank.ar : g.rank.key}
          </span>
          {t("level")} {current.level}
        </DialogDescription>
        <ShareAchievement
          name={me?.profile?.display_name || t("member")}
          title={`${t("level")} ${g.level}`}
          detail={locale === "ar" ? g.rank.ar : g.rank.key}
          rank={g.rank.key}
        />
        <Button ref={keepGoing} onClick={finish}>
          {t("keepGoing")}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
