import { Award, Lock } from "lucide-react";
import type { CSSProperties } from "react";
import { badgeArt, RARITIES } from "@/lib/badges";

/** Badge artwork with a rarity glow; locked badges render as a dark silhouette. */
export function BadgeArt({
  code,
  unlocked,
  size = 64,
  effects = true,
}: {
  code: string;
  unlocked: boolean;
  size?: number;
  /** Ambient shine and embers; off in dense lists that would distract. */
  effects?: boolean;
}) {
  const { rarity, art } = badgeArt(code);
  const lively = effects && unlocked;
  const tier = RARITIES.indexOf(rarity);
  return (
    <span
      className="badge-art"
      data-rarity={rarity}
      data-locked={!unlocked || undefined}
      data-effects={lively || undefined}
      style={
        {
          "--badge-size": `${size}px`,
          "--badge-mask": art ? `url("${art.medium}")` : "none",
          width: size,
          height: size,
        } as CSSProperties
      }
      aria-hidden
    >
      {lively && tier >= RARITIES.indexOf("mythic") && <span className="badge-ring" />}
      {lively && tier >= RARITIES.indexOf("epic") && (
        <span className="badge-embers">
          <i />
          <i />
          <i />
        </span>
      )}
      {art ? (
        <img
          src={art.medium}
          srcSet={`${art.small} 128w, ${art.medium} 256w, ${art.large} 512w`}
          sizes={`${size}px`}
          width={size}
          height={size}
          alt=""
          decoding="async"
          loading="lazy"
          draggable={false}
          className="badge-art-img select-none object-contain"
        />
      ) : (
        <Award className="size-1/2 text-gold" />
      )}
      {!unlocked && (
        <Lock className="badge-art-lock absolute bottom-0 end-0 size-[30%] rounded-full bg-card p-[6%] text-muted-foreground" />
      )}
    </span>
  );
}
