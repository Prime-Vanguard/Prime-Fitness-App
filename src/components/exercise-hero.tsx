import { useState, type ReactNode } from "react";
import { Dumbbell, Play } from "lucide-react";
import type { ExerciseGuidance } from "@/lib/exercise-guidance";
import { exercisePoster } from "@/lib/exercise-media";
import { useExerciseVisual } from "@/hooks/use-exercise-visual";
import { useI18n } from "@/lib/i18n";
import { ExerciseArtwork } from "./exercise-artwork";

export function ExerciseHero({
  exercise,
  name,
  onOpen,
  enabled = true,
  compactFallback = false,
  overlay,
}: {
  exercise: ExerciseGuidance | undefined;
  name: string;
  onOpen?: () => void;
  enabled?: boolean;
  compactFallback?: boolean;
  /** Session summaries can share the poster without adding a second media panel. */
  overlay?: ReactNode;
}) {
  const { locale } = useI18n();
  const media = useExerciseVisual(exercise, enabled);
  const poster =
    media && exercise ? exercisePoster({ ...exercise, media, editorial_status: "reviewed" }) : null;
  const [failed, setFailed] = useState("");
  return (
    <div
      data-exercise-hero
      className={`relative w-full overflow-hidden rounded-xl bg-[#151F33] ${overlay ? "min-h-48" : compactFallback && (!poster || failed === poster) ? "h-20" : "aspect-[16/10]"}`}
    >
      {poster && failed !== poster ? (
        <ExerciseArtwork
          branded={media?.author === "Gym Visual"}
          src={poster}
          alt={name}
          className={`${overlay ? "absolute inset-0" : ""} h-full w-full object-contain`}
          referrerPolicy="no-referrer"
          onError={() => setFailed(poster)}
        />
      ) : (
        <div
          className={`${overlay ? "absolute inset-0" : ""} flex h-full items-center justify-center`}
        >
          <Dumbbell aria-hidden className="size-16 text-muted-foreground/50" />
        </div>
      )}
      {/* A tonal scrim preserves readable text over approved media and its fallback.
          Playback still requires the explicit, independently focusable control. */}
      {overlay && (
        <div className="relative bg-gradient-to-t from-card via-card/90 to-card/30 px-4 pt-20 pb-4">
          {overlay}
        </div>
      )}
      {onOpen && enabled && (
        <button
          type="button"
          onClick={onOpen}
          className={`absolute flex min-h-11 items-center gap-2 bg-background/90 px-3 py-2 text-start text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gold ${overlay ? "end-2 top-2 max-w-[calc(100%-1rem)] rounded-lg" : "inset-x-0 bottom-0"}`}
          aria-label={
            locale === "ar" ? `عرض الشرح المرئي: ${name}` : `View exercise demonstration: ${name}`
          }
        >
          <Play aria-hidden className="size-4 shrink-0 fill-gold text-gold" />
          <span className="truncate">
            {locale === "ar" ? "مشاهدة طريقة الأداء" : "Watch exercise demonstration"}
          </span>
        </button>
      )}
    </div>
  );
}
