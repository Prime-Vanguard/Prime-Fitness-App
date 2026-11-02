import { useId, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { useI18n } from "@/lib/i18n";
import { referenceRevision, referenceRepository } from "@/lib/exercise-reference";
import logo from "@/assets/logo.png";
import { Button } from "./ui/button";
const mediaSchema = z
  .object({
    revision: z.literal(referenceRevision),
    previews: z
      .array(
        z
          .object({
            id: z.string().regex(/^\d{4}$/),
            image: z.string().regex(/^images\/[\w-]+\.(jpg|jpeg|png)$/),
            gif: z.string().regex(/^videos\/[\w-]+\.gif$/),
          })
          .strict(),
      )
      .max(5000),
  })
  .strict();
/** Internal visual review only. Does not approve, persist, or relabel source-media rights. */
export function ExerciseBrandPreview({ sourceId, name }: { sourceId: string; name: string }) {
  const { locale } = useI18n();
  const l = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const filterId = useId();
  const [opened, setOpened] = useState(false),
    [animated, setAnimated] = useState(false),
    [branded, setBranded] = useState(true),
    [failed, setFailed] = useState(false);
  const { data, error, isPending } = useQuery({
    queryKey: ["exercise-media-preview-paths"],
    enabled: opened,
    staleTime: Infinity,
    queryFn: async () => {
      const r = await fetch("/data/exercise-media-preview.json", { credentials: "omit" });
      if (!r.ok) throw new Error(l("Preview unavailable", "المعاينة غير متاحة"));
      return mediaSchema.parse(await r.json());
    },
  });
  const entry = data?.previews.find((p) => p.id === sourceId);
  if (!opened)
    return (
      <Button type="button" variant="outline" className="mt-3" onClick={() => setOpened(true)}>
        {l("Preview Prime Vanguard styling", "معاينة تصميم برايم فانجارد")}
      </Button>
    );
  return (
    <section
      className="mt-3 rounded-2xl border border-[#D4AF37]/50 bg-[#0F172A] p-4 text-[#F1F5F9]"
      aria-label={l("Prime Vanguard media preview", "معاينة وسائط برايم فانجارد")}
    >
      <svg width="0" height="0" className="absolute" aria-hidden="true">
        <defs>
          <filter id={filterId} colorInterpolationFilters="sRGB">
            <feColorMatrix
              in="SourceGraphic"
              type="matrix"
              values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -0.2126 -0.7152 -0.0722 1 0"
              result="ink"
            />
            <feFlood floodColor="#CBD5E1" result="silver" />
            <feComposite in="silver" in2="ink" operator="in" result="linework" />
            <feColorMatrix
              in="SourceGraphic"
              type="matrix"
              values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1 -0.5 -0.5 0 0"
              result="target"
            />
            <feComponentTransfer in="target" result="targetMask">
              <feFuncA type="linear" slope="2" />
            </feComponentTransfer>
            <feFlood floodColor="#D4AF37" result="gold" />
            <feComposite in="gold" in2="targetMask" operator="in" result="highlight" />
            <feMerge>
              <feMergeNode in="linework" />
              <feMergeNode in="highlight" />
            </feMerge>
          </filter>
        </defs>
      </svg>
      <header className="flex items-center gap-3 border-b border-[#D4AF37]/30 pb-3">
        <img src={logo} width="36" height="36" alt="Prime Vanguard" />
        <div>
          <p className="text-xs font-semibold tracking-widest text-[#D4AF37]">PRIME VANGUARD</p>
          <p className="text-xs text-[#94A3B8]">{l("TRAIN WITH PURPOSE", "تدرّب بهدف")}</p>
        </div>
      </header>
      <p className="mt-3 text-sm font-semibold">{name}</p>
      {isPending && <p role="status">{l("Loading preview…", "جارٍ تحميل المعاينة…")}</p>}
      {(error || failed) && (
        <p role="alert">
          {l(
            "Media preview unavailable. Written guidance is still available.",
            "معاينة الوسائط غير متاحة. التعليمات المكتوبة متوفرة.",
          )}
        </p>
      )}
      {entry && !failed && (
        <div className="my-4 flex justify-center rounded-xl border border-[#D4AF37]/20 bg-[#0F172A] p-3">
          <img
            width="180"
            height="180"
            referrerPolicy="no-referrer"
            src={`https://raw.githubusercontent.com/${referenceRepository}/${referenceRevision}/${animated ? entry.gif : entry.image}`}
            style={{ filter: branded ? `url(#${filterId})` : undefined }}
            alt={`${name} — ${animated ? l("animated demonstration", "عرض متحرك") : l("exercise illustration", "رسم التمرين")}`}
            onError={() => setFailed(true)}
          />
        </div>
      )}
      {entry && !failed && (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="border-[#D4AF37]/50 bg-[#1E293B] text-[#F1F5F9] hover:bg-[#334155] hover:text-white"
            onClick={() => setAnimated(!animated)}
          >
            {animated
              ? l("Stop demonstration", "إيقاف الشرح")
              : l("Play GIF", "تشغيل الرسم المتحرك")}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="border-[#D4AF37]/50 bg-[#1E293B] text-[#F1F5F9] hover:bg-[#334155] hover:text-white"
            onClick={() => setBranded(!branded)}
          >
            {branded
              ? l("Show original colors", "عرض الألوان الأصلية")
              : l("Show Vanguard colors", "عرض ألوان فانجارد")}
          </Button>
        </div>
      )}
      <p className="mt-3 text-xs text-[#94A3B8]">
        © Gym visual —{" "}
        <a className="underline" href="https://gymvisual.com/" target="_blank" rel="noreferrer">
          gymvisual.com
        </a>
      </p>
      <p className="mt-1 text-xs text-[#D4AF37]">
        {l(
          "Internal design preview · separately licensed media · not approved for member publication.",
          "معاينة داخلية للتصميم · ترخيص منفصل للوسائط · غير معتمد للنشر للأعضاء.",
        )}
      </p>
    </section>
  );
}
