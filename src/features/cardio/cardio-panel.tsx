import { SelectionIndicator } from "@/components/selection-indicator";
import { NativeSelect } from "@/components/ui/native-select";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useMemberData } from "@/hooks/use-member-data";
import { useTrainingFeatures } from "@/hooks/use-training-features";
import { useUnits } from "@/hooks/use-units";
import { useI18n } from "@/lib/i18n";
import { activityDay } from "@/lib/dates";
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
import { MemberSections } from "@/components/member-sections";
import { CardioSummary } from "./cardio-summary";
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
  const [mode, setMode] = useState<"cardio" | "hiit">("hiit");
  const [historyOpen, setHistoryOpen] = useState(false);
  const historyDisclosure = useRef<HTMLDetailsElement>(null);
  const locked = useRef(false);
  const entryForm = useRef<HTMLFormElement>(null);
  const errorMessage = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (editing) {
      entryForm.current?.scrollIntoView({ block: "start" });
      entryForm.current
        ?.querySelector<HTMLInputElement>("input:not(:disabled)")
        ?.focus({ preventScroll: true });
    }
  }, [editing]);
  useEffect(() => {
    if (error) errorMessage.current?.scrollIntoView({ block: "nearest" });
  }, [error]);
  const filtered = records.filter((r) => filter === "all" || r.activity === filter);
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
    setHistoryOpen(false);
    setMode("cardio");
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
  const summary = (compact = false) => (
    <CardioSummary
      records={records}
      units={units}
      available={remote.data !== undefined || local.lastSync !== null || records.length > 0}
      loading={remote.isPending && remote.fetchStatus === "fetching"}
      compact={compact}
    />
  );
  const history = (
    <div className="space-y-4 pt-3">
      <p className="text-xs leading-5 text-muted-foreground">
        {l(
          "Offline: seven cached days plus every unsynced change. Older history needs a connection.",
          "دون اتصال: سبعة أيام مخزنة وكل التغييرات غير المتزامنة. يحتاج السجل الأقدم إلى اتصال.",
        )}{" "}
        {local.lastSync &&
          new Date(local.lastSync).toLocaleString(locale === "ar" ? "ar-EG-u-nu-latn" : "en-GB")}
      </p>
      <p className="text-xs leading-5 text-muted-foreground">
        {l(
          "Separate from strength volume and 1RM. Cardio does not award XP or estimate calories; shared challenges use recorded activity.",
          "منفصل عن حجم تمارين القوة و1RM. لا يمنح الكارديو XP ولا يقدّر السعرات؛ تستخدم التحديات النشاط المسجل.",
        )}
      </p>
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
      <h2 className="font-heading text-xl font-bold">{l("Cardio history", "سجل الكارديو")}</h2>
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
      {remote.isPending && (
        <p role="status" className="text-sm text-muted-foreground">
          {l(
            remote.fetchStatus === "paused"
              ? "Older history is unavailable offline; device entries remain available."
              : "Loading history; device entries remain available.",
            remote.fetchStatus === "paused"
              ? "السجل الأقدم غير متاح دون اتصال؛ تبقى إدخالات الجهاز متاحة."
              : "جارٍ تحميل السجل؛ تبقى إدخالات الجهاز متاحة.",
          )}
        </p>
      )}
      {!remote.isPending && !remote.error && !filtered.length && (
        <p className="rounded-xl bg-card p-4 text-sm text-muted-foreground">
          {l("No recorded sessions for this activity yet.", "لا توجد جلسات مسجلة لهذا النشاط بعد.")}
        </p>
      )}
      <ul className="space-y-3">
        {filtered.map((row) => {
          const pace = cardioPace(row.duration_seconds, row.distance_m, units);
          return (
            <li
              className="space-y-2 rounded-xl border border-border bg-card p-4 text-sm"
              key={row.id}
            >
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
                <div className="flex flex-wrap gap-2">
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
  );
  return (
    <section
      className="my-5 space-y-4"
      aria-label={l("Cardio training", "تدريب الكارديو")}
      data-stitch-cardio
    >
      {!progressOnly && (
        <MemberSections
          label={l("Cardio workout type", "نوع تمرين الكارديو")}
          appearance="segmented"
          value={mode}
          items={[
            ["hiit", l("HIIT intervals", "فترات HIIT")],
            ["cardio", l("Steady-state cardio", "كارديو مستمر")],
          ]}
          onSelect={setMode}
        />
      )}
      <div className="space-y-4">
        {!progressOnly && (
          <>
            <div hidden={mode !== "hiit"}>
              <HiitTimer userId={userId} timer={local.timer} summary={summary(true)} />
            </div>
            <div hidden={mode !== "cardio"}>
              <form
                ref={entryForm}
                className="space-y-4 rounded-xl border border-border bg-card p-4"
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
                    setHistoryOpen(true);
                  });
                }}
              >
                <h2 className="font-heading text-xl font-bold">
                  {editing ? l("Edit cardio", "تعديل الكارديو") : l("Log cardio", "تسجيل الكارديو")}
                </h2>
                <fieldset className="min-w-0" disabled={busy || editing?.activity === "hiit"}>
                  <legend className="mb-2 text-xs text-muted-foreground">
                    {l("Activity", "النشاط")}
                  </legend>
                  <div className="sliding-selection flex gap-2 overflow-x-auto pb-2">
                    {/* Selection follows the form; an animation never creates a cardio record. */}
                    <SelectionIndicator />
                    {activities
                      .filter((a) => a !== "hiit" || editing?.activity === "hiit")
                      .map((a) => (
                        <Button
                          key={a}
                          type="button"
                          variant="secondary"
                          aria-pressed={form.activity === a}
                          className={
                            "min-h-11 shrink-0 border px-3 " +
                            (form.activity === a
                              ? "border-gold bg-raised text-foreground"
                              : "border-border bg-background text-muted-foreground")
                          }
                          onClick={() => setForm((v) => ({ ...v, activity: a }))}
                        >
                          {names[a][locale === "ar" ? 1 : 0]}
                        </Button>
                      ))}
                  </div>
                </fieldset>
                <div className="grid grid-cols-2 gap-3">
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
                    <label
                      key={key}
                      className={
                        "block min-w-0 text-sm text-muted-foreground " +
                        (["notes", "log_date", "resistance"].includes(key) ? "col-span-2" : "")
                      }
                    >
                      {label}
                      <Input
                        className="mt-2 bg-background text-foreground"
                        dir={
                          ["minutes", "distance", "incline", "heart", "log_date"].includes(key)
                            ? "ltr"
                            : undefined
                        }
                        disabled={busy || (key === "minutes" && editing?.activity === "hiit")}
                        type={key === "log_date" ? "date" : "text"}
                        inputMode={
                          ["minutes", "distance", "incline", "heart"].includes(key)
                            ? "decimal"
                            : "text"
                        }
                        max={key === "log_date" ? activityDay() : undefined}
                        value={form[key]}
                        onChange={(e) => setForm((v) => ({ ...v, [key]: e.target.value }))}
                      />
                    </label>
                  ))}
                </div>
                <Button disabled={busy} className="min-h-12 w-full">
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
            </div>
          </>
        )}
        {(progressOnly || mode === "cardio") && summary(!progressOnly)}

        {(error || localError || remote.error) && (
          <p
            ref={errorMessage}
            role="alert"
            className="rounded-lg border border-destructive/40 p-3 text-sm text-destructive"
          >
            {error || localError || remote.error?.message}
          </p>
        )}

        {!progressOnly && local.queue.some((q) => q.status !== "queued" || q.error) && (
          <div
            role="status"
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/40 p-3 text-sm"
          >
            <span>
              {l(
                "Some cardio entries need sync review.",
                "تحتاج بعض إدخالات الكارديو إلى مراجعة المزامنة.",
              )}
            </span>
            <Button
              variant="outline"
              onClick={() => {
                setHistoryOpen(true);
                requestAnimationFrame(() =>
                  historyDisclosure.current?.scrollIntoView({ block: "start" }),
                );
              }}
            >
              {l("Review cardio sync", "مراجعة مزامنة الكارديو")}
            </Button>
          </div>
        )}
        {progressOnly ? (
          history
        ) : (
          <details
            ref={historyDisclosure}
            open={historyOpen}
            onToggle={(event) => setHistoryOpen(event.currentTarget.open)}
            className="rounded-xl border border-border bg-card p-4"
            data-cardio-history
          >
            <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold">
              {l("History & sync", "السجل والمزامنة")}{" "}
              <span className="text-muted-foreground">
                · {local.queue.length} {l("pending", "معلق")}
              </span>
            </summary>
            {summary(false)}
            {history}
          </details>
        )}
      </div>
    </section>
  );
}
