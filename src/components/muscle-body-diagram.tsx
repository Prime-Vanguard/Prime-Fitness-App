import Body, { type ExtendedBodyPart, type Slug } from "react-muscle-highlighter";
import { MUSCLES, type Muscle } from "@/lib/muscle-volume";

// These surfaces visualize aggregate groups, not separately measured muscle volumes.
const surfaces: Record<Muscle, Slug[]> = {
  chest: ["chest"],
  back: ["upper-back", "lower-back", "trapezius"],
  shoulders: ["deltoids"],
  biceps: ["biceps"],
  triceps: ["triceps"],
  core: ["abs", "obliques"],
  quads: ["quadriceps"],
  hamstrings: ["hamstring"],
  glutes: ["gluteal"],
  calves: ["calves"],
};

export function MuscleBodyDiagram({
  sets,
  selected,
  onSelect,
  locale,
}: {
  sets: Partial<Record<Muscle, number>>;
  selected: Muscle;
  onSelect: (muscle: Muscle) => void;
  locale: string;
}) {
  const ar = locale === "ar";
  const max = Math.max(1, ...MUSCLES.map((m) => sets[m] ?? 0));
  const data: ExtendedBodyPart[] = MUSCLES.flatMap((muscle) =>
    surfaces[muscle].map((slug) => ({
      slug,
      color:
        (sets[muscle] ?? 0)
          ? `rgba(212,175,55,${0.3 + ((sets[muscle] ?? 0) / max) * 0.7})`
          : "#2C3E55",
      styles: {
        stroke: selected === muscle ? "#F1F5F9" : "#61748D",
        strokeWidth: selected === muscle ? 4 : 1.5,
      },
    })),
  );
  return (
    <div className="mx-auto my-4 w-full max-w-md">
      <div className="grid grid-cols-2 gap-3" dir="ltr">
        {(["front", "back"] as const).map((side) => (
          <figure
            key={side}
            className="min-w-0 rounded-xl border border-border bg-background/40 p-2"
          >
            <figcaption className="min-h-16 text-center" dir={ar ? "rtl" : "ltr"}>
              <p className="text-sm font-semibold">
                {side === "front"
                  ? ar
                    ? "الواجهة الأمامية"
                    : "Front view"
                  : ar
                    ? "الواجهة الخلفية"
                    : "Back view"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {side === "front"
                  ? ar
                    ? "الصدر · الجذع · الأفخاذ الأمامية"
                    : "Chest · Core · Quads"
                  : ar
                    ? "الظهر · الأرداف · الأفخاذ الخلفية"
                    : "Back · Glutes · Hamstrings"}
              </p>
            </figcaption>
            {/* Equivalent labeled keyboard controls and live totals follow the diagram. */}
            <div
              aria-hidden="true"
              className="mx-auto mt-2 max-w-[200px] [&_svg]:h-auto [&_svg]:w-full"
            >
              <Body
                side={side}
                data={data}
                border="#61748D"
                defaultFill="#1B293D"
                defaultStroke="#61748D"
                defaultStrokeWidth={1.5}
                onBodyPartPress={(part) => {
                  const muscle = MUSCLES.find((m) => part.slug && surfaces[m].includes(part.slug));
                  if (muscle) onSelect(muscle);
                }}
              />
            </div>
          </figure>
        ))}
      </div>
      <p className="mt-3 text-center text-xs text-muted-foreground">
        {ar
          ? "اضغط على عضلة أو استخدم الأزرار أدناه. الذهبي = مجموعات مسجلة أكثر؛ الإطار الفاتح = العضلة المحددة."
          : "Tap a muscle or use the buttons below. Gold = more logged sets; light outline = selected muscle."}
      </p>
    </div>
  );
}
