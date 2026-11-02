import { useState } from "react";
import { Dumbbell, Play } from "lucide-react";
import type { ExerciseGuidance } from "@/lib/exercise-guidance";
import { exercisePoster } from "@/lib/exercise-media";
import { useI18n } from "@/lib/i18n";
import { useExerciseVisual } from "@/hooks/use-exercise-visual";
import { ExerciseArtwork } from "./exercise-artwork";

export function ExerciseThumbnail({
  exercise,
  name,
  enabled = true,
  onOpen,
}: {
  exercise: ExerciseGuidance | undefined;
  name: string;
  enabled?: boolean;
  onOpen: () => void;
}) {
  const media = useExerciseVisual(exercise, enabled);
  const poster =
    enabled && exercise && media
      ? exercisePoster({ ...exercise, media, editorial_status: "reviewed" })
      : null;
  // Key by URL so a different exercise/source can recover from an earlier failure.
  return (
    <ThumbnailImage
      key={poster ?? "placeholder"}
      poster={poster}
      branded={media?.author === "Gym Visual"}
      name={name}
      enabled={enabled}
      onOpen={onOpen}
    />
  );
}
function ThumbnailImage({
  poster,
  name,
  enabled,
  onOpen,
  branded,
}: {
  poster: string | null;
  name: string;
  enabled: boolean;
  onOpen: () => void;
  branded: boolean;
}) {
  const { locale } = useI18n();
  const [failed, setFailed] = useState(false);
  const label =
    locale === "ar" ? `عرض الشرح المرئي: ${name}` : `View exercise demonstration: ${name}`;
  const content = (
    <>
      {poster && !failed ? (
        <ExerciseArtwork
          branded={branded}
          src={poster}
          alt=""
          width={64}
          height={64}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          className="h-full w-full object-contain"
          onError={() => setFailed(true)}
        />
      ) : (
        <Dumbbell aria-hidden className="h-6 w-6 text-gold/70" />
      )}
      {poster && !failed && (
        <span className="absolute bottom-0 end-0 rounded-tl-md bg-background/90 p-0.5">
          <Play aria-hidden className="h-3 w-3 text-gold" />
        </span>
      )}
    </>
  );
  const style =
    "relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#D4AF37]/40 bg-[#0F172A] md:h-16 md:w-16";
  if (!enabled)
    return (
      <span
        role="img"
        aria-label={
          locale === "ar"
            ? `معاينة التمرين غير متاحة: ${name}`
            : `Exercise preview unavailable: ${name}`
        }
        className={style}
      >
        {content}
      </span>
    );
  return (
    <button
      type="button"
      className={`${style} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold`}
      aria-label={label}
      title={label}
      onClick={onOpen}
    >
      {content}
    </button>
  );
}
