import type { ExerciseGuidance } from "./exercise-guidance";
export type ExerciseMedia = NonNullable<ExerciseGuidance["media"]>;

export function safeExerciseAsset(value: string | undefined): string | null {
  if (!value) return null;
  try {
    if (value.startsWith("/") && !value.startsWith("//")) {
      const url = new URL(value, "https://prime.invalid");
      return url.origin === "https://prime.invalid" ? value : null;
    }
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}
export function exerciseMediaKind(media: ExerciseMedia): "gif" | "image" | "video" {
  if (media.kind) return media.kind;
  const path = new URL(media.url, "https://prime.invalid").pathname.toLowerCase();
  if (path.endsWith(".gif")) return "gif";
  return /\.(png|jpe?g|webp|avif)$/.test(path) ? "image" : "video";
}
/** Posters must be reviewed static derivatives; never load a GIF as a thumbnail. */
export function exercisePoster(exercise: ExerciseGuidance): string | null {
  if (exercise.editorial_status !== "reviewed" || !exercise.media) return null;
  const poster = safeExerciseAsset(exercise.media.poster);
  if (!poster || /\.gif$/i.test(new URL(poster, "https://prime.invalid").pathname)) return null;
  return poster;
}
