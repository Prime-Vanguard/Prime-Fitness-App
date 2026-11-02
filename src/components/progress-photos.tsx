import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PhotoHistoryComparison } from "@/components/photo-history-comparison";
import { PrivatePhoto } from "@/components/private-photo";
import { loadPhotoPage, signHistoryPhotos } from "@/lib/photo-history";
import { Camera, Lock, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useI18n, type TKey } from "@/lib/i18n";
import { normalizePhoto } from "@/lib/photo-files";
import {
  deleteProgressPhoto,
  pendingPhotoDeletions,
  queuePhotoDeletion,
} from "@/lib/photo-deletion";

const POSES = ["front", "side", "back"] as const;

export function ProgressPhotos({
  userId,
  readOnly = false,
}: {
  userId: string;
  readOnly?: boolean;
}) {
  const { t, locale } = useI18n();
  const qc = useQueryClient();
  const [pose, setPose] = useState<(typeof POSES)[number]>("front");
  const [busy, setBusy] = useState(false);
  const [operationError, setOperationError] = useState("");
  const l = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const file = useRef<HTMLInputElement>(null);
  const key = ["photos", userId];
  const [page, setPage] = useState(0);
  useEffect(() => setPage(0), [userId]);

  const {
    data: result,
    error,
    isPending,
    refetch,
  } = useQuery({
    queryKey: [...key, "gallery", page],
    retry: false,
    staleTime: 30 * 60 * 1000,
    refetchInterval: 45 * 60 * 1000,
    queryFn: async () => {
      const history = await loadPhotoPage(userId, { page });
      const data = history.photos;
      const pending = readOnly ? [] : await pendingPhotoDeletions(userId);
      const queued = new Set(pending.map((row) => row.photo_id));
      const visible = data.filter((photo) => !queued.has(photo.id));
      return { photos: await signHistoryPhotos(visible), pending, hasOlder: history.hasOlder };
    },
  });
  const data = result?.photos;
  const pending = result?.pending ?? [];

  async function upload(f: File) {
    if (busy) return;
    setBusy(true);
    setOperationError("");
    try {
      const blob = await normalizePhoto(f);
      const photo = {
        id: crypto.randomUUID(),
        member_id: userId,
        path: `${userId}/${crypto.randomUUID()}.jpg`,
      };
      // No file is uploaded until a durable metadata reference is acknowledged.
      const entry = await supabase
        .from("progress_photos")
        .insert({
          ...photo,
          pose,
          taken_on: new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Cairo" }),
        })
        .select("id")
        .single();
      if (entry.error)
        throw new Error(
          `${entry.error.message} ${l("No file was uploaded. An unfinished entry may need removal after reconnecting.", "لم يتم رفع ملف. قد تحتاج إلى إزالة سجل غير مكتمل بعد الاتصال.")}`,
        );
      const up = await supabase.storage
        .from("progress-photos")
        .upload(photo.path, blob, { contentType: "image/jpeg" });
      if (up.error) {
        try {
          await queuePhotoDeletion(photo);
        } catch {
          /* Metadata retains the recovery path even if queuing is offline. */
        }
        throw new Error(
          l(
            "Upload was not confirmed. The unfinished entry was retained; remove it when connected.",
            "لم يتم تأكيد الرفع. تم الاحتفاظ بالسجل غير المكتمل؛ احذفه عند الاتصال.",
          ),
        );
      }
      toast.success(t("saved"));
    } catch (error) {
      setOperationError(
        (error as { message?: string }).message || l("Photo upload failed.", "تعذر رفع الصورة."),
      );
    } finally {
      await qc.invalidateQueries({ queryKey: key });
      setBusy(false);
    }
  }
  async function del(id: string, path: string) {
    if (busy) return;
    setBusy(true);
    setOperationError("");
    try {
      await deleteProgressPhoto({ id, member_id: userId, path });
      toast.success(l("Photo removed", "تم حذف الصورة"));
    } catch {
      setOperationError(
        l(
          "Deletion is incomplete. The file may still be stored. Reconnect and retry removal.",
          "الحذف غير مكتمل وقد يظل الملف مخزناً. أعد الاتصال وحاول الحذف مجدداً.",
        ),
      );
    } finally {
      await qc.invalidateQueries({ queryKey: key });
      setBusy(false);
    }
  }

  return (
    <section className="mt-6 rounded-xl border border-border bg-card p-5">
      <h2 className="flex items-center gap-2 font-display text-lg font-bold">
        <Camera className="h-5 w-5 text-gold" />
        {t("photos")}
      </h2>
      <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
        <Lock className="h-3 w-3" />
        {t("photosPrivate")}
      </p>
      {!readOnly && (
        <p className="mt-1 text-xs text-muted-foreground">
          {l(
            "New photos are converted to JPEG. Pending deletions are excluded from backups.",
            "تُحوّل الصور الجديدة إلى JPEG. تُستبعد الصور المنتظر حذفها من النسخ الاحتياطية.",
          )}
        </p>
      )}
      {operationError && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {operationError}
        </p>
      )}
      {error && (
        <div role="alert" className="mt-3 text-sm text-destructive">
          {l("Photos could not be loaded.", "تعذر تحميل الصور.")}
          <Button variant="ghost" size="sm" onClick={() => void refetch()}>
            {l("Retry", "إعادة المحاولة")}
          </Button>
        </div>
      )}
      {isPending && (
        <p role="status" className="mt-3 text-sm">
          {l("Loading photos…", "جارٍ تحميل الصور…")}
        </p>
      )}
      {!readOnly && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {POSES.map((p) => (
            <button
              key={p}
              onClick={() => setPose(p)}
              className={`rounded-full px-3 py-1 text-xs ${pose === p ? "bg-gold text-primary-foreground" : "bg-muted text-muted-foreground"}`}
            >
              {t(`pose_${p}` as TKey)}
            </button>
          ))}
          <input
            ref={file}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,image/avif,image/bmp"
            aria-label={l("Choose progress photo", "اختر صورة التقدم")}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f);
              e.target.value = "";
            }}
          />
          <Button size="sm" disabled={busy} onClick={() => file.current?.click()}>
            {busy ? "…" : t("addPhoto")}
          </Button>
        </div>
      )}
      {pending.length > 0 && (
        <ul
          aria-label={l("Pending photo deletions", "الصور المنتظر حذفها")}
          className="mt-4 space-y-2"
        >
          {pending.map((photo) => (
            <li key={photo.photo_id} className="rounded-lg border border-border p-3 text-sm">
              <p>
                {l(
                  "Deletion pending — file may still be stored.",
                  "الحذف قيد الانتظار وقد يظل الملف مخزناً.",
                )}
              </p>
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => void del(photo.photo_id, photo.path)}
              >
                {l("Retry removal", "إعادة محاولة الحذف")}
              </Button>
            </li>
          ))}
        </ul>
      )}
      {!isPending && !error && !data?.length ? (
        <p className="mt-3 text-sm text-muted-foreground">{t("noPhotos")}</p>
      ) : (
        <ul className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4">
          {data?.map((p) => (
            <li
              key={p.id}
              className="group relative overflow-hidden rounded-lg border border-border"
            >
              <PrivatePhoto
                key={p.id}
                url={p.url}
                alt={`${t(`pose_${p.pose}` as TKey)} ${p.taken_on}`}
                className="aspect-[3/4] w-full bg-muted"
                onRenew={() => void refetch({ cancelRefetch: false })}
              />
              <div className="flex items-center justify-between gap-1 px-2 py-1 text-[11px] text-muted-foreground">
                <span>
                  {t(`pose_${p.pose}` as TKey)} ·{" "}
                  {new Date(p.taken_on + "T12:00:00").toLocaleDateString(
                    locale === "ar" ? "ar-EG" : "en-GB",
                    { day: "numeric", month: "short" },
                  )}
                </span>
                {!readOnly && (
                  <button
                    disabled={busy}
                    aria-label={t("delete")}
                    onClick={() => void del(p.id, p.path)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <nav
        aria-label={l("Photo history pages", "صفحات سجل الصور")}
        className="mt-4 flex flex-wrap items-center gap-2"
      >
        <Button
          variant="outline"
          disabled={page === 0 || isPending}
          onClick={() => setPage((p) => p - 1)}
        >
          {l("Newer photos", "صور أحدث")}
        </Button>
        <span className="text-xs">
          {l("Page", "صفحة")} {page + 1}
        </span>
        <Button
          variant="outline"
          disabled={!result?.hasOlder || isPending}
          onClick={() => setPage((p) => p + 1)}
        >
          {l("Older photos", "صور أقدم")}
        </Button>
      </nav>
      <PhotoHistoryComparison
        key={userId}
        userId={userId}
        excluded={pending.map((p) => p.photo_id)}
      />
    </section>
  );
}
