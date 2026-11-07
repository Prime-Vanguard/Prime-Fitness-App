import { NativeSelect } from "@/components/ui/native-select";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useI18n } from "@/lib/i18n";
import { activityDay, addDays } from "@/lib/dates";
import { inputNumber } from "@/lib/numeric-input";
import { readMemberState, changeMemberState } from "@/lib/member-store";
import { useTrainingFeatures } from "@/hooks/use-training-features";
import type { Json } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { featureCall } from "@/features/experience/api";
import { socialState, challengeDraft, type SocialState } from "./contracts";
export function SocialPanel({ userId }: { userId: string }) {
  const { data: features } = useTrainingFeatures(userId);
  if (!features?.social) return null;
  return <SocialContent key={userId} userId={userId} />;
}
function SocialContent({ userId }: { userId: string }) {
  const { locale } = useI18n();
  const l = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const qc = useQueryClient(),
    key = ["social", userId];
  const [online, setOnline] = useState(navigator.onLine),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [code, setCode] = useState(""),
    [found, setFound] = useState<{ member_id: string; name: string | null } | null>(null),
    [pending, setPending] = useState<z.output<typeof challengeDraft> | null>(null);
  const [form, setForm] = useState({
    title: "",
    metric: "cardio_minutes",
    goal: "60",
    starts_on: activityDay(),
    ends_on: addDays(activityDay(), 7),
  });
  const [invite, setInvite] = useState<Record<string, string>>({});
  const [preference, setPreference] = useState<
    Partial<{ discoverable: boolean; sharing: boolean }>
  >({});
  const lock = useRef(false);
  useEffect(() => {
    let alive = true;
    const on = () => setOnline(navigator.onLine);
    window.addEventListener("online", on);
    window.addEventListener("offline", on);
    void readMemberState(userId).then((s) => {
      const result = challengeDraft.safeParse(s.references["challengeCreate"]);
      if (alive && result.success) setPending(result.data);
    });
    return () => {
      alive = false;
      window.removeEventListener("online", on);
      window.removeEventListener("offline", on);
    };
  }, [userId]);
  const query = useQuery({
    queryKey: key,
    enabled: online,
    queryFn: () =>
      featureCall("social_action", { _op: "state", _data: {} }, (value) =>
        socialState.parse(value),
      ),
    staleTime: 15000,
    retry: 0,
  });
  const data = query.data;
  async function perform(op: string, args: Record<string, Json> = {}) {
    if (!online || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const state = await featureCall("social_action", { _op: op, _data: args }, (value) =>
        socialState.parse(value),
      );
      qc.setQueryData<SocialState>(key, state);
      setFound(null);
      return state;
    } catch (e) {
      setError((e as Error).message);
      return;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function submitChallenge(saved?: z.output<typeof challengeDraft>) {
    if (lock.current || !online) return;
    try {
      const request =
        saved ??
        pending ??
        challengeDraft.parse({
          id: crypto.randomUUID(),
          ...form,
          goal: inputNumber(form.goal, { label: "Goal", min: 1, max: 10000, integer: true }),
        });
      await changeMemberState(userId, (s) => {
        const existing = s.references["challengeCreate"];
        if (existing && JSON.stringify(existing) !== JSON.stringify(request))
          throw new Error("Resolve the saved challenge request first");
        return { ...s, references: { ...s.references, challengeCreate: request } };
      });
      setPending(request);
      const result = await perform("create_challenge", request);
      if (result) {
        await changeMemberState(userId, (s) => ({
          ...s,
          references: {
            ...s.references,
            challengeCreate:
              challengeDraft.safeParse(s.references["challengeCreate"]).data?.id === request.id
                ? null
                : (s.references["challengeCreate"] ?? null),
          },
        }));
        setPending(null);
        setForm((v) => ({ ...v, title: "" }));
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function updatePreference(field: "discoverable" | "sharing", value: boolean) {
    if (lock.current || !online) return;
    setPreference({ [field]: value });
    await perform("preferences", { [field]: value });
    setPreference({});
  }
  if (!online)
    return (
      <section className="my-5 rounded-xl border p-4">
        <p>
          {l(
            "Friends and challenges need a connection so privacy and blocks can be checked. Your training logs remain available offline.",
            "يحتاج الأصدقاء والتحديات اتصالاً للتحقق من الخصوصية والحظر. تبقى سجلات التدريب متاحة دون اتصال.",
          )}
        </p>
      </section>
    );
  return (
    <section className="my-5 space-y-4 rounded-xl border border-gold/30 p-4">
      <h2 className="text-xl font-semibold">
        {l("Friends & shared challenges", "الأصدقاء والتحديات المشتركة")}
      </h2>
      <p className="text-sm text-muted-foreground">
        {l(
          "Separate from Pods. Wellness notes, measurements, photos and food records are never shared here. Challenge progress is self-reported training, not medical or competitive verification. These challenges do not award XP.",
          "منفصل عن المجموعات. لا تُشارك هنا ملاحظات العافية أو القياسات أو الصور أو الطعام. تقدم التحديات نشاط مسجل ذاتياً، وليس تحققاً طبياً أو تنافسياً. لا تمنح هذه التحديات XP.",
        )}
      </p>
      <Button variant="outline" onClick={() => void query.refetch()} disabled={busy}>
        {l("Refresh friends and challenges", "تحديث الأصدقاء والتحديات")}
      </Button>
      {(error || query.error) && (
        <p role="alert" className="text-sm text-destructive">
          {error || query.error?.message}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {data && (
        <>
          <div className="rounded border p-3">
            <p className="font-semibold">{l("Your member search code", "رمز بحث العضوية")}</p>
            <code dir="ltr" className="break-all select-all">
              {data.account.code}
            </code>
            <Button
              className="ms-2"
              variant="outline"
              onClick={() => {
                void navigator.clipboard
                  .writeText(data.account.code)
                  .then(() => setNotice(l("Code copied", "نُسخ الرمز")))
                  .catch(() =>
                    setNotice(
                      l("Select the code and copy it manually.", "حدد الرمز وانسخه يدوياً."),
                    ),
                  );
              }}
            >
              {l("Copy code", "نسخ الرمز")}
            </Button>
            <p className="text-xs">
              {l(
                "This is not a password or invitation. Only active members who know the exact code can search, when discovery is enabled.",
                "ليس كلمة مرور أو دعوة. يمكن للأعضاء النشطين البحث بالرمز الدقيق فقط عند تفعيل الظهور.",
              )}
            </p>
          </div>
          <label className="flex min-h-11 items-center gap-2">
            <input
              type="checkbox"
              disabled={busy}
              checked={preference.discoverable ?? data.account.discoverable}
              onChange={(e) => void updatePreference("discoverable", e.target.checked)}
            />
            {l(
              "Allow exact-code discovery and friend requests",
              "السماح بالبحث بالرمز وطلبات الصداقة",
            )}
          </label>
          <label className="flex min-h-11 items-center gap-2">
            <input
              type="checkbox"
              disabled={busy}
              checked={preference.sharing ?? data.account.sharing}
              onChange={(e) => {
                if (
                  !e.target.checked &&
                  !window.confirm(
                    l(
                      "Stop sharing challenge progress? You will leave joined challenges and cancel your own active challenges.",
                      "إيقاف مشاركة تقدم التحديات؟ ستغادر التحديات وتنهي تحدياتك النشطة.",
                    ),
                  )
                )
                  return;
                void updatePreference("sharing", e.target.checked);
              }}
            />
            {l("Opt in to shared challenge progress", "الموافقة على مشاركة تقدم التحديات")}
          </label>
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (lock.current) return;
              lock.current = true;
              setBusy(true);
              setError("");
              setFound(null);
              void featureCall(
                "social_action",
                { _op: "lookup", _data: { code: code.trim().toUpperCase() } },
                (value) =>
                  z
                    .object({ member_id: z.string().uuid(), name: z.string().nullable() })
                    .nullable()
                    .parse(value),
              )
                .then((result) => {
                  setFound(result);
                  if (!result)
                    setNotice(
                      l(
                        "Member unavailable or discovery disabled.",
                        "العضو غير متاح أو الظهور معطل.",
                      ),
                    );
                })
                .catch((e) => setError(e.message))
                .finally(() => {
                  lock.current = false;
                  setBusy(false);
                });
            }}
          >
            <label>
              {l("Exact member code", "رمز العضو الدقيق")}
              <Input
                dir="ltr"
                value={code}
                maxLength={19}
                onChange={(e) => setCode(e.target.value)}
              />
            </label>
            <Button
              disabled={
                busy ||
                !data.account.discoverable ||
                !/^PF-[A-F0-9]{16}$/.test(code.trim().toUpperCase())
              }
            >
              {l("Find member", "بحث عن عضو")}
            </Button>
          </form>
          {found && (
            <div className="rounded border p-3">
              <p>{found.name ?? l("Member", "عضو")}</p>
              <Button
                disabled={busy}
                onClick={() => void perform("request", { member_id: found.member_id })}
              >
                {l("Send friend request", "إرسال طلب صداقة")}
              </Button>
            </div>
          )}
          <h3 className="font-semibold">{l("Friends and requests", "الأصدقاء والطلبات")}</h3>
          {!data.friends.length && (
            <p>{l("No friends or pending requests yet.", "لا يوجد أصدقاء أو طلبات معلقة بعد.")}</p>
          )}
          <ul className="space-y-2">
            {data.friends.map((friend) => (
              <li key={friend.member_id} className="rounded border p-3">
                <p>
                  {friend.name ?? l("Member", "عضو")} ·{" "}
                  {friend.status === "accepted"
                    ? l("Friend", "صديق")
                    : friend.incoming
                      ? l("Incoming request", "طلب وارد")
                      : l("Request sent", "أُرسل الطلب")}
                </p>
                <div className="flex flex-wrap gap-2">
                  {friend.status === "pending" && friend.incoming && (
                    <>
                      <Button
                        disabled={busy}
                        onClick={() => void perform("accept", { member_id: friend.member_id })}
                      >
                        {l("Accept", "قبول")}
                      </Button>
                      <Button
                        variant="outline"
                        disabled={busy}
                        onClick={() => void perform("decline", { member_id: friend.member_id })}
                      >
                        {l("Decline", "رفض")}
                      </Button>
                    </>
                  )}
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => {
                      if (
                        window.confirm(
                          l("Remove this friend/request?", "إزالة هذا الصديق أو الطلب؟"),
                        )
                      )
                        void perform("remove", { member_id: friend.member_id });
                    }}
                  >
                    {l("Remove", "إزالة")}
                  </Button>
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => {
                      if (
                        window.confirm(
                          l(
                            "Block this member? Shared challenges between you will be disconnected.",
                            "حظر العضو؟ ستتوقف مشاركة التحديات بينكما.",
                          ),
                        )
                      )
                        void perform("block", { member_id: friend.member_id });
                    }}
                  >
                    {l("Block", "حظر")}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          {data.blocked.length > 0 && (
            <details>
              <summary>
                {l("Blocked members", "الأعضاء المحظورون")} ({data.blocked.length})
              </summary>
              {data.blocked.map((block) => (
                <p key={block.member_id}>
                  …{block.member_id.slice(-6)}{" "}
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => void perform("unblock", { member_id: block.member_id })}
                  >
                    {l("Unblock", "إلغاء الحظر")}
                  </Button>
                </p>
              ))}
            </details>
          )}
          <form
            className="space-y-3 rounded border p-3"
            onSubmit={(e) => {
              e.preventDefault();
              void submitChallenge();
            }}
          >
            <h3 className="font-semibold">{l("Create a shared challenge", "إنشاء تحدٍ مشترك")}</h3>
            <p className="text-xs">
              {l(
                "A shared total across accepted participants, up to 10 people. Cardio contribution is capped at 180 active minutes per member per day; strength counts qualifying workout days. Imported workouts never contribute.",
                "إجمالي مشترك للمشاركين الموافقين حتى ١٠ أشخاص. حد الكارديو ١٨٠ دقيقة نشطة لكل عضو يومياً؛ القوة تحسب أيام التدريب المؤهلة. لا تُحتسب التمارين المستوردة.",
              )}
            </p>
            <label className="block">
              {l("Challenge title", "عنوان التحدي")}
              <Input
                maxLength={100}
                value={form.title}
                disabled={!!pending || busy}
                onChange={(e) => setForm((v) => ({ ...v, title: e.target.value }))}
              />
            </label>
            <label className="min-w-0 max-w-full block">
              {l("Goal type", "نوع الهدف")}
              <NativeSelect
                className="mt-2"
                value={form.metric}
                disabled={!!pending || busy}
                onChange={(e) => setForm((v) => ({ ...v, metric: e.target.value }))}
              >
                <option value="cardio_minutes">
                  {l("Active cardio minutes", "دقائق الكارديو النشطة")}
                </option>
                <option value="workout_days">
                  {l("Qualifying workout days", "أيام التدريب المؤهلة")}
                </option>
              </NativeSelect>
            </label>
            {(
              [
                ["goal", l("Shared goal", "الهدف المشترك")],
                ["starts_on", l("Start date", "تاريخ البداية")],
                ["ends_on", l("End date", "تاريخ النهاية")],
              ] as const
            ).map(([field, label]) => (
              <label className="block" key={field}>
                {label}
                <Input
                  type={field === "goal" ? "text" : "date"}
                  inputMode={field === "goal" ? "numeric" : undefined}
                  disabled={!!pending || busy}
                  value={form[field]}
                  onChange={(e) => setForm((v) => ({ ...v, [field]: e.target.value }))}
                />
              </label>
            ))}
            <Button disabled={busy || !data.account.sharing || !!pending}>
              {l("Create challenge", "إنشاء التحدي")}
            </Button>
            {pending && (
              <div role="status">
                <p>
                  {l(
                    "A saved creation request is awaiting confirmation. Retry uses the same identity.",
                    "طلب إنشاء محفوظ ينتظر التأكيد. تستخدم المحاولة الهوية نفسها.",
                  )}{" "}
                  {pending.title}
                </p>
                <Button
                  type="button"
                  disabled={busy}
                  variant="outline"
                  onClick={() => void submitChallenge(pending)}
                >
                  {l("Retry saved challenge", "إعادة الطلب المحفوظ")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    if (
                      window.confirm(
                        l(
                          "Cancel this saved request? If it was already created, its challenge will be cancelled too.",
                          "إلغاء هذا الطلب المحفوظ؟ إذا أُنشئ التحدي بالفعل فسيُلغى أيضاً.",
                        ),
                      )
                    )
                      void perform("cancel_creation", { id: pending.id })
                        .then(async (result) => {
                          if (!result) return;
                          await changeMemberState(userId, (s) => ({
                            ...s,
                            references: {
                              ...s.references,
                              challengeCreate:
                                challengeDraft.safeParse(s.references["challengeCreate"]).data
                                  ?.id === pending.id
                                  ? null
                                  : (s.references["challengeCreate"] ?? null),
                            },
                          }));
                          setPending(null);
                        })
                        .catch((e) => setError(e.message));
                  }}
                >
                  {l("Cancel saved challenge request", "إلغاء طلب التحدي المحفوظ")}
                </Button>
              </div>
            )}
          </form>
          <ul className="space-y-3">
            {data.challenges.map((c) => (
              <li key={c.id} className="space-y-2 rounded border p-3">
                <h3 className="font-semibold">{c.title}</h3>
                <p>
                  {c.starts_on} → {c.ends_on} · {c.participants} {l("participants", "مشاركون")}
                </p>
                <p>
                  {c.progress} / {c.goal}{" "}
                  {c.metric === "cardio_minutes"
                    ? l("active minutes", "دقائق نشطة")
                    : l("workout days", "أيام تدريب")}{" "}
                  ·{" "}
                  {c.status === "completed"
                    ? l("Completed", "مكتمل")
                    : c.status === "cancelled"
                      ? l("Cancelled", "ملغى")
                      : l("Active", "نشط")}
                </p>
                <progress className="w-full" value={Math.min(c.progress, c.goal)} max={c.goal} />
                <div className="flex flex-wrap gap-2">
                  {c.participation === "invited" && (
                    <Button
                      disabled={busy || !data.account.sharing}
                      onClick={() => void perform("join", { id: c.id })}
                    >
                      {l("Join challenge", "الانضمام للتحدي")}
                    </Button>
                  )}
                  <Button
                    disabled={busy}
                    variant="outline"
                    onClick={() => void perform("refresh_challenge", { id: c.id })}
                  >
                    {l("Check completion", "فحص الاكتمال")}
                  </Button>
                  <Button
                    disabled={busy}
                    variant="outline"
                    onClick={() => {
                      if (
                        window.confirm(
                          l("Leave/cancel this challenge?", "مغادرة أو إلغاء هذا التحدي؟"),
                        )
                      )
                        void perform(c.owner_id === userId ? "cancel_challenge" : "leave", {
                          id: c.id,
                        });
                    }}
                  >
                    {c.owner_id === userId
                      ? l("Cancel challenge", "إلغاء التحدي")
                      : l("Leave", "مغادرة")}
                  </Button>
                </div>
                {c.owner_id === userId && c.status === "active" && (
                  <div className="grid items-end gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                    <NativeSelect
                      aria-label={l("Friend to invite", "الصديق المدعو")}
                      value={invite[c.id] ?? ""}
                      onChange={(e) => setInvite((v) => ({ ...v, [c.id]: e.target.value }))}
                    >
                      <option value="">
                        {l("Choose an accepted friend", "اختر صديقاً وافق على الصداقة")}
                      </option>
                      {data.friends
                        .filter((f) => f.status === "accepted")
                        .map((f) => (
                          <option key={f.member_id} value={f.member_id}>
                            {f.name ?? "—"}
                          </option>
                        ))}
                    </NativeSelect>
                    <Button
                      disabled={busy || !invite[c.id]}
                      variant="outline"
                      onClick={() => void perform("invite", { id: c.id, member_id: invite[c.id]! })}
                    >
                      {l("Invite friend", "دعوة صديق")}
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
