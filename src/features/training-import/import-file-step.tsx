import { NativeSelect } from "@/components/ui/native-select";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";
import type { ImportOptions } from "@/lib/training-import";
export function ImportFileStep({
  options,
  busy,
  hasWorkouts,
  fileDisabled,
  configure,
  parse,
}: {
  options: ImportOptions;
  busy: boolean;
  hasWorkouts: boolean;
  fileDisabled: boolean;
  configure: (patch: Partial<ImportOptions>) => void;
  parse: (file: File) => Promise<void>;
}) {
  const { locale } = useI18n();
  const l = (en: string, ar: string) => (locale === "ar" ? ar : en);
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="min-w-0 max-w-full block">
          {l("Provider", "التطبيق")}
          <NativeSelect
            disabled={busy || hasWorkouts}
            className="mt-2"
            value={options.provider}
            onChange={(e) => configure({ provider: e.target.value as ImportOptions["provider"] })}
          >
            {["strong", "hevy", "fitnotes"].map((p) => (
              <option key={p}>{p}</option>
            ))}
          </NativeSelect>
        </label>
        <label className="min-w-0 max-w-full block">
          {l("Source units", "وحدة المصدر")}
          <NativeSelect
            className="mt-2"
            disabled={busy || hasWorkouts}
            value={options.units}
            onChange={(e) => configure({ units: e.target.value as "kg" | "lb" })}
          >
            <option>kg</option>
            <option>lb</option>
          </NativeSelect>
        </label>
        <label>
          {l("Source time zone", "المنطقة الزمنية للمصدر")}
          <Input
            disabled={busy || hasWorkouts}
            value={options.timeZone}
            onChange={(e) => configure({ timeZone: e.target.value })}
          />
        </label>
        <label className="min-w-0 max-w-full block">
          {l("Ambiguous DST time", "وقت التوقيت الصيفي الملتبس")}
          <NativeSelect
            disabled={busy || hasWorkouts}
            className="mt-2"
            value={options.ambiguity}
            onChange={(e) =>
              configure({
                ambiguity: e.target.value as ImportOptions["ambiguity"],
              })
            }
          >
            <option value="reject">{l("Ask / reject ambiguity", "رفض الالتباس")}</option>
            <option value="earlier">{l("Earlier occurrence", "الوقت الأول")}</option>
            <option value="later">{l("Later occurrence", "الوقت الثاني")}</option>
          </NativeSelect>
        </label>
      </div>
      <Input
        type="file"
        accept=".csv,text/csv"
        aria-label={l("Workout CSV file", "ملف التمارين CSV")}
        disabled={fileDisabled}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void parse(file);
        }}
      />
    </>
  );
}
