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
import {
  celebrate,
  celebrationDone,
  setRewardsNew,
  setRewardsUser,
  useCelebration,
} from "@/lib/celebrate";
import { embersFrom } from "@/lib/embers";
import { readDevice, readDeviceJson, writeDevice } from "@/lib/device-storage";
import { rankFor } from "@/lib/levels";
import { useCountUp } from "@/hooks/use-count-up";
import { celebrationMoves } from "@/lib/celebrate";

const STRIKE_LEVEL_MS = 520,
  STRIKE_RANK_MS = 1100;

/** The level number drops in, rolling through each level gained (3 → 4 → 5). */
function LevelRoll({ from, to }: { from: number; to: number }) {
  const steps = Math.max(0, to - Math.max(from, to - 10));
  const value = useCountUp(to, Math.min(1200, steps * 220), to - steps, STRIKE_LEVEL_MS + 100);
  return (
    <span className="level-drop tabular-nums">
      <span aria-hidden>{Math.round(value)}</span>
      <span className="sr-only">{to}</span>
    </span>
  );
}

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
    setRewardsUser(userId);
    return () => setRewardsUser(null);
  }, [userId]);
  useEffect(() => {
    if (!badges) return;
    const key = `pf-earned-badges-${userId}`;
    const seen = readDeviceJson(key);
    const added = Array.isArray(seen) ? badges.filter((b) => !seen.includes(b.badge_code)) : [];
    // Already on Rewards: the new badge is in view, so no dot.
    if (added.length && !location.pathname.startsWith("/rewards")) setRewardsNew(userId, true);
    for (const b of added)
      celebrate({
        kind: "badge",
        code: b.badge_code,
        title:
          (locale === "ar" ? b.badges?.title_ar : b.badges?.title_en) ??
          b.badges?.title_en ??
          t("badges"),
      });
    writeDevice(key, JSON.stringify(badges.map((b) => b.badge_code)));
    // Titles are read once per change; a later language switch need not replay it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [badges, userId]);

  useEffect(() => {
    if (!g) return;
    // Without device storage there is no baseline, so nothing replays.
    const k = `pf-level-${userId}`;
    const prev = Number(readDevice(k) ?? "0");
    const prevRank = readDevice(`${k}-rank`);
    writeDevice(k, String(g.level));
    writeDevice(`${k}-rank`, g.rank.key);
    if (prev > 0 && g.level > prev)
      celebrate(
        prevRank && prevRank !== g.rank.key
          ? { kind: "rank", level: g.level, rank: g.rank.key, from: prev }
          : { kind: "level", level: g.level, from: prev },
      );
  }, [g, userId]);

  useEffect(() => {
    document.documentElement.dataset["celebrate"] = setting;
  }, [setting]);
  // Unlock audio on the first tap, so a celebration found later in the visit can sound.
  useEffect(() => {
    const unlock = () => {
      if (readDevice("pf-celebration-sound") === "on") void primeAudio();
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
    // Sparks fly when the crest locks: the strike for a level, the new crest's rise for a rank.
    const timer = window.setTimeout(
      () =>
        embersFrom(
          current.kind === "badge"
            ? document.querySelector(".badge-unlock-card .badge-art")
            : crest.current,
          current.kind === "rank" ? 48 : 28,
        ),
      current.kind === "rank" ? STRIKE_RANK_MS : current.kind === "level" ? STRIKE_LEVEL_MS : 0,
    );
    return () => window.clearTimeout(timer);
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
          const delay = celebrationMoves() ? (current.kind === "rank" ? 1600 : 1100) : 0;
          (e.currentTarget as HTMLElement | null)?.focus();
          window.setTimeout(() => keepGoing.current?.focus(), delay);
        }}
      >
        {current.kind === "rank" ? (
          // Ascension: the old crest cracks away and the new one rises in its aura.
          <div ref={crest} className="forge-crest mx-auto" data-ascension>
            <div className="ascend-old" aria-hidden>
              <RankCrest rank={rankFor(current.from).key} size={160} />
            </div>
            <div className="ascend-new">
              <RankCrest rank={g.rank.key} size={160} />
            </div>
            <span
              className="forge-ring"
              style={{ animationDelay: `${STRIKE_RANK_MS}ms` }}
              aria-hidden
            />
          </div>
        ) : (
          // Forged: four shards of the crest fly together and lock with a strike.
          <div ref={crest} className="forge-crest forge-lock mx-auto" data-forged>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="forge-shard" aria-hidden={i > 0 || undefined}>
                <RankCrest rank={g.rank.key} size={160} />
              </div>
            ))}
            <span className="forge-ring" aria-hidden />
          </div>
        )}
        <DialogTitle className="font-display text-2xl">
          {current.kind === "rank" ? t("rankUp") : t("levelUp")}
        </DialogTitle>
        <DialogDescription className="text-base">
          <span
            className={`block text-sm font-semibold text-gold ${current.kind === "rank" ? "strike-text text-lg" : ""}`}
          >
            {locale === "ar" ? g.rank.ar : g.rank.key}
          </span>
          {t("level")} <LevelRoll from={current.from} to={current.level} />
        </DialogDescription>
        <div
          className="reveal-late space-y-3"
          style={{ animationDelay: `${current.kind === "rank" ? 1600 : 1100}ms` }}
        >
          <ShareAchievement
            name={me?.profile?.display_name || t("member")}
            title={`${t("level")} ${g.level}`}
            detail={locale === "ar" ? g.rank.ar : g.rank.key}
            rank={g.rank.key}
          />
          <Button ref={keepGoing} className="w-full" onClick={finish}>
            {t("keepGoing")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
