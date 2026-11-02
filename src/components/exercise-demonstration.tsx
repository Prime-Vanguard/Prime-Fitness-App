import { useState } from "react";
import { Dumbbell } from "lucide-react";
import type { ExerciseGuidance } from "@/lib/exercise-guidance";
import { exerciseMediaKind, exercisePoster, safeExerciseAsset } from "@/lib/exercise-media";
import { useI18n } from "@/lib/i18n";
import { useExerciseVisual } from "@/hooks/use-exercise-visual";
import { Button } from "./ui/button";
import { ExerciseArtwork } from "./exercise-artwork";

export function ExerciseDemonstration({
  exercise,
  startMedia = false,
}: {
  exercise: ExerciseGuidance;
  startMedia?: boolean;
}) {
  const { locale } = useI18n();
  const media = useExerciseVisual(exercise);
  const l = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const [playing, setPlaying] = useState(
    () =>
      startMedia &&
      !(typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches),
  );
  const [failed, setFailed] = useState(false),
    [posterFailed, setPosterFailed] = useState(false);
  const source = safeExerciseAsset(media?.url);
  if (!media || !source)
    return (
      <p className="my-4 text-sm text-muted-foreground">
        {l(
          "Demonstration unavailable. Follow the written guidance or ask your coach.",
          "الشرح المرئي غير متاح. اتبع التعليمات المكتوبة أو اسأل مدربك.",
        )}
      </p>
    );
  const kind = exerciseMediaKind(media),
    poster = exercisePoster({ ...exercise, media, editorial_status: "reviewed" });
  const name = locale === "ar" && exercise.name_ar ? exercise.name_ar : exercise.name_en;
  return (
    <section
      className="my-4 space-y-3 rounded-xl border border-[#D4AF37]/40 bg-[#0F172A] p-3 text-[#F1F5F9]"
      aria-label={l("Exercise demonstration", "الشرح المرئي")}
    >
      <p className="text-xs font-semibold tracking-widest text-[#D4AF37]">PRIME VANGUARD</p>
      <div className="flex min-h-40 items-center justify-center overflow-hidden rounded-lg bg-[#0F172A]">
        {playing && !failed ? (
          kind === "video" ? (
            <video
              key={source}
              className="max-h-[55dvh] w-full"
              src={source}
              poster={poster ?? undefined}
              controls
              autoPlay
              playsInline
              preload="metadata"
              aria-label={l(`Demonstration: ${name}`, `شرح: ${name}`)}
              onError={() => {
                setFailed(true);
                setPlaying(false);
              }}
            />
          ) : (
            <ExerciseArtwork
              branded={media.author === "Gym Visual"}
              key={source}
              src={source}
              alt={l(
                `Demonstration of ${name}; written instructions above`,
                `شرح ${name}؛ التعليمات مكتوبة أعلاه`,
              )}
              className="max-h-[55dvh] w-full object-contain"
              referrerPolicy="no-referrer"
              onError={() => {
                setFailed(true);
                setPlaying(false);
              }}
            />
          )
        ) : poster && !posterFailed ? (
          <ExerciseArtwork
            branded={media.author === "Gym Visual"}
            src={poster}
            alt=""
            className="max-h-[55dvh] w-full object-contain"
            referrerPolicy="no-referrer"
            onError={() => setPosterFailed(true)}
          />
        ) : (
          <Dumbbell className="h-12 w-12 text-gold/60" aria-hidden />
        )}
      </div>
      {failed && (
        <p role="alert" className="text-sm text-destructive">
          {l(
            "Could not load the demonstration. You can retry or use the written instructions.",
            "تعذر تحميل الشرح المرئي. أعد المحاولة أو استخدم التعليمات المكتوبة.",
          )}
        </p>
      )}
      <Button
        className="w-full"
        variant="outline"
        onClick={() => {
          if (playing) setPlaying(false);
          else {
            setFailed(false);
            setPlaying(true);
          }
        }}
      >
        {playing
          ? kind === "gif"
            ? l("Stop animation", "إيقاف الحركة")
            : l("Close demonstration", "إغلاق الشرح")
          : failed
            ? l("Retry demonstration", "إعادة تحميل الشرح")
            : kind === "image"
              ? l("Show demonstration image", "عرض صورة الشرح")
              : l("Play demonstration", "تشغيل الشرح")}
      </Button>
      <p className="text-xs text-[#CBD5E1]">
        {media.attribution} · {media.license}
      </p>
    </section>
  );
}
