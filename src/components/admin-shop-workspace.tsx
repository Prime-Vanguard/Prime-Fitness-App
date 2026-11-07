import { NativeSelect } from "@/components/ui/native-select";
import { useMemo, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMe } from "@/hooks/use-me";
import { useI18n } from "@/lib/i18n";
import { normalizeExercise } from "@/lib/exercise-guidance";
import { adminDate } from "@/lib/admin-format";
import {
  createReward,
  changeRewardVisibility,
  emptyReward,
  rewardInput,
  reviewRedemption,
  loadRewards,
  loadRedemptions,
  loadShopPeople,
  type Redemption,
  type ShopSearch,
} from "@/lib/admin-shop";
import { PageHeader } from "./page-header";
import { MemberSections } from "./member-sections";
import { AdminEditorDrawer, AdminDraftWarning } from "./admin-editor-drawer";
import { AdminChangeReview, type AdminReview } from "./admin-change-review";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
export function AdminShopWorkspace({
  actor,
  search,
  onSearch,
}: {
  actor: string;
  search: ShopSearch;
  onSearch: (next: ShopSearch, replace?: boolean) => void;
}) {
  const { data: me } = useMe(actor),
    { t, locale } = useI18n(),
    qc = useQueryClient(),
    l = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const allowed = !!me?.isAdmin && !!me.profile?.access_active,
    section = search.section ?? "queue",
    status = search.status ?? "pending";
  const redemptionKey = ["admin-shop-redemptions", actor, status] as const;
  const [picked, setPicked] = useState<Redemption | null>(null),
    [notes, setNotes] = useState<Record<string, string>>({}),
    [review, setReview] = useState<AdminReview | null>(null),
    [saved, setSaved] = useState(""),
    [createOpen, setCreateOpen] = useState(false),
    [form, setForm] = useState(emptyReward),
    [id, setId] = useState(() => crypto.randomUUID()),
    [pending, setPending] = useState<ReturnType<typeof emptyReward> | null>(null),
    [error, setError] = useState("");
  const rewards = useQuery({
    queryKey: ["admin-shop-rewards", actor],
    enabled: allowed,
    retry: false,
    queryFn: ({ signal }) => loadRewards(signal),
  });
  const orders = useQuery({
    queryKey: redemptionKey,
    enabled: allowed && section === "queue",
    retry: false,
    queryFn: ({ signal }) => loadRedemptions(signal, status),
  });
  const people = useQuery({
    queryKey: ["admin-shop-people", actor],
    enabled: allowed && section === "queue",
    retry: false,
    queryFn: ({ signal }) => loadShopPeople(signal),
  });
  const ready = allowed && !!rewards.data && !rewards.error,
    queueReady = ready && !!orders.data && !orders.error && !!people.data && !people.error;
  const peopleById = useMemo(
    () => new Map(people.data?.map((person) => [person.id, person])),
    [people.data],
  );
  const rewardsById = useMemo(
    () => new Map(rewards.data?.map((reward) => [reward.id, reward])),
    [rewards.data],
  );
  const who = (member: string) => {
    const p = peopleById.get(member);
    return p?.display_name || p?.email || l("Member unavailable", "بيانات العضو غير متاحة");
  };
  const title = (reward: string) => {
    const r = rewardsById.get(reward);
    return r
      ? locale === "ar"
        ? r.title_ar || r.title_en
        : r.title_en
      : l("Reward unavailable", "المكافأة غير متاحة");
  };
  const stateLabel = (value: string) =>
    value === "pending"
      ? l("Pending", "قيد الانتظار")
      : value === "fulfilled"
        ? l("Fulfilled", "تم التسليم")
        : value === "rejected"
          ? l("Rejected / refunded", "مرفوض / تم رد النقاط")
          : value;
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["admin-shop-redemptions", actor] });
    void qc.invalidateQueries({ queryKey: ["admin-shop-rewards", actor] });
    void qc.invalidateQueries({ queryKey: ["rewards"] });
    void qc.invalidateQueries({ queryKey: ["me"] });
  };
  function decision(status: "fulfilled" | "rejected") {
    if (!picked) return;
    const original = picked,
      note = notes[original.id] ?? original.review_note ?? "";
    setError("");
    if ((status === "rejected" && !note.trim()) || note.trim().length > 2000) {
      setError(
        l("Add a rejection reason, up to 2,000 characters.", "أضف سبب الرفض، بحد أقصى ٢٠٠٠ حرف."),
      );
      return;
    }
    setReview({
      title: l("Review fulfillment decision", "مراجعة قرار التسليم"),
      description: `${who(original.member_id)} · ${title(original.reward_id)}`,
      details: (
        <div className="space-y-3 text-sm">
          <p>
            {stateLabel(status)} · {original.cost_pv} PV
          </p>
          <p>
            {status === "rejected"
              ? l(
                  "The server returns the original charged points and restores one unit of limited stock. Do not issue a separate manual refund.",
                  "يعيد الخادم النقاط المدفوعة ويضيف وحدة للمخزون المحدود. لا تصدر استرداداً يدوياً إضافياً.",
                )
              : l(
                  "Confirm only after delivery. The existing points charge remains; no refund is issued.",
                  "أكد بعد التسليم فقط. يبقى خصم النقاط الحالي دون استرداد.",
                )}
          </p>
          <p className="whitespace-pre-wrap break-words">{note || l("No note", "دون ملاحظة")}</p>
        </div>
      ),
      save: async () => {
        const row = await reviewRedemption(actor, original, status, note);
        qc.setQueryData<Redemption[]>(redemptionKey, (old) =>
          old?.map((r) => (r.id === row.id ? row : r)),
        );
        setNotes((old) => ({ ...old, [original.id]: "" }));
        setPicked(null);
        setSaved(l("Decision confirmed by the server.", "تم تأكيد القرار من الخادم."));
        refresh();
      },
    });
  }
  function create(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const draft = pending ?? { ...form },
        values = rewardInput(draft),
        requestId = id;
      setReview({
        title: l("Review new reward", "مراجعة مكافأة جديدة"),
        description: values.title_en,
        details: (
          <div className="space-y-2">
            <p>{values.title_ar}</p>
            <p>
              {values.cost_pv} PV · {l("Stock", "المخزون")}:{" "}
              {values.stock ?? l("Unlimited", "غير محدود")}
            </p>
            <p>
              {l(
                "Blank stock is unlimited; zero is out of stock. The reward starts visible.",
                "المخزون الفارغ غير محدود؛ الصفر يعني نفاد المخزون. تبدأ المكافأة ظاهرة.",
              )}
            </p>
          </div>
        ),
        save: async () => {
          await createReward(actor, requestId, draft, () => setPending(draft));
          setForm(emptyReward());
          setPending(null);
          setId(crypto.randomUUID());
          setCreateOpen(false);
          setSaved(l("Reward creation confirmed.", "تم تأكيد إنشاء المكافأة."));
          refresh();
        },
      });
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const q = normalizeExercise(search.q ?? ""),
    filteredOrders = (orders.data ?? []).filter(
      (r) =>
        (status === "all" || r.status === status) &&
        normalizeExercise(
          `${who(r.member_id)} ${peopleById.get(r.member_id)?.email ?? ""} ${title(r.reward_id)} ${r.id}`,
        ).includes(q),
    );
  const filteredRewards = (rewards.data ?? []).filter((r) =>
    normalizeExercise(`${r.title_en} ${r.title_ar ?? ""}`).includes(q),
  );
  const total = section === "queue" ? filteredOrders.length : filteredRewards.length,
    pages = Math.max(1, Math.ceil(total / 25)),
    page = Math.min(search.page ?? 1, pages),
    slice = (page - 1) * 25;
  if (me && !allowed) return <p className="mt-10">{t("notAllowed")}</p>;
  return (
    <>
      <PageHeader eyebrow={t("admin")} title={t("rewardsAdmin")} />
      <MemberSections
        label={l("Shop workspace", "مساحة المتجر")}
        value={section}
        items={[
          ["queue", l("Fulfillment queue", "طلبات التسليم")],
          ["catalogue", l("Reward catalogue", "كتالوج المكافآت")],
        ]}
        onSelect={(section) => onSearch({ ...search, section, page: undefined })}
      />
      <label className="mt-5 block max-w-md text-sm">
        {l("Search shop", "بحث المتجر")}
        <Input
          className="mt-1"
          value={search.q ?? ""}
          onChange={(e) =>
            onSearch({ ...search, q: e.target.value || undefined, page: undefined }, true)
          }
        />
      </label>
      <div className="mt-4 flex flex-wrap gap-3">
        <Button
          variant="outline"
          onClick={() => {
            refresh();
            if (section === "queue") void people.refetch();
          }}
        >
          {l("Refresh shop", "تحديث المتجر")}
        </Button>
        {section === "catalogue" && (
          <Button disabled={!ready} onClick={() => setCreateOpen(true)}>
            {l("Create reward", "إنشاء مكافأة")}
          </Button>
        )}
      </div>
      {section === "queue" && (
        <label className="mt-4 block text-sm min-w-0 max-w-full">
          {l("Fulfillment status", "حالة التسليم")}
          <NativeSelect
            className="mt-2 max-w-sm"
            value={status}
            onChange={(e) =>
              onSearch({
                ...search,
                status: e.target.value as ShopSearch["status"],
                page: undefined,
              })
            }
          >
            {["pending", "fulfilled", "rejected", "all"].map((s) => (
              <option key={s} value={s}>
                {s === "all" ? l("All statuses", "كل الحالات") : stateLabel(s)}
              </option>
            ))}
          </NativeSelect>
        </label>
      )}
      {(rewards.isPending || (section === "queue" && (orders.isPending || people.isPending))) && (
        <p role="status" className="mt-4">
          {l("Loading shop records…", "جارٍ تحميل سجلات المتجر…")}
        </p>
      )}
      {(rewards.error || (section === "queue" && (orders.error || people.error))) && (
        <p role="alert" className="mt-4 text-destructive">
          {l(
            "Complete shop records could not be loaded. Refresh before making changes.",
            "تعذر تحميل سجلات المتجر كاملة. حدّث قبل إجراء التغييرات.",
          )}
        </p>
      )}
      {saved && (
        <p role="status" className="mt-4 text-success">
          {saved}
        </p>
      )}
      {section === "queue" ? (
        <section aria-label={l("Fulfillment requests", "طلبات التسليم")} className="mt-5">
          <p className="text-xs text-muted-foreground">
            {l(
              "Dates use Cairo time. PV is the original charged cost; reward titles are current catalogue labels.",
              "التواريخ بتوقيت القاهرة. النقاط هي التكلفة المدفوعة، والأسماء من الكتالوج الحالي.",
            )}
          </p>
          {queueReady && !filteredOrders.length && (
            <p role="status" className="mt-4">
              {l("No requests match these filters.", "لا توجد طلبات تطابق هذه التصفية.")}
            </p>
          )}
          <ul className="mt-4 grid gap-3 md:grid-cols-2">
            {filteredOrders.slice(slice, slice + 25).map((r) => (
              <li
                key={r.id}
                className="min-w-0 space-y-3 rounded-xl border border-border bg-card p-5"
              >
                <h2 className="break-words font-medium">
                  {who(r.member_id)} · {title(r.reward_id)}
                </h2>
                <p>
                  {r.cost_pv} PV · {stateLabel(r.status)}
                </p>
                <p className="text-xs text-muted-foreground">{adminDate(r.created_at, locale)}</p>
                <Button
                  variant="outline"
                  disabled={!queueReady}
                  onClick={() => {
                    setPicked(r);
                    setError("");
                  }}
                >
                  {l("Review request", "مراجعة الطلب")}
                </Button>
                {notes[r.id]?.trim() && (
                  <p className="text-xs">{l("Unsaved review note", "ملاحظة مراجعة غير محفوظة")}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <section aria-label={l("Reward catalogue", "كتالوج المكافآت")} className="mt-5">
          {ready && !filteredRewards.length && (
            <p role="status">{l("No rewards match this search.", "لا توجد مكافآت تطابق البحث.")}</p>
          )}
          <ul className="grid gap-3 md:grid-cols-2">
            {filteredRewards.slice(slice, slice + 25).map((r) => (
              <li
                key={r.id}
                className="min-w-0 space-y-3 rounded-xl border border-border bg-card p-5"
              >
                <h2 className="break-words font-medium">
                  {locale === "ar" ? r.title_ar || r.title_en : r.title_en}
                </h2>
                <p>
                  {r.cost_pv} PV · {l("Stock", "المخزون")}: {r.stock ?? l("Unlimited", "غير محدود")}
                </p>
                <p>
                  {r.active ? l("Visible", "ظاهر") : l("Hidden", "مخفي")}
                  {r.stock === 0 ? ` · ${l("Out of stock", "نفد المخزون")}` : ""}
                </p>
                <Button
                  variant="outline"
                  disabled={!ready}
                  onClick={() =>
                    setReview({
                      title: l("Review reward visibility", "مراجعة ظهور المكافأة"),
                      description: r.title_en,
                      details: (
                        <p>
                          {r.active
                            ? l(
                                "Hide from new requests. Existing requests remain available for fulfillment.",
                                "إخفاء عن الطلبات الجديدة مع استمرار تسليم الطلبات الحالية.",
                              )
                            : l(
                                "Show for new requests, subject to available stock.",
                                "إظهار للطلبات الجديدة وفق المخزون المتاح.",
                              )}
                        </p>
                      ),
                      save: async () => {
                        await changeRewardVisibility(actor, r);
                        setSaved(l("Visibility confirmed.", "تم تأكيد الظهور."));
                        refresh();
                      },
                    })
                  }
                >
                  {r.active
                    ? l("Hide reward", "إخفاء المكافأة")
                    : l("Show reward", "إظهار المكافأة")}
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <nav
        aria-label={l("Shop pages", "صفحات المتجر")}
        className="mt-5 flex flex-wrap items-center justify-between gap-2"
      >
        <Button
          variant="ghost"
          disabled={page <= 1}
          onClick={() => onSearch({ ...search, page: page - 1 })}
        >
          {l("Previous", "السابق")}
        </Button>
        <span className="text-sm">
          {page} / {pages} · {total}
        </span>
        <Button
          variant="ghost"
          disabled={page >= pages}
          onClick={() => onSearch({ ...search, page: page + 1 })}
        >
          {l("Next", "التالي")}
        </Button>
      </nav>
      <AdminEditorDrawer
        open={!!picked}
        close={() => setPicked(null)}
        locked={!!review}
        title={l("Fulfillment request", "طلب التسليم")}
        description={picked ? `${who(picked.member_id)} · ${title(picked.reward_id)}` : ""}
      >
        {picked && (
          <>
            <p>
              {picked.cost_pv} PV · {stateLabel(picked.status)}
            </p>
            <p className="text-sm">
              {l("Requested", "تاريخ الطلب")}: {adminDate(picked.created_at, locale)}
            </p>
            <p className="break-all text-xs">{picked.id}</p>
            {picked.status === "pending" ? (
              <>
                <label className="block text-sm">
                  {l("Review note", "ملاحظة المراجعة")}
                  <textarea
                    className="mt-2 min-h-28 w-full rounded-md border border-input bg-background p-3 text-base"
                    maxLength={2000}
                    value={notes[picked.id] ?? picked.review_note ?? ""}
                    disabled={!!review}
                    onChange={(e) => setNotes({ ...notes, [picked.id]: e.target.value })}
                  />
                </label>
                <p className="text-xs">
                  {l(
                    "A reason is required for rejection. Changes are submitted only after review.",
                    "سبب الرفض مطلوب. تُرسل التغييرات بعد المراجعة فقط.",
                  )}
                </p>
                {error && (
                  <p role="alert" className="text-destructive">
                    {error}
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button disabled={!queueReady || !!review} onClick={() => decision("fulfilled")}>
                    {l("Review fulfillment", "مراجعة التسليم")}
                  </Button>
                  <Button
                    variant="outline"
                    disabled={!queueReady || !!review}
                    onClick={() => decision("rejected")}
                  >
                    {l("Review rejection / refund", "مراجعة الرفض والاسترداد")}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="whitespace-pre-wrap break-words">
                  {picked.review_note || l("No review note", "لا توجد ملاحظة مراجعة")}
                </p>
                <p className="text-sm">
                  {l("Reviewed", "تاريخ المراجعة")}: {adminDate(picked.reviewed_at, locale)} ·{" "}
                  {who(picked.reviewed_by ?? "")}
                </p>
              </>
            )}
          </>
        )}
      </AdminEditorDrawer>
      <AdminEditorDrawer
        open={createOpen}
        close={() => setCreateOpen(false)}
        locked={!!review}
        title={l("Create reward", "إنشاء مكافأة")}
        description={l(
          "Set its original cost and stock. Blank stock means unlimited.",
          "حدد التكلفة والمخزون. المخزون الفارغ غير محدود.",
        )}
      >
        <form onSubmit={create} className="space-y-4">
          {(
            [
              ["title_en", l("English reward title", "اسم المكافأة بالإنجليزية")],
              ["title_ar", l("Arabic reward title", "اسم المكافأة بالعربية")],
              ["cost", l("PV cost", "التكلفة بالنقاط")],
              ["stock", l("Stock (blank = unlimited)", "المخزون (فارغ = غير محدود)")],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="block text-sm">
              {label}
              <Input
                className="mt-1"
                disabled={!!pending || !!review}
                inputMode={key === "cost" || key === "stock" ? "numeric" : undefined}
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              />
            </label>
          ))}
          {pending && (
            <p role="status" className="text-sm">
              {l(
                "Retry the same request to confirm its outcome.",
                "أعد محاولة الطلب نفسه لتأكيد النتيجة.",
              )}
            </p>
          )}
          {error && (
            <p role="alert" className="text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" disabled={!ready || !!review}>
            {l("Review new reward", "مراجعة مكافأة جديدة")}
          </Button>
        </form>
      </AdminEditorDrawer>
      <AdminChangeReview review={review} close={() => setReview(null)} />
      <AdminDraftWarning
        dirty={
          !!review ||
          !!pending ||
          Object.values(form).some(Boolean) ||
          Object.values(notes).some((v) => !!v.trim())
        }
      />
    </>
  );
}
