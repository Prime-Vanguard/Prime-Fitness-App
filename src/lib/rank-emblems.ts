import { RANKS } from "./levels";
import recruit128 from "@/assets/ranks/recruit-128.webp";
import recruit256 from "@/assets/ranks/recruit-256.webp";
import recruit512 from "@/assets/ranks/recruit-512.webp";
import seeker128 from "@/assets/ranks/seeker-128.webp";
import seeker256 from "@/assets/ranks/seeker-256.webp";
import seeker512 from "@/assets/ranks/seeker-512.webp";
import forged128 from "@/assets/ranks/forged-128.webp";
import forged256 from "@/assets/ranks/forged-256.webp";
import forged512 from "@/assets/ranks/forged-512.webp";
import guardian128 from "@/assets/ranks/guardian-128.webp";
import guardian256 from "@/assets/ranks/guardian-256.webp";
import guardian512 from "@/assets/ranks/guardian-512.webp";
import vanguard128 from "@/assets/ranks/vanguard-128.webp";
import vanguard256 from "@/assets/ranks/vanguard-256.webp";
import vanguard512 from "@/assets/ranks/vanguard-512.webp";
import primelegend128 from "@/assets/ranks/prime-legend-128.webp";
import primelegend256 from "@/assets/ranks/prime-legend-256.webp";
import primelegend512 from "@/assets/ranks/prime-legend-512.webp";

type Rank = (typeof RANKS)[number]["key"];
const images = {
  Recruit: { small: recruit128, medium: recruit256, large: recruit512 },
  Seeker: { small: seeker128, medium: seeker256, large: seeker512 },
  Forged: { small: forged128, medium: forged256, large: forged512 },
  Guardian: { small: guardian128, medium: guardian256, large: guardian512 },
  Vanguard: { small: vanguard128, medium: vanguard256, large: vanguard512 },
  "Prime Legend": { small: primelegend128, medium: primelegend256, large: primelegend512 },
} satisfies Record<Rank, { small: string; medium: string; large: string }>;

export function rankEmblem(rank: string) {
  const tier = RANKS.find((r) => r.key === rank) ?? RANKS[0];
  return { tier, ...images[tier.key] };
}
