import { useState, useEffect, useRef, useId } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemberData, retainMemberRows, beginMemberRead } from "@/hooks/use-member-data";
import { queueMemberWrites, syncMemberEntries, type MemberRecord } from "@/lib/member-store";
import { useTrainingFeatures } from "@/hooks/use-training-features";
import { useActivityDay } from "@/hooks/use-activity-day";
import { activityDay, addDays } from "@/lib/dates";
import { inputNumber } from "@/lib/numeric-input";
import { useI18n } from "@/lib/i18n";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
export function WellnessCheckIn({ memberId, userId }: { memberId: string; userId: string }) {
  const own = memberId === userId;
  const { data: features } = useTrainingFeatures(userId);
  const { state } = useMemberData(userId);
  const today = useActivityDay();
  const { locale } = useI18n();
  const l = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const [day, setDay] = useState(activityDay());
  const previousDay = useRef(today);
  useEffect(() => {
    setDay((selected) => (selected === previousDay.current ? today : selected));
    previousDay.current = today;
  }, [today]);
  const { data, error: readError } = useQuery({
    queryKey: ["wellness", userId, memberId, today],
    enabled: !!features?.offline && navigator.onLine,
    queryFn: async () => {
      const cacheToken = own ? await beginMemberRead(userId) : {};
      const r = await supabase
        .from("wellness_checkins")
        .select("*")
        .eq("member_id", memberId)
        .gte("log_date", addDays(today, -6))
        .order("log_date", { ascending: false });
      if (r.error) throw r.error;
      if (own) await retainMemberRows(userId, "wellness_checkins", r.data, cacheToken);
      return r.data;
    },
  });
  if (!features?.offline) return null;
  const rows = own ? (state.records.wellness_checkins ?? []) : (data ?? []);
  return (
    <section className="my-6 rounded-xl border border-border p-4">
      <h2 className="font-semibold">{l("Wellness check-in", "تسجيل الحالة اليومية")}</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        {l(
          "Visible to you, your current coach and active admins. No XP. Energy: 1 very low → 5 high. Soreness: 1 none → 5 severe.",
          "مرئي لك ولمدربك الحالي وللإدارة النشطة. بدون نقاط. الطاقة: ١ منخفضة جداً إلى ٥ مرتفعة. الإجهاد العضلي: ١ لا يوجد إلى ٥ شديد.",
        )}
      </p>
      {readError && <p role="alert">{readError.message}</p>}
      {own && (
        <div className="mt-3 space-y-3">
          <Input
            type="date"
            aria-label={l("Check-in date", "تاريخ التسجيل")}
            max={today}
            value={day}
            onChange={(e) => setDay(e.target.value)}
          />
          <WellnessEditor
            key={`${userId}:${day}`}
            userId={userId}
            day={day}
            record={rows.find((r) => r.log_date === day)}
          />
        </div>
      )}
      <ul className="mt-3 divide-y">
        {[...rows]
          .sort((a, b) => String(b.log_date).localeCompare(String(a.log_date)))
          .map((r) => (
            <li className="py-2 text-sm" key={r.id}>
              {String(r.log_date)} · {l("Sleep", "النوم")} {String(r.sleep_hours ?? "—")} ·{" "}
              {l("Energy", "الطاقة")} {String(r.energy ?? "—")} · {l("Soreness", "الإجهاد")}{" "}
              {String(r.soreness ?? "—")}
              <p className="whitespace-pre-wrap">{String(r.notes ?? "")}</p>
            </li>
          ))}
      </ul>
    </section>
  );
}

function wellnessFields(record?: MemberRecord | null) {
  return {
    sleep_hours: String(record?.sleep_hours ?? ""),
    energy: String(record?.energy ?? ""),
    soreness: String(record?.soreness ?? ""),
    notes: String(record?.notes ?? ""),
  };
}
function WellnessEditor({
  userId,
  day,
  record,
}: {
  userId: string;
  day: string;
  record: MemberRecord | undefined;
}) {
  const notesId = useId();
  const { locale } = useI18n(),
    l = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const [draft, setDraft] = useState<{
    original: MemberRecord | null;
    form: ReturnType<typeof wellnessFields>;
  } | null>(null);
  const f = draft?.form ?? wellnessFields(record);
  const setF = (form: typeof f) =>
    setDraft((current) => ({ original: current ? current.original : (record ?? null), form }));
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const lock = useRef(false),
    id = useRef(crypto.randomUUID());
  async function save() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const sleep = inputNumber(f.sleep_hours, { label: "Sleep hours", max: 24 }),
        energy = inputNumber(f.energy, { label: "Energy", min: 1, max: 5, integer: true }),
        soreness = inputNumber(f.soreness, { label: "Soreness", min: 1, max: 5, integer: true });
      if (sleep == null && energy == null && soreness == null && !f.notes.trim())
        throw new Error(l("Enter at least one value.", "أدخل قيمة واحدة على الأقل."));
      const old = draft ? draft.original : record;
      await queueMemberWrites(userId, [
        {
          entity: "wellness_checkins",
          op: "put",
          expectedRevision: old?.revision ?? 0,
          requireMissing: !old,
          allowMissing: !old,
          record: {
            id: old?.id ?? id.current,
            log_date: day,
            sleep_hours: sleep,
            energy,
            soreness,
            notes: f.notes.trim(),
          },
        },
      ]);
      void syncMemberEntries(userId).catch(() => {});
      setDraft(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <fieldset disabled={busy} className="space-y-3">
      {error && (
        <div role="alert" className="space-y-2 text-sm text-destructive">
          <p>{error}</p>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setDraft(null);
              setError("");
            }}
          >
            {" "}
            {l(
              "Reload saved check-in",
              "\u0625\u0639\u0627\u062f\u0629 \u062a\u062d\u0645\u064a\u0644 \u0627\u0644\u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u0645\u062d\u0641\u0648\u0638",
            )}{" "}
          </Button>
        </div>
      )}
      <div className="grid grid-cols-3 gap-2">
        {(
          [
            ["sleep_hours", l("Sleep hours", "ساعات النوم")],
            ["energy", l("Energy 1–5", "الطاقة ١–٥")],
            ["soreness", l("Soreness 1–5", "الإجهاد ١–٥")],
          ] as const
        ).map(([k, label]) => (
          <label key={k} className="text-xs">
            {label}
            <Input
              inputMode="decimal"
              value={f[k]}
              onChange={(e) => setF({ ...f, [k]: e.target.value })}
            />
          </label>
        ))}
      </div>
      <div className="text-sm">
        <label htmlFor={notesId} className="block">
          {l("Notes", "ملاحظات")}
        </label>
        <textarea
          id={notesId}
          className="mt-1 w-full rounded border bg-background p-2"
          maxLength={2000}
          value={f.notes}
          onChange={(e) => setF({ ...f, notes: e.target.value })}
        />
      </div>
      <Button disabled={busy} onClick={() => void save()}>
        {l("Save check-in on device", "حفظ التسجيل على الجهاز")}
      </Button>{" "}
    </fieldset>
  );
}
