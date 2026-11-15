import { NativeSelect } from "@/components/ui/native-select";
import { useId, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { MemberSections } from "./member-sections";
import { PrivatePhoto } from "./private-photo";

export type ComparisonPhoto = { id: string; pose: string; taken_on: string; url: string | null };
export function PhotoComparison({
  photos,
  pair,
  hideControls = false,
  onRenew = () => {},
  view,
  onViewChange,
}: {
  photos: ComparisonPhoto[];
  pair?: { before?: ComparisonPhoto | undefined; after?: ComparisonPhoto | undefined };
  hideControls?: boolean;
  onRenew?: () => void;
  view?: "side" | "slider";
  onViewChange?: (view: "side" | "slider") => void;
}) {
  const { locale } = useI18n();
  const l = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const id = useId();
  const [pose, setPose] = useState("front");
  const [beforeId, setBefore] = useState("");
  const [afterId, setAfter] = useState("");
  const [split, setSplit] = useState(50);
  const [localView, setLocalView] = useState<"side" | "slider">("side");
  const mode = view ?? localView;
  const setMode = (next: "side" | "slider") => {
    setLocalView(next);
    onViewChange?.(next);
  };
  const available = photos
    .filter((p) => p.pose === pose && p.url)
    .sort((a, b) => a.taken_on.localeCompare(b.taken_on));
  const before = pair ? pair.before : (available.find((p) => p.id === beforeId) ?? available[0]);
  const after = pair
    ? pair.after
    : (available.find((p) => p.id === afterId && p.id !== before?.id) ??
      [...available].reverse().find((p) => p.id !== before?.id));
  const options = (current: string | undefined) =>
    available
      .filter((p) => p.id !== current)
      .map((p) => (
        <option key={p.id} value={p.id}>
          {p.taken_on}
        </option>
      ));
  return (
    <div className="mt-4 space-y-3">
      <h3 className="font-semibold">{l("Compare your progress", "قارن تقدمك")}</h3>
      {!hideControls && (
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <label className="text-xs min-w-0 max-w-full block">
            {l("Pose", "الوضعية")}
            <NativeSelect
              className="mt-2"
              value={pose}
              onChange={(e) => {
                setPose(e.target.value);
                setBefore("");
                setAfter("");
              }}
            >
              {[
                ["front", l("Front", "أمام")],
                ["side", l("Side", "جانب")],
                ["back", l("Back", "خلف")],
              ].map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </NativeSelect>
          </label>
          {available.length >= 2 && (
            <>
              <label className="text-xs min-w-0 max-w-full block">
                {l("Before", "قبل")}
                <NativeSelect
                  className="mt-2"
                  value={before?.id ?? ""}
                  onChange={(e) => setBefore(e.target.value)}
                >
                  {options(undefined)}
                </NativeSelect>
              </label>
              <label className="text-xs min-w-0 max-w-full block">
                {l("After", "بعد")}
                <NativeSelect
                  className="mt-2"
                  value={after?.id ?? ""}
                  onChange={(e) => setAfter(e.target.value)}
                >
                  {options(before?.id)}
                </NativeSelect>
              </label>
            </>
          )}
        </div>
      )}
      {before?.url && after?.url ? (
        <>
          {/* Both views reuse the same authorized pair and renewal callback. Mode
              changes never alter pinned selections, photo metadata or slider position. */}
          <MemberSections
            appearance="segmented"
            label={l("Photo comparison view", "عرض مقارنة الصور")}
            value={mode}
            items={[
              ["side", l("Side by side", "جنباً إلى جنب")],
              ["slider", l("Slider overlay", "شريط المقارنة")],
            ]}
            onSelect={setMode}
          />
          {mode === "side" ? (
            <div data-photo-side-by-side className="mt-4 grid grid-cols-2 gap-3">
              {(
                [
                  ["before", before],
                  ["after", after],
                ] as const
              ).map(([side, photo]) => (
                <figure
                  key={side}
                  className="min-w-0 overflow-hidden rounded-xl border border-border bg-background"
                >
                  <PrivatePhoto
                    key={photo.id}
                    url={photo.url}
                    onRenew={onRenew}
                    alt={`${side === "before" ? l("Before", "قبل") : l("After", "بعد")}: ${photo.taken_on}`}
                    className="aspect-[3/4] w-full bg-muted"
                  />
                  <figcaption className="space-y-1 p-2 text-xs">
                    <p className="font-semibold">
                      {side === "before" ? l("Before", "قبل") : l("After", "بعد")}
                    </p>
                    <bdi className="block text-muted-foreground">{photo.taken_on}</bdi>
                  </figcaption>
                </figure>
              ))}
            </div>
          ) : (
            <>
              <div
                dir="ltr"
                className="relative mx-auto mt-4 aspect-[3/4] w-full max-w-sm overflow-hidden rounded-xl bg-muted"
              >
                <PrivatePhoto
                  key={after.id}
                  url={after.url}
                  onRenew={onRenew}
                  alt={`${l("After", "بعد")}: ${after.taken_on}`}
                  className="absolute inset-0 h-full w-full object-contain"
                />
                <div
                  className="absolute inset-0 bg-muted"
                  style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }}
                >
                  <PrivatePhoto
                    key={before.id}
                    url={before.url}
                    onRenew={onRenew}
                    alt={`${l("Before", "قبل")}: ${before.taken_on}`}
                    className="h-full w-full object-contain"
                  />
                </div>
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-y-0 w-0.5 bg-gold"
                  style={{ left: `${split}%` }}
                >
                  <span className="absolute top-1/2 -translate-x-1/2 rounded-full bg-gold px-2 py-3 text-sm font-bold text-slate-950">
                    ↔
                  </span>
                </div>
                <span className="absolute start-2 top-2 rounded bg-slate-950/80 px-2 py-1 text-xs text-white">
                  {before.taken_on}
                </span>
                <span className="absolute end-2 top-2 rounded bg-slate-950/80 px-2 py-1 text-xs text-white">
                  {after.taken_on}
                </span>
              </div>
              <label htmlFor={id} className="mt-3 block text-center text-xs text-muted-foreground">
                {l("Drag to reveal · Before / After", "اسحب للمقارنة · قبل / بعد")}
              </label>
              <input
                id={id}
                type="range"
                // Reveal geometry is physical left-to-right in both languages.
                dir="ltr"
                min={0}
                max={100}
                value={split}
                aria-valuetext={`${split}% ${l("before photo", "صورة قبل")}`}
                onChange={(e) => setSplit(Number(e.target.value))}
                className="mt-2 h-11 w-full accent-[#D4AF37]"
              />
            </>
          )}
        </>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          {l(
            "Upload two photos in the same pose to compare. Photos stay private.",
            "أضف صورتين بنفس الوضعية للمقارنة. تبقى الصور خاصة.",
          )}
        </p>
      )}
    </div>
  );
}
