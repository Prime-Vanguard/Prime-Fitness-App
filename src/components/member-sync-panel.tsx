import { useRef, useState, type ReactNode } from "react";
import { useI18n } from "@/lib/i18n";
import {
  changeMemberState,
  resolveMemberConflict,
  syncMemberEntries,
  type MemberState,
  type MemberMutation,
} from "@/lib/member-store";
import { entityLabel, conflictFields, mutationSummary } from "@/lib/recovery-presentation";
import { adminDate } from "@/lib/admin-format";
import { AdminChangeReview, type AdminReview } from "./admin-change-review";
import { Button } from "./ui/button";
export function MemberSyncPanel({
  userId,
  state,
  error,
}: {
  userId: string;
  state: MemberState;
  error: string;
}) {
  const { locale } = useI18n(),
    ar = locale === "ar",
    l = (en: string, arabic: string) => (ar ? arabic : en);
  const [review, setReview] = useState<AdminReview | null>(null),
    [failure, setFailure] = useState(""),
    [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const counts = mutationSummary(state.queue);
  async function retry() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setFailure("");
    try {
      await changeMemberState(userId, (s) => ({
        ...s,
        queue: s.queue.map((m) =>
          m.status === "rejected" ? { ...m, status: "queued", error: undefined } : m,
        ),
      }));
      await syncMemberEntries(userId);
    } catch (e) {
      setFailure((e as Error).message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function download() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(state)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "prime-fitness-pending-member-data.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function value(v: unknown, depth = 0): ReactNode {
    if (v == null) return l("Not recorded", "غير مسجل");
    if (typeof v !== "object") return String(v);
    if (depth >= 3) return l("See technical details", "راجع التفاصيل التقنية");
    if (Array.isArray(v))
      return (
        <details>
          <summary>
            {v.length} {l("ingredients / items", "مكونات / عناصر")}
          </summary>
          <ul className="space-y-2">
            {v.slice(0, 100).map((item, i) => (
              <li key={i} className="rounded border border-border p-2">
                {value(item, depth + 1)}
              </li>
            ))}
          </ul>
          {v.length > 100 && (
            <p>{l("More items in technical details", "عناصر إضافية في التفاصيل التقنية")}</p>
          )}
        </details>
      );
    const fields = conflictFields(v as MemberMutation["payload"], null, ar);
    return fields.length ? (
      <dl className="space-y-1">
        {fields.map((field) => (
          <div key={field.key}>
            <dt className="text-xs text-muted-foreground">{field.label}</dt>
            <dd>{value(field.local, depth + 1)}</dd>
          </div>
        ))}
      </dl>
    ) : (
      l("See technical details", "راجع التفاصيل التقنية")
    );
  }
  function resolve(m: MemberMutation, choice: "local" | "server") {
    const reviewed = state.queue.filter(
        (q) => q.entity === m.entity && q.record_id === m.record_id,
      ),
      latest = reviewed.at(-1)!;
    setReview({
      title: l("Review conflict choice", "مراجعة حل التعارض"),
      description: entityLabel(m.entity, ar),
      details: (
        <div className="space-y-3 text-sm">
          <p>
            {choice === "server"
              ? l(
                  "Use the server record and discard this record’s unsynced device changes.",
                  "اعتماد سجل الخادم وإزالة تغييرات هذا السجل غير المتزامنة على الجهاز.",
                )
              : latest.op === "delete"
                ? l(
                    "Submit the device deletion against the latest server revision. The server must accept it before it is synchronized.",
                    "إرسال حذف الجهاز وفق أحدث إصدار للخادم. لا يكتمل التزامن حتى يقبله الخادم.",
                  )
                : l(
                    "Submit the device values against the latest server revision. Another conflict may still need review.",
                    "إرسال قيم الجهاز وفق أحدث إصدار للخادم. قد يتطلب تعارض آخر مراجعة.",
                  )}
          </p>
          <p>
            {l(
              "Other records are retained. No choice awards XP locally.",
              "تبقى السجلات الأخرى. لا يمنح أي خيار نقاطاً محلياً.",
            )}
          </p>
        </div>
      ),
      save: async () => {
        await resolveMemberConflict(userId, m.id, choice, reviewed);
      },
    });
  }
  if (!state.queue.length && !error && !failure) return null;
  return (
    <section
      className="my-4 space-y-4 rounded-xl border border-amber-500/40 p-4"
      aria-label={l("Member sync", "مزامنة السجلات")}
    >
      <h2 className="font-semibold">{l("Sync & recovery", "المزامنة والاسترداد")}</h2>
      <p role="status">
        {error ? "—" : state.queue.length}{" "}
        {l(
          "entries saved on this device · rewards await server confirmation",
          "سجلات محفوظة على الجهاز · المكافآت تنتظر تأكيد الخادم",
        )}
      </p>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        {(
          [
            ["queued", l("Waiting to sync", "بانتظار التزامن")],
            ["sending", l("Sending", "جارٍ الإرسال")],
            ["conflict", l("Needs comparison", "تحتاج مقارنة")],
            ["rejected", l("Needs attention", "تحتاج معالجة")],
          ] as const
        ).map(([key, label]) => (
          <div key={key}>
            <dt className="text-muted-foreground">{label}</dt>
            <dd>{error ? "—" : counts[key]}</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-muted-foreground">
        {l("Last successful sync", "آخر مزامنة ناجحة")}: {adminDate(state.lastSync, locale)}
      </p>
      {(error || failure) && (
        <p role="alert" className="break-words text-destructive">
          {error || failure}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        {l(
          "Reconnect or sign in again to resume. For access or validation errors, correct the cause before retrying. Unsynced records are retained.",
          "اتصل أو سجل الدخول لاستئناف المزامنة. أصلح سبب أخطاء الصلاحية أو القيم قبل إعادة المحاولة. تبقى السجلات غير المتزامنة محفوظة.",
        )}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={busy || !!review} onClick={() => void retry()}>
          {busy ? l("Retrying…", "جارٍ إعادة المحاولة…") : l("Retry", "إعادة المحاولة")}
        </Button>
        <Button variant="outline" disabled={!!error} onClick={download}>
          {l("Export pending data", "تصدير البيانات المعلقة")}
        </Button>
      </div>
      <p className="text-xs">
        {Object.entries(
          state.queue.reduce<Record<string, number>>(
            (all, m) => ({ ...all, [m.entity]: (all[m.entity] ?? 0) + 1 }),
            {},
          ),
        )
          .map(
            ([entity, count]) => `${entityLabel(entity as MemberMutation["entity"], ar)}: ${count}`,
          )
          .join(" · ")}
      </p>
      {state.queue
        .filter((m) => m.status === "conflict" || m.status === "rejected")
        .map((m) => {
          const latest = state.queue
              .filter((q) => q.entity === m.entity && q.record_id === m.record_id)
              .at(-1)!,
            fields = conflictFields(latest.payload, m.server, ar);
          return (
            <article key={m.id} className="space-y-3 rounded-lg border border-border p-3">
              <h3 className="font-medium">
                {entityLabel(m.entity, ar)} ·{" "}
                {m.status === "conflict"
                  ? l("Conflicting changes", "تغييرات متعارضة")
                  : l("Not accepted by server", "لم يقبله الخادم")}
              </h3>
              <p className="break-words text-sm">{m.error}</p>
              <p className="text-sm">
                {l("Device action", "إجراء الجهاز")}:{" "}
                {latest.op === "delete"
                  ? l("Delete this record", "حذف هذا السجل")
                  : l("Save these values", "حفظ هذه القيم")}
                {m.status === "conflict" && m.server === null
                  ? ` · ${l("No server record", "لا يوجد سجل على الخادم")}`
                  : m.status === "conflict" && m.server === undefined
                    ? ` · ${l("Server snapshot unavailable", "نسخة الخادم غير متاحة")}`
                    : ""}
              </p>
              <div className="space-y-2">
                {fields.map((field) => (
                  <div
                    key={field.key}
                    className={`rounded-lg border p-3 ${field.changed ? "border-amber-500/50" : "border-border"}`}
                  >
                    <p className="text-sm font-medium">
                      {field.label}
                      {field.changed ? ` · ${l("Different", "مختلف")}` : ""}
                    </p>
                    <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="text-xs text-muted-foreground">
                          {l("Device version", "نسخة الجهاز")}
                        </dt>
                        <dd className="whitespace-pre-wrap break-words">{value(field.local)}</dd>
                      </div>
                      {m.status === "conflict" && (
                        <div>
                          <dt className="text-xs text-muted-foreground">
                            {l("Server version", "نسخة الخادم")}
                          </dt>
                          <dd className="whitespace-pre-wrap break-words">
                            {m.server === undefined
                              ? l("Not available", "غير متاح")
                              : value(field.server)}
                          </dd>
                        </div>
                      )}
                    </dl>
                  </div>
                ))}
              </div>
              <details>
                <summary className="text-sm">{l("Technical details", "التفاصيل التقنية")}</summary>
                <pre className="max-h-64 overflow-auto text-xs" dir="ltr">
                  {JSON.stringify({ operation: latest, server: m.server ?? null }, null, 2)}
                </pre>
              </details>
              {m.status === "conflict" && (
                <>
                  <p className="text-xs">
                    {m.server_revision == null
                      ? l(
                          "Resolve the conflicting ingredient first, then retry the grouped meal.",
                          "عالج تعارض المكوّن أولاً ثم أعد محاولة الوجبة المجمعة.",
                        )
                      : l(
                          "Choose deliberately; server and device changes are not merged automatically.",
                          "اختر بعناية؛ لا تُدمج تغييرات الجهاز والخادم تلقائياً.",
                        )}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      disabled={m.server_revision == null || busy || !!review}
                      onClick={() => resolve(m, "server")}
                    >
                      {l("Keep server", "اعتماد الخادم")}
                    </Button>
                    <Button
                      variant="outline"
                      disabled={m.server_revision == null || busy || !!review}
                      onClick={() => resolve(m, "local")}
                    >
                      {l("Submit device version", "إرسال نسخة الجهاز")}
                    </Button>
                  </div>
                </>
              )}
            </article>
          );
        })}
      <details>
        <summary>{l("Remove device data", "إزالة بيانات الجهاز")}</summary>
        <p className="my-3 text-sm">
          {l(
            "Export first. Removal permanently discards unsynced member entries and cached references from this device. Unconfirmed reward requests must be resolved first.",
            "صدّر أولاً. الإزالة تحذف سجلات العضو غير المتزامنة والمراجع المخزنة من هذا الجهاز نهائياً. يجب حسم طلبات المكافآت غير المؤكدة أولاً.",
          )}
        </p>
        <Button
          variant="destructive"
          disabled={busy || !!review}
          onClick={() => {
            const expected = JSON.stringify(state);
            setReview({
              title: l("Review device-data removal", "مراجعة إزالة بيانات الجهاز"),
              description: l(
                "This affects only this device’s member cache.",
                "يؤثر ذلك في ذاكرة العضو على هذا الجهاز فقط.",
              ),
              details: (
                <p>
                  {state.queue.length}{" "}
                  {l(
                    "unsynced entries will be removed. Server records are kept. Export first if you need these entries.",
                    "سجلات غير متزامنة ستُحذف. تبقى سجلات الخادم. صدّرها أولاً إذا كنت تحتاجها.",
                  )}
                </p>
              ),
              save: async () => {
                await changeMemberState(userId, (current) => {
                  if (
                    Array.isArray(current.references["redemption-intents"]) &&
                    current.references["redemption-intents"].length
                  )
                    throw new Error(
                      l(
                        "Resolve unconfirmed reward requests in Rewards before removing device data.",
                        "تحقق من طلبات المكافآت غير المؤكدة في صفحة المكافآت قبل إزالة بيانات الجهاز.",
                      ),
                    );
                  if (JSON.stringify(current) !== expected)
                    throw new Error(
                      l(
                        "Device data changed. Review removal again; nothing was removed.",
                        "تغيرت بيانات الجهاز. راجع الإزالة مجدداً؛ لم يُحذف شيء.",
                      ),
                    );
                  return { version: 1, records: {}, queue: [], references: {}, lastSync: null };
                });
              },
            });
          }}
        >
          {l("Remove device data", "إزالة بيانات الجهاز")}
        </Button>
      </details>
      <AdminChangeReview review={review} close={() => setReview(null)} />
    </section>
  );
}
