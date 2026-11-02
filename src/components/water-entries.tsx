import { useRef, useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "./ui/sheet";
import { useI18n } from "@/lib/i18n";
import { syncMemberEntries, type MemberState } from "@/lib/member-store";
import {
  waterEntry,
  waterUndoEntries,
  waterEditAllowsMissing,
  saveWaterEdit,
  deleteWaterEntry,
  finishWaterDeletion,
  restoreWaterEntry,
  dismissWaterUndo,
  type WaterEntry,
  type WaterUndo,
} from "@/lib/water-entries";
export function WaterEntries({
  user,
  rows,
  references,
  queued,
  onChanged,
}: {
  user: string;
  rows: readonly Record<string, unknown>[];
  references: MemberState["references"];
  queued: boolean;
  onChanged: () => Promise<unknown>;
}) {
  const { locale } = useI18n(),
    ar = locale === "ar",
    l = (en: string, arabic: string) => (ar ? arabic : en);
  const [open, setOpen] = useState(false),
    [editing, setEditing] = useState<{ record: WaterEntry; allowMissing: boolean } | null>(null),
    [amount, setAmount] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const lock = useRef(false);
  let undos: WaterUndo[] = [],
    recoveryError = "";
  try {
    undos = waterUndoEntries(references);
  } catch {
    recoveryError = l(
      "Could not read water recovery data. Export device data before removing it.",
      "تعذر قراءة بيانات استعادة المياه. صدّر بيانات الجهاز قبل إزالتها.",
    );
  }
  async function action(task: () => Promise<void>, sync = queued) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await task();
      if (sync) void syncMemberEntries(user).catch(() => {});
      await onChanged();
    } catch (cause) {
      setError(
        l(
          (cause as { message?: string } | null)?.message ?? "Could not save this change.",
          "تعذر تنفيذ التغيير. احتُفظ بالبيانات؛ حدّث الصفحة وأعد المحاولة.",
        ),
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      <Button variant="ghost" onClick={() => setOpen(true)}>
        {l("Manage water entries", "إدارة سجلات المياه")}
        {undos.length ? ` (${undos.length})` : ""}
      </Button>
      <Sheet
        open={open}
        onOpenChange={(value) => {
          if (!lock.current) setOpen(value);
        }}
      >
        <SheetContent
          side={ar ? "left" : "right"}
          className="w-full overflow-y-auto sm:max-w-lg"
          dir={ar ? "rtl" : "ltr"}
        >
          <SheetHeader>
            <SheetTitle>{l("Water entries", "سجلات المياه")}</SheetTitle>
            <SheetDescription>
              {l(
                "Adjust the amount you drank or restore a deleted entry.",
                "عدّل كمية المياه التي شربتها أو استعد سجلًا محذوفًا.",
              )}
            </SheetDescription>
          </SheetHeader>
          {(error || recoveryError) && (
            <p role="alert" className="mt-4 text-sm text-destructive">
              {error || recoveryError}
            </p>
          )}
          {editing && (
            <form
              className="mt-4 rounded-xl border border-gold/50 p-4"
              onSubmit={(event) => {
                event.preventDefault();
                void action(async () => {
                  await saveWaterEdit(user, editing.record, amount, queued, editing.allowMissing);
                  setEditing(null);
                });
              }}
            >
              <p className="text-sm text-muted-foreground">{editing.record.log_date}</p>
              <label className="mt-2 block text-sm">
                {l("Water amount (ml)", "كمية المياه (مل)")}
                <Input
                  inputMode="numeric"
                  value={amount}
                  disabled={busy}
                  onChange={(event) => setAmount(event.target.value)}
                />
              </label>
              <div className="mt-3 flex gap-2">
                <Button disabled={busy} type="submit">
                  {l("Save water changes", "حفظ تعديل المياه")}
                </Button>
                <Button
                  disabled={busy}
                  type="button"
                  variant="outline"
                  onClick={() => setEditing(null)}
                >
                  {l("Cancel", "إلغاء")}
                </Button>
              </div>
            </form>
          )}
          {undos.length > 0 && (
            <section
              aria-label={l("Deleted water recovery", "استعادة سجلات المياه")}
              className="mt-4 space-y-3"
            >
              {undos.map((undo) => (
                <div key={undo.token} className="rounded-xl border border-gold/50 p-3 text-sm">
                  <p>
                    <bdi dir="ltr">
                      {undo.record.ml} {l("ml", "مل")}
                    </bdi>{" "}
                    · <bdi dir="ltr">{undo.record.log_date}</bdi> ·{" "}
                    {undo.status === "deleting"
                      ? l("Deletion not confirmed", "الحذف غير مؤكد")
                      : l("Deleted; Undo available", "محذوف؛ يمكن الاستعادة")}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {undo.status === "deleting" ? (
                      <Button
                        variant="outline"
                        disabled={busy}
                        onClick={() => void action(() => finishWaterDeletion(user, undo))}
                      >
                        {l("Check water deletion", "التحقق من حذف المياه")}
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        disabled={busy}
                        aria-label={l(
                          `Undo water deletion ${undo.record.ml} ml`,
                          `استعادة ${undo.record.ml} مل`,
                        )}
                        onClick={() =>
                          void action(() => restoreWaterEntry(user, undo), undo.mode === "queued")
                        }
                      >
                        {l("Undo", "استعادة")}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      disabled={busy}
                      aria-label={l(
                        `Dismiss water recovery ${undo.record.ml} ml`,
                        `إزالة استعادة ${undo.record.ml} مل`,
                      )}
                      onClick={() => void action(() => dismissWaterUndo(user, undo.token))}
                    >
                      {l("Dismiss", "إزالة")}
                    </Button>
                  </div>
                </div>
              ))}
            </section>
          )}
          <ul className="mt-4 space-y-3">
            {rows.map((row, index) => (
              <li
                key={String(row["id"])}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border p-3"
              >
                <span>
                  <bdi dir="ltr">
                    {String(row["ml"])} {l("ml", "مل")}
                  </bdi>{" "}
                  · <bdi dir="ltr">{String(row["log_date"])}</bdi>
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    disabled={busy || !!editing}
                    aria-label={l(`Edit water entry ${index + 1}`, `تعديل سجل المياه ${index + 1}`)}
                    onClick={() =>
                      void action(async () => {
                        const record = waterEntry(row, user);
                        setEditing({
                          record,
                          allowMissing: await waterEditAllowsMissing(user, record.id),
                        });
                        setAmount(String(record.ml));
                      })
                    }
                  >
                    {l("Edit", "تعديل")}
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={busy || !!editing || !!recoveryError}
                    aria-label={l(`Delete water entry ${index + 1}`, `حذف سجل المياه ${index + 1}`)}
                    onClick={() =>
                      void action(async () => {
                        const record = waterEntry(row, user);
                        await deleteWaterEntry(
                          user,
                          record,
                          queued,
                          await waterEditAllowsMissing(user, record.id),
                        );
                      })
                    }
                  >
                    {l("Delete", "حذف")}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          {!rows.length && (
            <p className="mt-4 text-sm text-muted-foreground">
              {l(
                "No water entries available for this date.",
                "لا توجد سجلات مياه متاحة لهذا التاريخ.",
              )}
            </p>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
