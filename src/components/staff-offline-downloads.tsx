import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";
import { readOfflineIdentity } from "@/lib/offline-access";
import { watchMemberState } from "@/lib/member-store";
import { downloadStaffSummary, revalidateStaffSummaries } from "@/lib/staff-offline-downloads";
import { changeStaffOfflineSummaries, readStaffOfflineSummaries } from "@/lib/staff-offline-store";
import { revalidateOfflineTargets } from "@/lib/offline-target-drafts";
import { Button } from "./ui/button";

const online = () => navigator.onLine;
function subscribeConnection(refresh: () => void) {
  window.addEventListener("online", refresh);
  window.addEventListener("offline", refresh);
  return () => {
    window.removeEventListener("online", refresh);
    window.removeEventListener("offline", refresh);
  };
}

export function StaffSummaryDownloadButton({
  actor,
  memberId,
}: {
  actor: string;
  memberId: string;
}) {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const isOnline = useSyncExternalStore(subscribeConnection, online, () => true);
  const [status, setStatus] = useState<"idle" | "loading" | "saved" | "denied" | "full" | "error">(
    "idle",
  );
  const lock = useRef(false);
  const queryClient = useQueryClient();
  if (actor === memberId) return null;
  async function download() {
    if (lock.current) return;
    lock.current = true;
    setStatus("loading");
    try {
      const result = await downloadStaffSummary(actor, memberId);
      setStatus(result);
      if (result === "saved" || result === "denied")
        void queryClient.invalidateQueries({ queryKey: ["staff-offline", actor] });
    } catch {
      setStatus("error");
    } finally {
      lock.current = false;
    }
  }
  const messages = {
    saved: ar ? "تم حفظ الملخص على هذا الجهاز." : "Summary saved on this device.",
    denied: ar
      ? "لم يعد تنزيل ملخص هذا العضو متاحًا."
      : "Access to this member’s summary is unavailable.",
    full: ar ? "أزل ملخصًا محفوظًا لإفساح المجال." : "Remove a saved summary to make room.",
    error: ar
      ? "تعذر الحفظ. تحقق من الاتصال وأعد المحاولة."
      : "Could not save the summary. Reconnect and retry.",
  };
  return (
    <div className="space-y-2">
      <Button
        variant="outline"
        disabled={!isOnline || status === "loading"}
        onClick={() => void download()}
      >
        {status === "loading"
          ? ar
            ? "جارٍ الحفظ…"
            : "Saving…"
          : ar
            ? "حفظ ملخص للاستخدام دون اتصال"
            : "Save summary for offline use"}
      </Button>
      {status !== "idle" && status !== "loading" && (
        <p role={status === "saved" ? "status" : "alert"} className="text-sm">
          {messages[status]}{" "}
          {(status === "saved" || status === "full") && (
            <Link className="underline" to="/profile" search={{ section: "offline" }}>
              {ar ? "عرض الملخصات المحفوظة" : "View saved summaries"}
            </Link>
          )}
        </p>
      )}
    </div>
  );
}

export function StaffOfflineDownloads({ actor, showEmpty }: { actor: string; showEmpty: boolean }) {
  const { locale, t } = useI18n();
  const ar = locale === "ar";
  const isOnline = useSyncExternalStore(subscribeConnection, online, () => true);
  const [removing, setRemoving] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const summaries = useQuery({
    queryKey: ["staff-offline", actor, isOnline],
    networkMode: "always",
    queryFn: () => (isOnline ? revalidateStaffSummaries(actor) : readStaffOfflineSummaries(actor)),
    retry: false,
  });
  const { refetch } = summaries;
  useEffect(() => {
    if (isOnline) return;
    return watchMemberState(() => {
      void refetch();
    });
  }, [isOnline, refetch]);
  if (readOfflineIdentity()?.id !== actor) return null;
  const rows = !summaries.error && !summaries.isFetching ? (summaries.data ?? []) : [];
  const empty = showEmpty && summaries.isSuccess && !summaries.isFetching && !rows.length;
  if (!rows.length && !empty && !summaries.error && !failed) return null;
  async function remove(memberId: string) {
    if (removing) return;
    setRemoving(memberId);
    setFailed(false);
    try {
      await changeStaffOfflineSummaries(actor, (current) =>
        current.filter((row) => row.memberId !== memberId),
      );
      await summaries.refetch();
    } catch {
      setFailed(true);
    } finally {
      setRemoving(null);
    }
  }
  const heading = ar ? "ملخصات الفريق المحفوظة" : "Saved staff summaries";
  return (
    <section aria-label={heading} className="space-y-3 rounded-xl border border-border p-4">
      <h3 className="font-semibold">{heading}</h3>
      <p className="text-sm text-muted-foreground">
        {ar
          ? "ملخصات للقراءة فقط وفق تواريخ القاهرة. يتم التحقق من الصلاحيات مجددًا عند الاتصال."
          : "Read-only snapshots using Cairo dates. Access is checked again when connected."}
      </p>
      {(summaries.error || failed) && (
        <p role="alert" className="text-sm">
          {ar
            ? "تعذر التحقق من الملخصات المحفوظة أو تحديثها."
            : "Could not verify or update saved summaries."}
        </p>
      )}
      {empty && (
        <p role="status" className="text-sm">
          {ar
            ? "لا توجد ملخصات محفوظة على هذا الجهاز."
            : "No staff summaries saved on this device."}
        </p>
      )}
      {rows.map((row) => (
        <article key={row.memberId} className="space-y-2 rounded-lg border border-border p-3">
          <h4 className="break-words font-medium">{row.displayName || t("member")}</h4>
          <p className="text-sm">
            {ar ? "تمارين مكتملة" : "Completed workouts"}: {row.completedThisWeek} ·{" "}
            <bdi dir="ltr">
              {row.from} – {row.to}
            </bdi>
          </p>
          <p className="text-sm">
            {t("lastWorkout")}: <bdi>{row.lastWorkout ?? t("never")}</bdi>
          </p>
          <Button
            variant="outline"
            disabled={removing !== null}
            onClick={() => void remove(row.memberId)}
          >
            {ar ? "إزالة الملخص من الجهاز" : "Remove summary from device"}
          </Button>
        </article>
      ))}
    </section>
  );
}

export function StaffOfflineRevalidation({ actor }: { actor: string }) {
  const queryClient = useQueryClient();
  useEffect(() => {
    const check = () => {
      if (!navigator.onLine) return;
      void revalidateOfflineTargets(actor)
        .then((rows) => {
          if (readOfflineIdentity()?.id === actor)
            queryClient.setQueryData(["offline-nutrition-targets", actor, false], rows);
        })
        .catch(() => {});
      void revalidateStaffSummaries(actor)
        .then((rows) => {
          if (readOfflineIdentity()?.id === actor)
            queryClient.setQueryData(["staff-offline", actor, false], rows);
        })
        .catch(() => {});
    };
    check();
    window.addEventListener("online", check);
    window.addEventListener("focus", check);
    return () => {
      window.removeEventListener("online", check);
      window.removeEventListener("focus", check);
    };
  }, [actor, queryClient]);
  return null;
}
