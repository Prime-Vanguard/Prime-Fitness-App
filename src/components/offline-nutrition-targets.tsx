import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";
import { watchMemberState } from "@/lib/member-store";
import { readOfflineIdentity } from "@/lib/offline-access";
import {
  type OfflineTarget,
  readOfflineTargets,
  removeOfflineTargets,
  revalidateOfflineTargets,
  saveOfflineTargetDraft,
  targetForm,
  targetKeys,
} from "@/lib/offline-target-drafts";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

function subscribeConnection(refresh: () => void) {
  window.addEventListener("online", refresh);
  window.addEventListener("offline", refresh);
  return () => {
    window.removeEventListener("online", refresh);
    window.removeEventListener("offline", refresh);
  };
}

export function OfflineNutritionTargets({ actor }: { actor: string }) {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const online = useSyncExternalStore(
    subscribeConnection,
    () => navigator.onLine,
    () => true,
  );
  const [notice, setNotice] = useState("");
  const { data, error, isFetching, refetch } = useQuery({
    queryKey: ["offline-nutrition-targets", actor, online],
    queryFn: () => (online ? revalidateOfflineTargets(actor) : readOfflineTargets(actor)),
    networkMode: "always",
    retry: false,
  });
  useEffect(() => {
    if (online) return;
    return watchMemberState(() => void refetch());
  }, [online, refetch]);
  const rows = error || (online && isFetching) ? [] : (data ?? []);
  if (readOfflineIdentity()?.id !== actor || (!rows.length && !error && !notice)) return null;
  const heading = ar ? "مسودات أهداف التغذية" : "Nutrition target drafts";
  return (
    <section aria-label={heading} className="space-y-3 rounded-xl border border-border p-4">
      <h3 className="font-semibold">{heading}</h3>
      <p className="text-sm text-muted-foreground">
        {ar
          ? "احفظ المسودة على هذا الجهاز، ثم افتح أهداف التغذية في لوحة الإدارة لمراجعتها وتأكيدها عند الاتصال."
          : "Save a draft on this device. When connected, open Nutrition targets in Admin to load, review and confirm it."}
      </p>
      {error && (
        <div className="space-y-2 text-sm">
          <p role="alert">
            {ar ? "تعذر فتح أهداف التغذية المحفوظة." : "Could not open saved nutrition targets."}
          </p>
          <Button variant="outline" onClick={() => void refetch()}>
            {ar ? "إعادة المحاولة" : "Retry"}
          </Button>
        </div>
      )}
      {notice && (
        <p role="status" className="text-sm">
          {notice}
        </p>
      )}
      {rows.map((snapshot) => (
        <OfflineTargetEditor
          key={snapshot.revision}
          actor={actor}
          snapshot={snapshot}
          onChange={(message) => {
            setNotice(message);
            void refetch();
          }}
        />
      ))}
    </section>
  );
}

function OfflineTargetEditor({
  actor,
  snapshot,
  onChange,
}: {
  actor: string;
  snapshot: OfflineTarget;
  onChange: (message: string) => void;
}) {
  const { t, locale } = useI18n();
  const ar = locale === "ar";
  const [form, setForm] = useState(() => targetForm(snapshot.draft ?? snapshot.baseline));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmRemoval, setConfirmRemoval] = useState(false);
  const pending = useRef(false);
  const fields = {
    calories: ar ? "السعرات الحرارية (كيلو كالوري)" : "Calories (kcal)",
    protein_g: `${t("protein")} (g)`,
    carbs_g: `${t("carbs")} (g)`,
    fat_g: `${t("fat")} (g)`,
    water_ml: `${t("water")} (ml)`,
  };
  async function save(event: FormEvent) {
    event.preventDefault();
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      await saveOfflineTargetDraft(actor, snapshot, form);
      onChange(ar ? "تم حفظ مسودة الأهداف على هذا الجهاز." : "Target draft saved on this device.");
    } catch {
      setError(
        ar
          ? "تعذر الحفظ. تحقق من القيم الصحيحة ومن توفر النسخة على الجهاز."
          : "Could not save. Check the values and verify that the saved copy is still available.",
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  async function remove() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      await removeOfflineTargets(actor, snapshot);
      onChange(ar ? "تمت إزالة النسخة من هذا الجهاز." : "Target copy removed from this device.");
    } catch {
      setError(ar ? "تعذرت إزالة النسخة." : "Could not remove the target copy.");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <form
      onSubmit={(event) => void save(event)}
      className="space-y-3 rounded-lg border border-border p-3"
    >
      <h4 className="break-words font-medium">{snapshot.displayName || t("member")}</h4>
      {snapshot.draft && (
        <p className="text-sm">{ar ? "مسودة محفوظة على الجهاز" : "Draft saved on device"}</p>
      )}
      <p className="text-xs text-muted-foreground">
        {ar
          ? "أدخل أعدادًا صحيحة. اترك الحقل فارغًا لإلغاء تحديده."
          : "Use whole numbers. A blank field means unset."}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {targetKeys.map((key) => (
          <label key={key} className="text-sm">
            {fields[key]}
            <Input
              className="mt-1"
              inputMode="numeric"
              disabled={busy || confirmRemoval}
              value={form[key]}
              onChange={(event) => setForm({ ...form, [key]: event.target.value })}
            />
          </label>
        ))}
      </div>
      {error && (
        <p role="alert" className="text-sm">
          {error}
        </p>
      )}
      {confirmRemoval ? (
        <>
          <p className="text-sm">
            {ar
              ? "ستُحذف النسخة والمسودة من هذا الجهاز."
              : "This removes the downloaded copy and any draft from this device."}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setConfirmRemoval(false)}
            >
              {ar ? "الاحتفاظ بالنسخة" : "Keep copy"}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={busy}
              onClick={() => void remove()}
            >
              {ar ? "تأكيد الإزالة" : "Confirm removal"}
            </Button>
          </div>
        </>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={busy}>
            {ar ? "حفظ مسودة الأهداف على الجهاز" : "Save target draft on device"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => setConfirmRemoval(true)}
          >
            {ar ? "إزالة نسخة الأهداف من الجهاز" : "Remove target copy from device"}
          </Button>
        </div>
      )}
    </form>
  );
}
