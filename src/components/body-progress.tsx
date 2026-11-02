import { useRef, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUnits } from "@/hooks/use-units";
import { useTrainingFeatures } from "@/hooks/use-training-features";
import { useMemberData, retainMemberRows, beginMemberRead } from "@/hooks/use-member-data";
import { useActivityDay } from "@/hooks/use-activity-day";
import { useI18n } from "@/lib/i18n";
import { queueMemberWrites, syncMemberEntries } from "@/lib/member-store";
import { bodyInput } from "@/lib/numeric-input";
import { displayWeight, displayLength, weightUnit, lengthUnit, formatMeasure } from "@/lib/units";
import { overlayPendingRecords } from "@/lib/member-records";
import { validActivityDate } from "@/lib/training-search";
import { fetchAll } from "@/lib/pagination";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "./ui/sheet";
import { DeferredProgressChart } from "./deferred-progress-chart";
import { saveNativeMeasurement } from "@/lib/measurement-write";

export function BodyProgress({ userId }: { userId: string }) {
  const { t, locale } = useI18n(),
    ar = locale === "ar",
    l = (en: string, arabic: string) => (ar ? arabic : en);
  const units = useUnits(userId),
    today = useActivityDay(),
    qc = useQueryClient();
  const { data: features } = useTrainingFeatures(userId),
    { state: local } = useMemberData(userId);
  const [open, setOpen] = useState(false),
    [day, setDay] = useState(today),
    [entryUnits, setEntryUnits] = useState(units),
    [f, setF] = useState({ weight_kg: "", waist_cm: "", body_fat_pct: "" }),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false),
    [metric, setMetric] = useState<"weight_kg" | "waist_cm" | "body_fat_pct">("weight_kg"),
    [saved, setSaved] = useState("");
  const lock = useRef(false),
    dirty = Object.values(f).some((value) => value !== "");
  const key = ["body", userId];
  const draftIdentity = useRef<{ signature: string; id: string } | null>(null);
  const query = useQuery({
    queryKey: [...key, !!features?.offline],
    enabled: !features?.offline || navigator.onLine,
    queryFn: async () => {
      const cacheToken = features?.offline ? await beginMemberRead(userId) : {};
      const rows = await fetchAll(
        (from, to) =>
          supabase
            .from("body_measurements")
            .select("*")
            .eq("member_id", userId)
            .order("measured_on")
            .order("id")
            .range(from, to),
        (r) => r.id,
      );
      if (features?.offline) await retainMemberRows(userId, "body_measurements", rows, cacheToken);
      return rows;
    },
  });
  const cached = (local.records.body_measurements ?? []) as NonNullable<typeof query.data>;
  const rows = features?.offline
    ? navigator.onLine && query.data
      ? overlayPendingRecords(
          query.data,
          cached,
          local.queue.filter((m) => m.entity === "body_measurements"),
        )
      : cached
    : (query.data ?? []);
  const ordered = rows
    .slice()
    .sort((a, b) => b.measured_on.localeCompare(a.measured_on) || b.id.localeCompare(a.id));
  const pending = new Map(
    local.queue.filter((m) => m.entity === "body_measurements").map((m) => [m.record_id, m.status]),
  );
  const unit =
    metric === "body_fat_pct"
      ? "%"
      : metric === "weight_kg"
        ? weightUnit(units)
        : lengthUnit(units);
  const label =
    metric === "weight_kg" ? t("weight") : metric === "waist_cm" ? t("waist") : t("bodyFat");
  const value = (row: (typeof ordered)[number], field: typeof metric) =>
    row[field] == null
      ? null
      : formatMeasure(
          field === "weight_kg"
            ? displayWeight(Number(row[field]), units)
            : field === "waist_cm"
              ? displayLength(Number(row[field]), units)
              : Number(row[field]),
        );
  const series = ordered
    .filter((row) => row[metric] != null)
    .slice()
    .reverse()
    .map((row) => ({ date: row.measured_on, value: value(row, metric)! }));
  function begin() {
    if (!dirty) {
      setDay(today);
      setEntryUnits(units);
    }
    setSaved("");
    setOpen(true);
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setSaving(true);
    setError("");
    try {
      if (!validActivityDate(day) || day > today)
        throw new Error(
          l(
            "Choose a valid measurement date, today or earlier.",
            "اختر تاريخ قياس صحيحًا لا يتجاوز اليوم.",
          ),
        );
      const values = bodyInput(f, entryUnits),
        signature = JSON.stringify({ member_id: userId, measured_on: day, ...values });
      if (draftIdentity.current?.signature !== signature)
        draftIdentity.current = { signature, id: crypto.randomUUID() };
      const payload = {
        id: draftIdentity.current.id,
        member_id: userId,
        measured_on: day,
        ...values,
      };
      if (features?.offline) {
        await queueMemberWrites(userId, [
          { entity: "body_measurements", op: "put", record: payload },
        ]);
        void syncMemberEntries(userId).catch(() => {});
      } else {
        await saveNativeMeasurement(userId, payload);
      }
      setF({ weight_kg: "", waist_cm: "", body_fat_pct: "" });
      draftIdentity.current = null;
      setOpen(false);
      setSaved(l("Measurement saved", "تم حفظ القياس"));
      await qc.invalidateQueries({ queryKey: key });
    } catch (cause) {
      setError(
        (cause as { message?: string } | null)?.message ??
          l("Could not save the measurement.", "تعذر حفظ القياس."),
      );
    } finally {
      lock.current = false;
      setSaving(false);
    }
  }
  return (
    <section className="mt-6 rounded-xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg font-bold">{t("body")}</h2>
        <Button onClick={begin}>{l("Add measurements", "إضافة قياسات")}</Button>
      </div>
      {saved && (
        <p role="status" className="mt-3 text-sm">
          {saved}
        </p>
      )}
      {query.error && (
        <p role="alert" className="mt-3 text-sm">
          {l(
            "Could not load online measurements. Device entries remain available.",
            "تعذر تحميل القياسات عبر الإنترنت. تظل سجلات الجهاز متاحة.",
          )}
          <Button variant="outline" onClick={() => void query.refetch()}>
            {l("Retry measurements", "إعادة تحميل القياسات")}
          </Button>
        </p>
      )}
      {query.isPending && !features?.offline && (
        <p role="status">{l("Loading measurements…", "جارٍ تحميل القياسات…")}</p>
      )}
      {features?.offline && (
        <p className="mt-2 text-xs text-muted-foreground">
          {l(
            "Device entries may be incomplete offline. Pending changes are kept until synchronized.",
            "قد تكون سجلات الجهاز غير مكتملة دون اتصال. تُحفظ التغييرات المعلقة حتى المزامنة.",
          )}
        </p>
      )}
      <label className="mt-4 block text-sm">
        {l("Measurement trend", "اتجاه القياسات")}
        <select
          value={metric}
          aria-label={l("Measurement trend", "اتجاه القياسات")}
          onChange={(event) => setMetric(event.target.value as typeof metric)}
          className="mt-1 h-11 w-full rounded-md border bg-background px-3"
        >
          <option value="weight_kg">{t("weight")}</option>
          <option value="waist_cm">{t("waist")}</option>
          <option value="body_fat_pct">{t("bodyFat")}</option>
        </select>
      </label>
      {series.length > 1 && <DeferredProgressChart series={series} label={label} unit={unit} />}
      {!ordered.length && !query.isPending && !query.error && (
        <p className="mt-4 text-sm text-muted-foreground">
          {l(
            "No measurements available. Add your first entry to start a trend.",
            "لا توجد قياسات متاحة. أضف أول سجل لبدء المتابعة.",
          )}
        </p>
      )}
      {!!ordered.length && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-start text-sm">
            <caption className="mb-2 text-start text-xs text-muted-foreground">
              {l(
                "Measurement history · blank values were not recorded.",
                "سجل القياسات · القيم الفارغة لم تُسجّل.",
              )}
            </caption>
            <thead>
              <tr>
                {[
                  l("Date", "التاريخ"),
                  `${t("weight")} (${weightUnit(units)})`,
                  `${t("waist")} (${lengthUnit(units)})`,
                  `${t("bodyFat")} (%)`,
                  l("Status", "الحالة"),
                ].map((text) => (
                  <th key={text} className="px-2 py-2 text-start">
                    {text}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ordered.map((row) => (
                <tr key={row.id} className="border-t">
                  <td className="whitespace-nowrap p-2">
                    <bdi>{row.measured_on}</bdi>
                  </td>
                  <td className="p-2">{value(row, "weight_kg") ?? "—"}</td>
                  <td className="p-2">{value(row, "waist_cm") ?? "—"}</td>
                  <td className="p-2">{value(row, "body_fat_pct") ?? "—"}</td>
                  <td className="p-2">
                    {pending.get(row.id) === "conflict"
                      ? l("Conflict · needs review", "تعارض · يحتاج إلى مراجعة")
                      : pending.get(row.id) === "rejected"
                        ? l("Rejected · kept on device", "مرفوض · محفوظ على الجهاز")
                        : pending.has(row.id)
                          ? l("Pending sync", "بانتظار المزامنة")
                          : l("Saved", "محفوظ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Sheet
        open={open}
        onOpenChange={(next) => {
          if (!lock.current) setOpen(next);
        }}
      >
        <SheetContent
          side={ar ? "left" : "right"}
          className="w-full overflow-y-auto sm:max-w-lg"
          dir={ar ? "rtl" : "ltr"}
        >
          <SheetHeader>
            <SheetTitle>{l("Add measurements", "إضافة قياسات")}</SheetTitle>
            <SheetDescription>
              {l(
                "Record any available measurement. Closing this sheet keeps your draft while you stay on this page.",
                "سجّل القياسات المتاحة. تبقى المسودة عند إغلاق اللوحة ما دمت في هذه الصفحة.",
              )}
            </SheetDescription>
          </SheetHeader>
          <form onSubmit={save} className="mt-5 space-y-4">
            <fieldset disabled={saving} className="space-y-4">
              <label className="block text-sm">
                {l("Measurement date · Cairo", "تاريخ القياس · القاهرة")}
                <Input
                  type="date"
                  value={day}
                  max={today}
                  onChange={(event) => setDay(event.target.value)}
                />
              </label>
              <p className="text-sm text-muted-foreground">
                {l("Entry units", "وحدات الإدخال")}: {weightUnit(entryUnits)} /{" "}
                {lengthUnit(entryUnits)}
              </p>
              {(
                [
                  ["weight_kg", `${t("weight")} ${weightUnit(entryUnits)}`],
                  ["waist_cm", `${t("waist")} ${lengthUnit(entryUnits)}`],
                  ["body_fat_pct", `${t("bodyFat")} %`],
                ] as const
              ).map(([field, text]) => (
                <label key={field} className="block text-sm">
                  {text}
                  <Input
                    inputMode="decimal"
                    aria-label={text}
                    value={f[field]}
                    onChange={(event) => setF({ ...f, [field]: event.target.value })}
                    aria-invalid={!!error}
                    aria-describedby={error ? "body-input-error" : undefined}
                  />
                </label>
              ))}
              {error && (
                <p id="body-input-error" role="alert" className="text-sm text-destructive">
                  {ar ? "تعذر الحفظ. تحقق من القياسات والتاريخ وأعد المحاولة." : error}
                </p>
              )}
              <Button type="submit" disabled={saving}>
                {saving ? "…" : t("addMeasurement")}
              </Button>
            </fieldset>
          </form>
        </SheetContent>
      </Sheet>
    </section>
  );
}
