import { NativeSelect } from "@/components/ui/native-select";
import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useMemberData } from "@/hooks/use-member-data";
import { useTrainingFeatures } from "@/hooks/use-training-features";
import { useUnits } from "@/hooks/use-units";
import { useI18n } from "@/lib/i18n";
import { activityDay, addDays } from "@/lib/dates";
import { inputNumber } from "@/lib/numeric-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { activities, cardioData, cardioPace, type CardioRecord } from "./model";
import {
  cardioState,
  fetchCardio,
  mergeCardioHistory,
  resolveCardio,
  retryCardio,
  saveCardio,
} from "./store";
import { activityNames as names } from "./activity-labels";
import { HiitTimer } from "./hiit-timer";
import { CardioConflict } from "./cardio-conflict";
const blank = () => ({
  activity: "run",
  log_date: activityDay(),
  minutes: "",
  distance: "",
  incline: "",
  resistance: "",
  heart: "",
  notes: "",
});
export function CardioPanel({
  userId,
  progressOnly = false,
}: {
  userId: string;
  progressOnly?: boolean;
}) {
  const { data: features } = useTrainingFeatures(userId);
  if (!features?.cardio) return null;
  return <CardioContent key={userId} userId={userId} progressOnly={progressOnly} />;
}
function CardioContent({ userId, progressOnly }: { userId: string; progressOnly: boolean }) {
  const { locale } = useI18n();
  const l = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const units = useUnits(userId),
    { state, error: localError } = useMemberData(userId),
    local = cardioState(state.references);
  const remote = useQuery({
    queryKey: ["cardio-history", userId],
    queryFn: () => fetchCardio(userId),
    staleTime: 30000,
  });
  const records = mergeCardioHistory(remote.data ?? [], local);
  const [form, setForm] = useState(blank),
    [editing, setEditing] = useState<CardioRecord | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [filter, setFilter] = useState("all");
  const locked = useRef(false);
  const filtered = records.filter((r) => filter === "all" || r.activity === filter);
  const recent = filtered.filter((r) => r.log_date >= addDays(activityDay(), -6));
  const distanceUnit = units === "imperial" ? "mi" : "km",
    factor = units === "imperial" ? 1609.344 : 1000;
  async function action(fn: () => Promise<unknown>) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      locked.current = false;
    }
  }
  function edit(row: CardioRecord) {
    setEditing(row);
    setForm({
      activity: row.activity,
      log_date: row.log_date,
      minutes: String(row.duration_seconds / 60),
      distance: row.distance_m == null ? "" : String(row.distance_m / factor),
      incline: row.incline_pct == null ? "" : String(row.incline_pct),
      resistance: row.resistance ?? "",
      heart: row.heart_rate == null ? "" : String(row.heart_rate),
      notes: row.notes,
    });
  }
  function exportLocal() {
    const url = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify(
            { version: 1, member_id: userId, cardio: local, history: records },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "prime-fitness-cardio-recovery.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <details className="my-5 rounded-xl border border-gold/30 p-4" open={progressOnly}>
      <summary className="min-h-11 cursor-pointer font-semibold">
        {l("Cardio & HIIT", "الكارديو وHIIT")}
      </summary>
      <div className="mt-4 space-y-4">
        <p className="text-sm">
          {l(
            "Separate from strength volume and 1RM. Cardio does not award XP or estimate calories; shared challenges use recorded activity.",
            "منفصل عن حجم تمارين القوة و1RM. لا يمنح الكارديو XP ولا يقدّر السعرات؛ تستخدم التحديات النشاط المسجل.",
          )}
        </p>
        <p className="text-xs text-muted-foreground">
          {l(
            "Offline: seven cached days plus every unsynced change. Older history needs a connection.",
            "دون اتصال: سبعة أيام مخزنة وكل التغييرات غير المتزامنة. يحتاج السجل الأقدم إلى اتصال.",
          )}{" "}
          {local.lastSync && new Date(local.lastSync).toLocaleString()}
        </p>
        <div className="grid grid-cols-3 gap-2 text-center">
          <p>
            {recent.length}
            <br />
            {l("sessions / 7 days", "جلسات / ٧ أيام")}
          </p>
          <p>
            {Math.round(recent.reduce((s, r) => s + r.duration_seconds, 0) / 60)}
            <br />
            {l("minutes", "دقائق")}
          </p>
          <p>
            {(recent.reduce((s, r) => s + (r.distance_m ?? 0), 0) / factor).toFixed(2)}
            <br />
            {distanceUnit}
          </p>
        </div>
        <div
          className="flex h-24 items-end gap-2"
          role="img"
          aria-label={l(
            "Daily cardio minutes over seven days",
            "دقائق الكارديو اليومية خلال سبعة أيام",
          )}
        >
          {Array.from({ length: 7 }, (_, i) => {
            const date = addDays(activityDay(), i - 6),
              minutes =
                recent
                  .filter((r) => r.log_date === date)
                  .reduce((s, r) => s + r.duration_seconds, 0) / 60;
            return (
              <div
                key={date}
                className="flex h-full flex-1 flex-col justify-end text-center text-[10px]"
              >
                <span>{Math.round(minutes)}</span>
                <div
                  className="min-h-1 rounded bg-gold"
                  style={{ height: `${Math.min(70, minutes)}%` }}
                />
                <span>{date.slice(5)}</span>
              </div>
            );
          })}
        </div>
        {!progressOnly && (
          <>
            <HiitTimer userId={userId} timer={local.timer} />
            <form
              className="space-y-3 rounded-xl border p-4"
              onSubmit={(e) => {
                e.preventDefault();
                void action(async () => {
                  const number = (value: string, label: string, max: number) =>
                    inputNumber(value, { label, max });
                  const minutes = number(form.minutes, "Minutes", 1440);
                  if (minutes == null) throw new Error("Enter duration");
                  const distance = number(form.distance, "Distance", 1000000 / factor);
                  const value = cardioData.parse({
                    activity: form.activity,
                    log_date: form.log_date,
                    duration_seconds:
                      editing?.activity === "hiit"
                        ? editing.duration_seconds
                        : Math.round(minutes * 60),
                    distance_m: distance == null ? null : distance * factor,
                    incline_pct: form.incline.trim()
                      ? inputNumber(form.incline, { label: "Incline", min: -20, max: 40 })
                      : null,
                    resistance: form.resistance || null,
                    heart_rate: form.heart.trim()
                      ? inputNumber(form.heart, {
                          label: "Heart rate",
                          min: 30,
                          max: 240,
                          integer: true,
                        })
                      : null,
                    notes: form.notes,
                    intervals: editing?.intervals ?? null,
                  });
                  await saveCardio(userId, value, editing?.id, editing?.revision);
                  setEditing(null);
                  setForm(blank());
                });
              }}
            >
              <h3 className="font-semibold">
                {editing ? l("Edit cardio", "تعديل الكارديو") : l("Log cardio", "تسجيل الكارديو")}
              </h3>
              <label className="block min-w-0 max-w-full">
                {l("Activity", "النشاط")}
                <NativeSelect
                  disabled={busy || editing?.activity === "hiit"}
                  className="mt-2"
                  value={form.activity}
                  onChange={(e) => setForm((v) => ({ ...v, activity: e.target.value }))}
                >
                  {activities
                    .filter((a) => a !== "hiit" || editing?.activity === "hiit")
                    .map((a) => (
                      <option key={a} value={a}>
                        {names[a][locale === "ar" ? 1 : 0]}
                      </option>
                    ))}
                </NativeSelect>
              </label>
              {(
                [
                  ["log_date", l("Activity date", "تاريخ النشاط")],
                  ["minutes", l("Duration (minutes)", "المدة (دقائق)")],
                  ["distance", `${l("Distance", "المسافة")} (${distanceUnit})`],
                  ["incline", l("Incline (%) — optional", "الميل (%) — اختياري")],
                  ["resistance", l("Resistance — optional", "المقاومة — اختياري")],
                  ["heart", l("Average heart rate — optional", "متوسط النبض — اختياري")],
                  ["notes", l("Notes", "ملاحظات")],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="block text-sm">
                  {label}
                  <Input
                    disabled={busy || (key === "minutes" && editing?.activity === "hiit")}
                    type={key === "log_date" ? "date" : "text"}
                    inputMode={
                      ["minutes", "distance", "incline", "heart"].includes(key) ? "decimal" : "text"
                    }
                    max={key === "log_date" ? activityDay() : undefined}
                    value={form[key]}
                    onChange={(e) => setForm((v) => ({ ...v, [key]: e.target.value }))}
                  />
                </label>
              ))}
              <Button disabled={busy}>
                {l("Save cardio on this device", "حفظ الكارديو على الجهاز")}
              </Button>
              {editing && (
                <Button
                  type="button"
                  disabled={busy}
                  variant="outline"
                  onClick={() => {
                    setEditing(null);
                    setForm(blank());
                  }}
                >
                  {l("Cancel edit", "إلغاء التعديل")}
                </Button>
              )}
            </form>
          </>
        )}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void action(() => retryCardio(userId))}>
            {l("Retry cardio sync", "إعادة مزامنة الكارديو")} ({local.queue.length})
          </Button>
          <Button variant="outline" onClick={exportLocal}>
            {l("Export cardio recovery", "تصدير استعادة الكارديو")}
          </Button>
          <Button variant="outline" onClick={() => void remote.refetch()}>
            {l("Refresh history", "تحديث السجل")}
          </Button>
        </div>
        {local.queue
          .filter((q) => q.status !== "queued" || q.error)
          .map((q) => (
            <div key={q.id} role="alert" className="rounded border border-amber-500/40 p-3 text-sm">
              <p>{q.error}</p>
              {q.status === "conflict" && (
                <>
                  <CardioConflict
                    local={local.records.find((r) => r.id === q.record_id)}
                    server={q.server}
                    units={units}
                  />
                  <Button
                    variant="outline"
                    onClick={() => void action(() => resolveCardio(userId, q.id, false))}
                  >
                    {l("Keep server", "الاحتفاظ بالخادم")}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => void action(() => resolveCardio(userId, q.id, true))}
                  >
                    {l("Submit local against latest revision", "إرسال المحلي مقابل أحدث نسخة")}
                  </Button>
                </>
              )}
            </div>
          ))}
        {(error || localError || remote.error) && (
          <p role="alert" className="text-sm text-destructive">
            {error || localError || remote.error?.message}
          </p>
        )}
        <label className="block min-w-0 max-w-sm text-sm">
          {l("History activity filter", "تصفية نشاط السجل")}
          <NativeSelect className="mt-2" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">{l("All", "الكل")}</option>
            {activities.map((a) => (
              <option key={a} value={a}>
                {names[a][locale === "ar" ? 1 : 0]}
              </option>
            ))}
          </NativeSelect>
        </label>
        <ul className="space-y-3">
          {filtered.map((row) => {
            const pace = cardioPace(row.duration_seconds, row.distance_m, units);
            return (
              <li className="rounded border p-3 text-sm" key={row.id}>
                <p>
                  {names[row.activity][locale === "ar" ? 1 : 0]} · {row.log_date} ·{" "}
                  {(row.duration_seconds / 60).toFixed(1)} {l("min", "د")}
                </p>
                {pace && (
                  <p>
                    {((row.distance_m ?? 0) / factor).toFixed(2)} {distanceUnit} ·{" "}
                    {pace.speed.toFixed(1)} {distanceUnit}/h · {pace.pace} /{distanceUnit}
                  </p>
                )}
                {row.heart_rate && <p>{row.heart_rate} bpm</p>}
                {row.notes && <p className="whitespace-pre-wrap">{row.notes}</p>}
                {!progressOnly && (
                  <div className="flex gap-2">
                    <Button variant="outline" disabled={busy} onClick={() => edit(row)}>
                      {l("Edit", "تعديل")}
                    </Button>
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() => {
                        if (window.confirm(l("Delete this cardio entry?", "حذف سجل الكارديو؟")))
                          void action(() => saveCardio(userId, null, row.id, row.revision));
                      }}
                    >
                      {l("Delete", "حذف")}
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </details>
  );
}
