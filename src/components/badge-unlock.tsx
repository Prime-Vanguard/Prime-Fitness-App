import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { X } from "lucide-react";
import type { CSSProperties } from "react";
import { BadgeArt } from "@/components/badge-art";
import { badgeArt, RARITY_LABEL, type Rarity } from "@/lib/badges";
import { useI18n } from "@/lib/i18n";

const BURST: Record<Rarity, string> = {
  common: "203 213 225",
  uncommon: "205 127 50",
  rare: "125 211 252",
  epic: "168 85 247",
  legendary: "255 205 90",
  mythic: "255 215 105",
};

/** Non-blocking "medal pinned" card for a newly confirmed badge; dismisses itself. */
export function BadgeUnlock({
  code,
  title,
  onDone,
}: {
  code: string;
  title: string;
  onDone: () => void;
}) {
  const { locale } = useI18n();
  const l = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const rarity = badgeArt(code).rarity;
  const [leaving, setLeaving] = useState(false);
  // After 5s the medal flies into the Rewards tab, which keeps a dot until opened.
  useEffect(() => {
    const leave = window.setTimeout(() => setLeaving(true), 5000);
    const done = window.setTimeout(onDone, 5450);
    return () => {
      window.clearTimeout(leave);
      window.clearTimeout(done);
    };
  }, [code, onDone]);
  return (
    <div
      role="status"
      className={`${leaving ? "badge-pin-out" : ""} badge-unlock-card fixed inset-x-4 top-[max(1rem,env(safe-area-inset-top))] z-50 mx-auto flex max-w-sm items-center gap-3 rounded-2xl border border-gold/50 bg-card/95 p-3 shadow-2xl backdrop-blur`}
      style={{ "--badge-burst": BURST[rarity] } as CSSProperties}
    >
      <span className="relative">
        <span className="badge-burst" aria-hidden />
        <BadgeArt code={code} unlocked size={64} />
      </span>
      <Link
        to="/rewards"
        onClick={onDone}
        className="min-w-0 flex-1 rounded-lg focus-visible:ring-2 focus-visible:ring-gold"
      >
        <span className="block text-xs text-gold">
          {l("New badge", "وسام جديد")} · {RARITY_LABEL[rarity][locale === "ar" ? 1 : 0]}
        </span>
        <span className="block truncate font-heading font-bold">{title}</span>
        <span className="block text-xs text-muted-foreground">
          {l("Tap to view in Rewards", "اضغط للعرض في المكافآت")}
        </span>
      </Link>
      <button
        onClick={onDone}
        aria-label={l("Dismiss", "إغلاق")}
        className="grid size-11 shrink-0 place-items-center rounded-lg text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-gold"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
