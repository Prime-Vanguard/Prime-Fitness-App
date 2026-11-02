import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { parseVersionItems, type VersionItem } from "@/lib/program-versions";
import { policyDraft, preparePolicy, type PolicyDraft, type PolicyRow } from "@/lib/coach-policy";
import { saveCoachPolicy, saveCoachSchedule, type Schedule } from "@/lib/coach-training-write";
import { activityDay } from "@/lib/dates";
import { validActivityDate } from "@/lib/training-search";
import { fetchAll } from "@/lib/pagination";
import { trainingLabel } from "@/lib/training-labels";
import { useI18n } from "@/lib/i18n";
import { useTrainingFeatures } from "@/hooks/use-training-features";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "./ui/sheet";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "./ui/alert-dialog";

async function loadControls(member: string) {
  const assignment = await supabase
    .from("program_assignments")
    .select("id,program_version_id")
    .eq("member_id", member)
    .eq("active", true)
    .maybeSingle();
  if (assignment.error) throw assignment.error;
  if (!assignment.data) return null;
  const [version, policies, schedule, person] = await Promise.all([
    supabase
      .from("program_versions")
      .select("*")
      .eq("id", assignment.data.program_version_id)
      .single(),
    fetchAll(
      (from, to) =>
        supabase
          .from("training_policies")
          .select("*")
          .eq("member_id", member)
          .eq("program_version_id", assignment.data!.program_version_id)
          .order("id")
          .range(from, to),
      (row) => row.id,
    ),
    supabase
      .from("program_schedules")
      .select("mode,start_date")
      .eq("assignment_id", assignment.data.id)
      .eq("member_id", member)
      .maybeSingle(),
    supabase.from("profiles").select("display_name,email").eq("id", member).maybeSingle(),
  ]);
  if (version.error) throw version.error;
  if (schedule.error) throw schedule.error;
  if (person.error) throw person.error;
  return {
    assignment: assignment.data,
    version: version.data,
    items: parseVersionItems(version.data.items),
    policies,
    schedule: schedule.data,
    memberName: person.data?.display_name || person.data?.email || "",
  };
}
type Controls = NonNullable<Awaited<ReturnType<typeof loadControls>>>;
type Draft = { form: PolicyDraft; original?: PolicyRow | undefined };
type Review =
  | { kind: "policy"; item: VersionItem; draft: Draft; payload: ReturnType<typeof preparePolicy> }
  | { kind: "schedule"; target: Schedule };
export function CoachTrainingTools({ memberId, userId }: { memberId: string; userId: string }) {
  const { data: features } = useTrainingFeatures(userId),
    { locale } = useI18n();
  const query = useQuery({
    queryKey: ["coach-training", userId, memberId],
    enabled: !!features?.progression || !!features?.scheduling,
    queryFn: () => loadControls(memberId),
  });
  const [retained, setRetained] = useState<Controls | null>(null);
  useEffect(() => {
    if (query.data) setRetained(query.data);
  }, [query.data]);
  const current = query.data ?? retained;
  if (!features?.progression && !features?.scheduling) return null;
  if (query.isPending)
    return (
      <p role="status">
        {locale === "ar" ? "جارٍ تحميل إعدادات التدريب…" : "Loading coaching controls…"}
      </p>
    );
  if (!current)
    return (
      <section className="mt-5 rounded-xl border p-4">
        {query.error ? (
          <p role="alert">
            {locale === "ar" ? "تعذر تحميل إعدادات التدريب." : "Could not load coaching controls."}
            <Button variant="outline" onClick={() => void query.refetch()}>
              {locale === "ar" ? "إعادة المحاولة" : "Retry coaching controls"}
            </Button>
          </p>
        ) : (
          <p>
            {locale === "ar"
              ? "لا يوجد برنامج نشط لهذا العضو."
              : "No active program is assigned to this member."}
          </p>
        )}
      </section>
    );
  return (
    <Editor
      data={current}
      inactive={!query.data && query.isSuccess}
      refetch={async () => {
        const result = await query.refetch();
        if (result.error) throw result.error;
        if (!result.data) throw new Error("No active assignment is available.");
        return result.data;
      }}
      scheduling={!!features.scheduling}
      progression={!!features.progression}
      member={memberId}
      actor={userId}
    />
  );
}
function Editor({
  data,
  inactive,
  refetch,
  scheduling,
  progression,
  member,
  actor,
}: {
  data: Controls;
  inactive: boolean;
  refetch: () => Promise<Controls>;
  scheduling: boolean;
  progression: boolean;
  member: string;
  actor: string;
}) {
  const { locale } = useI18n(),
    ar = locale === "ar",
    l = (en: string, arabic: string) => (ar ? arabic : en),
    qc = useQueryClient();
  const [loaded, setLoaded] = useState(data),
    [slot, setSlot] = useState(""),
    [drafts, setDrafts] = useState<Record<string, Draft>>({}),
    [schedule, setSchedule] = useState<Schedule>(
      () => data.schedule ?? { mode: "calendar", start_date: activityDay() },
    ),
    [review, setReview] = useState<Review | null>(null),
    [reload, setReload] = useState(false),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(""),
    [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const changedAssignment =
    inactive ||
    loaded.assignment.id !== data.assignment.id ||
    loaded.version.id !== data.version.id;
  const item = loaded.items.find((row) => row.id === slot),
    original = loaded.policies.find((row) => row.slot_key === `${loaded.version.id}:${slot}`);
  const draft = item ? (drafts[slot] ?? { form: policyDraft(item, original), original }) : null;
  const dirty =
    Object.keys(drafts).length > 0 ||
    JSON.stringify(schedule) !==
      JSON.stringify(loaded.schedule ?? { mode: "calendar", start_date: activityDay() });
  const title = (row: VersionItem) =>
    `W${row.week} D${row.day} · ${(ar && row.name_ar) || row.name_en}`;
  function change(values: Partial<PolicyDraft>) {
    if (!draft || !item) return;
    setDrafts((current) => ({
      ...current,
      [item.id]: { ...draft, form: { ...draft.form, ...values } },
    }));
    setSaved("");
    setError("");
  }
  function reviewPolicy() {
    if (!draft || !item) return;
    setError("");
    try {
      setReview({
        kind: "policy",
        item,
        draft,
        payload: preparePolicy(item, draft.form, draft.original),
      });
    } catch (cause) {
      setError((cause as Error).message);
    }
  }
  function reviewSchedule() {
    setError("");
    if (!validActivityDate(schedule.start_date))
      return setError(l("Choose a valid program start date.", "اختر تاريخ بداية صحيحًا للبرنامج."));
    setReview({ kind: "schedule", target: { ...schedule } });
  }
  async function refresh() {
    try {
      const fresh = await refetch();
      setLoaded(fresh);
      setDrafts({});
      setSlot("");
      setSchedule(fresh.schedule ?? { mode: "calendar", start_date: activityDay() });
      setError("");
      setSaved("");
    } catch (cause) {
      setError((cause as Error).message);
    }
  }
  async function confirm() {
    if (lock.current || !review || changedAssignment) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      if (review.kind === "schedule")
        await saveCoachSchedule(actor, member, loaded.assignment, review.target, loaded.schedule);
      else
        await saveCoachPolicy(
          actor,
          member,
          loaded.assignment,
          review.item.id,
          review.item.exercise_id,
          review.payload,
          review.draft.original,
        );
      const receipt = review;
      setReview(null);
      setSaved(
        receipt.kind === "schedule"
          ? l("Schedule saved", "تم حفظ الجدول")
          : `${l("Progression policy saved", "تم حفظ قاعدة التدرج")} · ${title(receipt.item)}`,
      );
      if (receipt.kind === "policy")
        setDrafts((current) => {
          const next = { ...current };
          delete next[receipt.item.id];
          return next;
        });
      try {
        const fresh = await refetch();
        if (
          fresh.assignment.id === loaded.assignment.id &&
          fresh.version.id === loaded.version.id
        ) {
          setLoaded(fresh);
          if (receipt.kind === "schedule") setSchedule(fresh.schedule ?? receipt.target);
        }
      } catch {
        setError(
          l(
            "The save was accepted, but controls could not refresh. Reload before making another change.",
            "قُبل الحفظ، لكن تعذر تحديث الإعدادات. أعد تحميلها قبل تعديل آخر.",
          ),
        );
      }
      void qc.invalidateQueries({ queryKey: ["training-schedule", member] });
      void qc.invalidateQueries({ queryKey: ["training-suggestion", member] });
    } catch (cause) {
      setReview(null);
      setError(
        (cause as { message?: string } | null)?.message ??
          l("Save not confirmed. Your draft is retained.", "لم يتأكد الحفظ. احتُفظ بالمسودة."),
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const fields: [keyof PolicyDraft, string][] = [
    ["working_sets", l("Working sets", "مجموعات العمل")],
    ...(draft?.form.rule === "double"
      ? ([
          ["reps_min", l("Minimum reps", "أقل تكرارات")],
          ["reps_max", l("Maximum reps", "أقصى تكرارات")],
        ] as [keyof PolicyDraft, string][])
      : []),
    ...(draft?.form.rule === "duration"
      ? ([["duration_target", l("Hold seconds", "ثواني الثبات")]] as [keyof PolicyDraft, string][])
      : []),
    [
      "increment",
      draft?.form.rule === "duration"
        ? l("Duration increment (seconds)", "زيادة المدة (ثوانٍ)")
        : l("Load increment (kg)", "زيادة الحمل (كجم)"),
    ],
    ["rpe_ceiling", l("RPE ceiling", "حد الجهد")],
    [
      "upper_limit",
      draft?.form.rule === "duration"
        ? l("Upper duration limit (seconds)", "أقصى مدة (ثوانٍ)")
        : l("Upper load limit (kg)", "أقصى حمل (كجم)"),
    ],
  ];
  return (
    <section className="mt-6 space-y-4 rounded-xl border border-gold/30 bg-card p-4">
      <div className="flex flex-wrap justify-between gap-3">
        <h2 className="font-display text-lg font-semibold">
          {l("Coach training controls", "إعدادات التدريب للمدرب")}
        </h2>
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => (dirty ? setReload(true) : void refresh())}
        >
          {l("Reload controls", "إعادة تحميل الإعدادات")}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        {loaded.version.name} ·{" "}
        {l(
          "Training targets are separate from XP. Coaching loads use kilograms.",
          "أهداف التدريب منفصلة عن XP. تُدخل الأحمال بالكيلوجرام.",
        )}
      </p>
      {changedAssignment && (
        <p role="alert">
          {l(
            "The active program changed. Your old drafts remain visible; reload controls to use the current assignment.",
            "تغيّر البرنامج النشط. تبقى المسودات القديمة ظاهرة؛ أعد تحميل الإعدادات للعمل على التكليف الحالي.",
          )}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {ar
            ? "تعذر إكمال التغيير. احتُفظ بالمسودة؛ أعد تحميل الإعدادات وراجع القيم قبل المحاولة."
            : error}
        </p>
      )}
      {saved && (
        <p role="status" className="text-sm text-gold">
          {saved}
        </p>
      )}
      <fieldset disabled={busy || changedAssignment} className="min-w-0 space-y-5">
        {scheduling && (
          <section className="rounded-lg border p-4">
            <h3 className="font-semibold">{l("Scheduling", "الجدولة")}</h3>
            <p className="mt-2 text-xs text-muted-foreground">
              {l(
                "Saving replans unstarted sessions only; moved dates may be replaced. In-progress and completed sessions remain unchanged.",
                "يُعاد تخطيط الجلسات غير المبدوءة فقط، وقد تُستبدل التواريخ المنقولة. لا تتغير الجلسات الجارية أو المكتملة.",
              )}
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                {l("Schedule mode", "نمط الجدول")}
                <select
                  aria-label={l("Schedule mode", "نمط الجدول")}
                  className="h-11 w-full rounded border bg-background px-3"
                  value={schedule.mode}
                  onChange={(event) => {
                    setSchedule({ ...schedule, mode: event.target.value });
                    setSaved("");
                  }}
                >
                  <option value="calendar">{l("Calendar", "بالتاريخ")}</option>
                  <option value="rotation">{l("Rotation", "بالتتابع")}</option>
                </select>
              </label>
              <label className="text-sm">
                {l("Program day one", "اليوم الأول للبرنامج")}
                <Input
                  type="date"
                  value={schedule.start_date}
                  onChange={(event) => {
                    setSchedule({ ...schedule, start_date: event.target.value });
                    setSaved("");
                  }}
                />
              </label>
            </div>
            <Button className="mt-3" disabled={busy} onClick={reviewSchedule}>
              {l("Save schedule", "حفظ الجدول")}
            </Button>
          </section>
        )}
        {progression && (
          <section className="space-y-4 rounded-lg border p-4">
            <h3 className="font-semibold">{l("Progression policy", "قاعدة التدرج")}</h3>
            <label className="block text-sm">
              {l("Program exercise slot", "التمرين في البرنامج")}
              <select
                aria-label={l("Program exercise slot", "التمرين في البرنامج")}
                className="mt-1 h-11 w-full rounded border bg-background px-3"
                value={slot}
                onChange={(event) => {
                  setSlot(event.target.value);
                  setError("");
                  setSaved("");
                }}
              >
                <option value="">{l("Choose an exercise", "اختر تمرينًا")}</option>
                {loaded.items.map((row) => (
                  <option key={row.id} value={row.id}>
                    {title(row)}
                    {drafts[row.id] ? ` · ${l("Draft", "مسودة")}` : ""}
                  </option>
                ))}
              </select>
            </label>
            {draft && item && (
              <>
                <p className="text-sm text-muted-foreground">
                  {l("Frozen prescription", "الوصفة المحفوظة")}: {item.target_sets} ×{" "}
                  {item.target_reps} · {trainingLabel(item.logging_mode ?? "weighted_reps", locale)}{" "}
                  · {trainingLabel(item.load_convention ?? "external_total", locale)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {draft.original
                    ? `${l("Saved revision", "المراجعة المحفوظة")} ${draft.original.revision}`
                    : l(
                        "No saved policy; suggestions remain off until you enable them.",
                        "لا توجد قاعدة محفوظة؛ تبقى الاقتراحات معطلة حتى تفعيلها.",
                      )}
                </p>
                {draft.original?.override && (
                  <p className="break-words rounded border border-gold/40 p-3 text-sm">
                    {l("Override on file", "تجاوز محفوظ")}:{" "}
                    {typeof draft.original.override === "object" &&
                    !Array.isArray(draft.original.override)
                      ? String(draft.original.override["reason"] ?? "")
                      : ""}
                    {typeof draft.original.override === "object" &&
                      !Array.isArray(draft.original.override) && (
                        <span className="block">
                          <bdi>
                            {String(draft.original.override["weight_kg"] ?? "—")} kg ·{" "}
                            {String(draft.original.override["reps"] ?? "—")} {l("reps", "تكرارات")}{" "}
                            · {String(draft.original.override["duration_seconds"] ?? "—")} s
                          </bdi>
                        </span>
                      )}
                    <span className="block text-xs text-muted-foreground">
                      {l(
                        "A qualifying subsequent workout consumes its target; keeping it does not reset its issue time.",
                        "تستهلك الجلسة اللاحقة المستوفية للشروط الهدف؛ الإبقاء عليه لا يعيد ضبط وقت إصداره.",
                      )}
                    </span>
                  </p>
                )}
                <label className="block text-sm">
                  {l("Progression rule", "قاعدة التدرج")}
                  <select
                    aria-label={l("Progression rule", "قاعدة التدرج")}
                    className="mt-1 h-11 w-full rounded border bg-background px-3"
                    value={draft.form.rule}
                    onChange={(event) =>
                      change({ rule: event.target.value as PolicyDraft["rule"] })
                    }
                  >
                    <option value="off">{l("Off", "معطل")}</option>
                    {item.logging_mode === "timed" ? (
                      <option value="duration">
                        {l("Duration progression", "زيادة مدة الثبات")}
                      </option>
                    ) : (
                      <option value="double">
                        {l("Double progression", "زيادة التكرارات ثم الوزن")}
                      </option>
                    )}
                  </select>
                </label>
                {draft.form.rule !== "off" ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {fields.map(([key, label]) => (
                      <label className="text-sm" key={key}>
                        {label}
                        <Input
                          inputMode="decimal"
                          value={String(draft.form[key])}
                          onChange={(event) => change({ [key]: event.target.value })}
                        />
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {l(
                      "No automatic progression suggestions will be shown for this slot.",
                      "لن تظهر اقتراحات تدرج تلقائية لهذا التمرين.",
                    )}
                  </p>
                )}
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={draft.form.allow_imported}
                    onChange={(event) => change({ allow_imported: event.target.checked })}
                  />
                  {l(
                    "Allow mapped imported history for this progression context",
                    "استخدام السجل المستورد المعين لهذا التدرج",
                  )}
                </label>
                <p className="text-xs text-muted-foreground">
                  {l(
                    "Imported history still earns no XP or other rewards.",
                    "لا يمنح السجل المستورد نقاط XP أو مكافآت أخرى.",
                  )}
                </p>
                <label className="block text-sm">
                  {l("Override handling", "التعامل مع التجاوز")}
                  <select
                    aria-label={l("Override handling", "التعامل مع التجاوز")}
                    className="mt-1 h-11 w-full rounded border bg-background px-3"
                    value={draft.form.overrideAction}
                    onChange={(event) =>
                      change({
                        overrideAction: event.target.value as PolicyDraft["overrideAction"],
                      })
                    }
                  >
                    <option value="keep">
                      {l("Keep existing override", "الإبقاء على التجاوز الحالي")}
                    </option>
                    <option value="replace">
                      {l("Replace next target", "استبدال الهدف التالي")}
                    </option>
                    <option value="remove" disabled={!draft.original?.override}>
                      {l("Remove existing override", "إزالة التجاوز الحالي")}
                    </option>
                  </select>
                </label>
                {draft.form.overrideAction === "replace" && (
                  <div className="space-y-3">
                    <label className="block text-sm">
                      {l("Required reason", "سبب التجاوز")}
                      <textarea
                        maxLength={2000}
                        className="min-h-24 w-full rounded border bg-background p-3"
                        value={draft.form.reason}
                        onChange={(event) => change({ reason: event.target.value })}
                      />
                    </label>
                    <label className="block text-sm">
                      {l("Override kg", "الوزن المحدد كجم")}
                      <Input
                        inputMode="decimal"
                        value={draft.form.weight}
                        onChange={(event) => change({ weight: event.target.value })}
                      />
                    </label>
                    <label className="block text-sm">
                      {item.logging_mode === "timed"
                        ? l("Override seconds", "الثواني المحددة")
                        : l("Override reps", "التكرارات المحددة")}
                      <Input
                        inputMode="decimal"
                        value={item.logging_mode === "timed" ? draft.form.seconds : draft.form.reps}
                        onChange={(event) =>
                          change(
                            item.logging_mode === "timed"
                              ? { seconds: event.target.value }
                              : { reps: event.target.value },
                          )
                        }
                      />
                    </label>
                  </div>
                )}
                <Button disabled={busy} onClick={reviewPolicy}>
                  {l("Save progression policy", "حفظ قاعدة التدرج")}
                </Button>
              </>
            )}
          </section>
        )}
      </fieldset>
      <Sheet
        open={!!review}
        onOpenChange={(open) => {
          if (!open && !lock.current) setReview(null);
        }}
      >
        <SheetContent
          side={ar ? "left" : "right"}
          className="w-full overflow-y-auto sm:max-w-lg"
          dir={ar ? "rtl" : "ltr"}
        >
          <SheetHeader>
            <SheetTitle>{l("Review coaching changes", "مراجعة تغييرات التدريب")}</SheetTitle>
            <SheetDescription>
              {l(
                "Confirm the selected member and frozen program before saving.",
                "تحقق من العضو والبرنامج قبل الحفظ.",
              )}
            </SheetDescription>
          </SheetHeader>
          {review && (
            <div className="mt-5 space-y-4">
              <p className="font-semibold">{loaded.memberName}</p>
              <p>{loaded.version.name}</p>
              {review.kind === "schedule" ? (
                <>
                  <p>
                    {l("Schedule", "الجدول")}:{" "}
                    {review.target.mode === "rotation"
                      ? l("Rotation", "بالتتابع")
                      : l("Calendar", "بالتاريخ")}{" "}
                    · <bdi>{review.target.start_date}</bdi>
                  </p>
                  <p className="text-sm">
                    {l(
                      "This can replace planned dates for unstarted sessions.",
                      "قد يُستبدل تخطيط تواريخ الجلسات غير المبدوءة.",
                    )}
                  </p>
                </>
              ) : (
                <>
                  <p>{title(review.item)}</p>
                  <dl className="space-y-2 text-sm">
                    {[
                      [
                        l("Rule", "القاعدة"),
                        review.payload.rule === "off"
                          ? l("Off", "معطل")
                          : review.payload.rule === "duration"
                            ? l("Duration progression", "زيادة مدة الثبات")
                            : l("Double progression", "زيادة التكرارات ثم الوزن"),
                      ],
                      [l("Working sets", "مجموعات العمل"), review.payload.working_sets],
                      [
                        l("Rep range", "نطاق التكرارات"),
                        review.payload.rule === "double"
                          ? `${review.payload.reps_min}–${review.payload.reps_max}`
                          : "—",
                      ],
                      [
                        l("Target duration (seconds)", "المدة المستهدفة (ثوانٍ)"),
                        review.payload.duration_target ?? "—",
                      ],
                      [
                        l("Increment", "الزيادة"),
                        `${review.payload.increment} ${review.payload.rule === "duration" ? "s" : "kg"}`,
                      ],
                      [l("RPE ceiling", "حد الجهد"), review.payload.rpe_ceiling],
                      [l("Upper target limit", "أقصى هدف"), review.payload.upper_limit ?? "—"],
                      [
                        l("Imported evidence", "الأداء المستورد"),
                        review.payload.allow_imported
                          ? l("Allowed; no rewards", "مسموح؛ دون مكافآت")
                          : l("Excluded", "مستبعد"),
                      ],
                    ].map(([label, value]) => (
                      <div key={String(label)} className="flex flex-wrap justify-between gap-3">
                        <dt>{label}</dt>
                        <dd>
                          <bdi>{value}</bdi>
                        </dd>
                      </div>
                    ))}
                  </dl>
                  <p>
                    {l("Override action", "إجراء التجاوز")}:{" "}
                    {review.draft.form.overrideAction === "keep"
                      ? l("Keep existing", "الإبقاء على الحالي")
                      : review.draft.form.overrideAction === "remove"
                        ? l("Remove", "إزالة")
                        : l("Replace target", "استبدال الهدف")}
                  </p>
                  {review.draft.form.overrideAction === "replace" && (
                    <p className="whitespace-pre-wrap break-words text-sm">
                      {review.draft.form.reason}
                    </p>
                  )}
                </>
              )}
              <div className="flex flex-wrap gap-3">
                <Button variant="outline" disabled={busy} onClick={() => setReview(null)}>
                  {l("Keep editing", "متابعة التعديل")}
                </Button>
                <Button disabled={busy || changedAssignment} onClick={() => void confirm()}>
                  {busy ? "…" : l("Confirm coaching changes", "تأكيد تغييرات التدريب")}
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
      <AlertDialog open={reload} onOpenChange={setReload}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {l("Reload and discard drafts?", "إعادة التحميل وإزالة المسودات؟")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {l(
                "Unsaved schedule and per-exercise changes will be replaced by the current saved controls.",
                "ستُستبدل تغييرات الجدول والتمارين غير المحفوظة بالإعدادات المحفوظة الحالية.",
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{l("Keep editing", "متابعة التعديل")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void refresh()}>
              {l("Discard and reload", "إزالة المسودات وإعادة التحميل")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
