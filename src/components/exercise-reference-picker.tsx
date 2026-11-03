import { useState } from "react";
import { appPath } from "@/lib/app-path";
import { useQuery } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";
import {
  referenceSchema,
  searchReferences,
  referenceSourceUrl,
  type ExerciseReference,
} from "@/lib/exercise-reference";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { ExerciseBrandPreview } from "./exercise-brand-preview";
export function ExerciseReferencePicker({
  exerciseName,
  onChoose,
}: {
  exerciseName: string;
  onChoose: (row: ExerciseReference) => void;
}) {
  const { locale } = useI18n();
  const l = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState(exerciseName),
    [selected, setSelected] = useState<ExerciseReference | null>(null);
  const { data, error, isPending } = useQuery({
    queryKey: ["exercise-text-reference"],
    enabled: open,
    staleTime: Infinity,
    queryFn: async () => {
      const response = await fetch(appPath("data/exercise-reference.json"), {
        credentials: "omit",
      });
      if (!response.ok)
        throw new Error(l("Reference library unavailable", "المكتبة المرجعية غير متاحة"));
      return referenceSchema.parse(await response.json());
    },
  });
  const matches = data ? searchReferences(data.exercises, query) : [];
  return (
    <details
      onToggle={(e) => setOpen(e.currentTarget.open)}
      className="rounded-xl border border-gold/30 bg-card p-3"
    >
      <summary className="cursor-pointer font-medium">
        {l("Use MIT exercise text library", "استخدام مكتبة نصوص التمارين بترخيص MIT")}
      </summary>
      <p className="my-2 text-sm text-muted-foreground">
        {l(
          "Text and metadata only. Select the exact movement; review the equipment, load convention and existing translations before saving. Images and GIFs require separate rights.",
          "نصوص وبيانات فقط. اختر الحركة المطابقة وراجع الأدوات وطريقة الوزن والترجمات الحالية قبل الحفظ. الصور والرسوم المتحركة تتطلب ترخيصاً منفصلاً.",
        )}
      </p>
      {open && (
        <>
          <Input
            aria-label={l("Search reference exercises", "البحث في التمارين المرجعية")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {isPending && (
            <p role="status">{l("Loading reference library…", "جارٍ تحميل المكتبة…")}</p>
          )}
          {error && <p role="alert">{error.message}</p>}
          {data && (
            <p className="my-2 text-xs">
              {matches.length} / {data.exercises.length} ·{" "}
              {l(
                "Showing up to 40 matches; narrow your search.",
                "نعرض حتى ٤٠ نتيجة؛ حدد البحث أكثر.",
              )}
            </p>
          )}
          <ul className="max-h-56 overflow-auto divide-y">
            {matches.slice(0, 40).map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  className="w-full rounded p-2 text-start hover:bg-muted focus-visible:ring-2 focus-visible:ring-gold"
                  aria-label={`${l("Preview reference", "معاينة المرجع")}: ${row.name}`}
                  onClick={() => setSelected(row)}
                >
                  {row.name}
                  <span className="block text-xs text-muted-foreground">
                    {row.equipment} · {row.target}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {selected && (
            <div className="mt-3 rounded-lg border border-gold/40 p-3">
              <h4 className="font-semibold">{selected.name}</h4>
              <p className="text-xs">
                {selected.equipment} · {selected.target} · {selected.body_part}
              </p>
              <ExerciseBrandPreview key={selected.id} sourceId={selected.id} name={selected.name} />
              <ol className="my-3 list-inside list-decimal space-y-2 text-sm">
                {selected.steps_en.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
              <Button type="button" onClick={() => onChoose(selected)}>
                {l("Use draft English guidance", "استخدام الشرح الإنجليزي كمسودة")}
              </Button>
            </div>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            © 2026 Hasan Emir Yıldırım ·{" "}
            <a className="underline" href={referenceSourceUrl} target="_blank" rel="noreferrer">
              {l("Dataset source", "مصدر البيانات")}
            </a>{" "}
            ·{" "}
            <a
              className="underline"
              href={appPath("legal/exercise-dataset-LICENSE.txt")}
              target="_blank"
              rel="noreferrer"
            >
              MIT
            </a>
          </p>
        </>
      )}
    </details>
  );
}
