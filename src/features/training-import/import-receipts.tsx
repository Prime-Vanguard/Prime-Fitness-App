import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { AdminChangeReview, type AdminReview } from "@/components/admin-change-review";
import { importReceipt } from "@/lib/import-receipt";
import { adminDate } from "@/lib/admin-format";
export function ImportReceipts({
  userId,
  busy,
  onReport,
}: {
  userId: string;
  busy: boolean;
  onReport: (message: string) => void;
}) {
  const { locale } = useI18n();
  const l = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const qc = useQueryClient();
  const [batchPage, setBatchPage] = useState(0);
  const [undoReview, setUndoReview] = useState<AdminReview | null>(null);
  const {
    data: batches,
    error: batchesError,
    refetch: retryBatches,
  } = useQuery({
    queryKey: ["import-batches", userId, batchPage],
    enabled: true,
    queryFn: async () => {
      const r = await supabase
        .from("import_batches")
        .select("*")
        .eq("member_id", userId)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(batchPage * 20, batchPage * 20 + 19);
      if (r.error) throw r.error;
      return r.data;
    },
  });
  return (
    <>
      {" "}
      <details>
        <summary>{l("Recent import receipts", "إيصالات الاستيراد الأخيرة")}</summary>
        {batchesError && (
          <div role="alert">
            {l("Receipts could not be loaded.", "تعذر تحميل الإيصالات.")}
            <Button variant="outline" onClick={() => void retryBatches()}>
              {l("Retry receipts", "إعادة تحميل الإيصالات")}
            </Button>
          </div>
        )}
        {batches?.map((b) => (
          <div className="my-2 flex flex-wrap gap-2 text-sm" key={b.id}>
            <span>
              {b.provider} · {adminDate(b.created_at, locale)}
            </span>
            <ImportOutcome userId={userId} batchId={b.id} />
            <Button
              size="sm"
              variant="outline"
              disabled={busy || !!undoReview}
              onClick={() =>
                setUndoReview({
                  title: l(
                    "Review import undo",
                    "\u0645\u0631\u0627\u062c\u0639\u0629 \u0627\u0644\u062a\u0631\u0627\u062c\u0639",
                  ),
                  description: `${b.provider} · ${adminDate(b.created_at, locale)}`,
                  details: (
                    <p>
                      {l(
                        "Remove only unchanged workouts from this batch. Edited records are kept. The returned counts describe this attempt.",
                        "\u062a\u0632\u0627\u0644 \u0627\u0644\u062c\u0644\u0633\u0627\u062a \u063a\u064a\u0631 \u0627\u0644\u0645\u0639\u062f\u0644\u0629 \u0641\u0642\u0637. \u062a\u0628\u0642\u0649 \u0627\u0644\u0633\u062c\u0644\u0627\u062a \u0627\u0644\u0645\u0639\u062f\u0644\u0629. \u0627\u0644\u0623\u0639\u062f\u0627\u062f \u062a\u062e\u0635 \u0647\u0630\u0647 \u0627\u0644\u0645\u062d\u0627\u0648\u0644\u0629.",
                      )}
                    </p>
                  ),
                  save: async () => {
                    const r = await supabase.rpc("undo_training_import", { _batch: b.id });
                    if (r.error) throw r.error;
                    const result = r.data as { removed: number; edited: number };
                    if (
                      !result ||
                      !Number.isSafeInteger(result.removed) ||
                      !Number.isSafeInteger(result.edited) ||
                      result.removed < 0 ||
                      result.edited < 0
                    )
                      throw new Error(
                        "Undo outcome is unavailable. Refresh receipts before another attempt.",
                      );
                    onReport(
                      `${result.removed} ${l("unchanged workouts removed", "\u062c\u0644\u0633\u0627\u062a \u063a\u064a\u0631 \u0645\u0639\u062f\u0644\u0629 \u062a\u0645\u062a \u0625\u0632\u0627\u0644\u062a\u0647\u0627")} ? ${result.edited} ${l("edited workouts retained", "\u062c\u0644\u0633\u0627\u062a \u0645\u0639\u062f\u0644\u0629 \u062a\u0645 \u0627\u0644\u0627\u062d\u062a\u0641\u0627\u0638 \u0628\u0647\u0627")}`,
                    );
                    void qc.invalidateQueries();
                  },
                })
              }
            >
              {l("Undo unchanged workouts", "التراجع عن الجلسات غير المعدلة")}
            </Button>
          </div>
        ))}
        <div className="flex gap-2">
          <Button variant="ghost" disabled={!batchPage} onClick={() => setBatchPage((p) => p - 1)}>
            {l("Previous receipts", "الإيصالات السابقة")}
          </Button>
          <Button
            variant="ghost"
            disabled={(batches?.length ?? 0) < 20}
            onClick={() => setBatchPage((p) => p + 1)}
          >
            {l("Older receipts", "إيصالات أقدم")}
          </Button>
        </div>
      </details>
      <AdminChangeReview review={undoReview} close={() => setUndoReview(null)} />
    </>
  );
}
function ImportOutcome({ userId, batchId }: { userId: string; batchId: string }) {
  const [open, setOpen] = useState(false);
  const { locale } = useI18n();
  const l = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const { data, error, refetch, isPending } = useQuery({
    queryKey: ["import-outcome", userId, batchId],
    enabled: open,
    queryFn: async () => {
      const r = await supabase.rpc("get_import_batch_outcome", { _batch: batchId });
      if (r.error) throw r.error;
      return importReceipt(r.data);
    },
  });
  return (
    <details onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>{l("Durable outcome", "النتيجة المحفوظة")}</summary>
      {error ? (
        <div role="alert">
          <Button variant="outline" onClick={() => void refetch()}>
            {l(
              "Retry receipt",
              "\u0625\u0639\u0627\u062f\u0629 \u062a\u062d\u0645\u064a\u0644 \u0627\u0644\u0625\u064a\u0635\u0627\u0644",
            )}
          </Button>
          {l("Receipt unavailable; retry when connected.", "الإيصال غير متاح؛ حاول عند الاتصال.")}
        </div>
      ) : (
        <p role={isPending ? "status" : undefined}>
          {data?.accepted ?? "—"} {l("accepted", "مقبول")} · {data?.skipped ?? "—"}{" "}
          {l("duplicates skipped", "مكرر مستبعد")} · {data?.chunks ?? "—"} {l("chunks", "أجزاء")}
        </p>
      )}
    </details>
  );
}
