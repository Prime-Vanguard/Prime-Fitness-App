import { rankEmblem } from "@/lib/rank-emblems";
import { useI18n } from "@/lib/i18n";

/** Approved artwork, with size-specific public assets cached by the PWA. */
export function RankCrest({ rank, size = 56 }: { rank: string; size?: number }) {
  const { locale } = useI18n();
  const art = rankEmblem(rank);
  return (
    <img
      src={art.medium}
      srcSet={`${art.small} 128w, ${art.medium} 256w, ${art.large} 512w`}
      sizes={`${size}px`}
      width={size}
      height={size}
      alt={locale === "ar" ? `شارة رتبة ${art.tier.ar}` : `${art.tier.key} rank emblem`}
      decoding="async"
      draggable={false}
      className="shrink-0 select-none object-contain drop-shadow-md"
    />
  );
}
