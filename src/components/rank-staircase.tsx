import { RankCrest } from "@/components/rank-crest";
import { RANKS } from "@/lib/levels";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** The six ranks as a rising staircase; the shared brand image for the public pages. */
export function RankStaircase({ className }: { className?: string }) {
  const { locale } = useI18n();
  const top = RANKS.length - 1;
  return (
    <ol
      aria-label={locale === "ar" ? "الرتب الست" : "The six ranks"}
      className={cn("relative grid grid-cols-6 items-end gap-1.5 sm:gap-2.5", className)}
    >
      <span aria-hidden className="rank-stair-glow" />
      {RANKS.map((rank, i) => (
        <li key={rank.key} className="flex min-w-0 flex-col items-center">
          <RankCrest rank={rank.key} size={34 + i * 8} />
          <div
            className={cn(
              "rank-stair-step mt-2 flex w-full items-end justify-center rounded-t-md px-0.5 pb-2",
              i === top && "rank-stair-top",
            )}
            style={{ height: `${28 + i * 22}px` }}
          >
            <span
              className={cn(
                "text-center text-[10px] font-semibold leading-tight text-muted-foreground sm:text-xs",
                i === top && "text-gold",
              )}
            >
              {locale === "ar" ? rank.ar : rank.key}
            </span>
          </div>
        </li>
      ))}
    </ol>
  );
}
