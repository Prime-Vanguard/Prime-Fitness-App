import { useEffect, useRef, useState } from "react";
import { useI18n, type TKey } from "@/lib/i18n";
import { addDays, activityDay } from "@/lib/dates";
import { validActivityDate } from "@/lib/training-search";
import { fetchAll } from "@/lib/pagination";
import { supabase } from "@/integrations/supabase/client";
import { readMemberState, watchMemberState, type MemberRecord } from "@/lib/member-store";
import { mealItem, scaleMealItem, type MealItem } from "@/lib/nutrition-tools";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { MEALS } from "./contracts";
import { prepareMealCopy, commitMealCopy, parseMealCopy, type MealCopy } from "./meal-copy";

// Review the prepared meal and preserve its recovery record until saving succeeds.
export function MealCopyReview({
  userId,
  day,
  meal,
  offline,
  localFood,
  onLogged,
  disabled,
}: {
  userId: string;
  day: string;
  meal: string;
  offline: boolean;
  localFood: MemberRecord[];
  onLogged: () => void;
  disabled: boolean;
}) {
  const { locale, t } = useI18n(),
    l = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const [open, setOpen] = useState(false),
    [source, setSource] = useState(addDays(day, -1)),
    [fromMeal, setFromMeal] = useState(meal),
    [portion, setPortion] = useState("1"),
    [rows, setRows] = useState<MealItem[] | null>(null),
    [selected, setSelected] = useState<Set<number>>(new Set()),
    [pending, setPending] = useState<MealCopy | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const lock = useRef(false);
  const prompted = useRef<string | null>(null);
  useEffect(() => {
    let alive = true;
    const read = () =>
      void readMemberState(userId)
        .then((state) => {
          if (!alive) return;
          const saved = parseMealCopy(state.references["mealCopy"], userId);
          setPending(saved);
          if (saved && prompted.current !== saved.id) {
            prompted.current = saved.id;
            setOpen(true);
          }
          if (!saved) prompted.current = null;
        })
        .catch(() => {
          if (alive)
            setError(
              l(
                "Saved copy could not be read. Export device data before removing it.",
                "تعذر قراءة طلب النسخ المحفوظ. صدّر بيانات الجهاز قبل إزالتها.",
              ),
            );
        });
    read();
    const stop = watchMemberState(read);
    return () => {
      alive = false;
      stop();
    };
    // Keep record identity stable when interface language changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);
  async function load() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setRows(null);
    try {
      if (!validActivityDate(source) || source > activityDay())
        throw new Error(
          l("Choose today or an earlier source date.", "اختر اليوم أو تاريخاً سابقاً للمصدر."),
        );
      const records =
        offline && !navigator.onLine
          ? localFood.filter((row) => row.log_date === source && row["meal"] === fromMeal)
          : await fetchAll(
              (from, to) =>
                supabase
                  .from("food_logs")
                  .select("id,name,calories,protein_g,carbs_g,fat_g")
                  .eq("member_id", userId)
                  .eq("log_date", source)
                  .eq("meal", fromMeal)
                  .order("id")
                  .range(from, to),
              (row) => row.id,
            );
      if (!records.length)
        throw new Error(
          l(
            "No source entries available. Offline history may be incomplete.",
            "لا توجد سجلات مصدر متاحة. قد يكون السجل غير مكتمل دون اتصال.",
          ),
        );
      if (records.length > 50)
        throw new Error(
          l("Copy at most 50 food entries at once.", "انسخ حتى 50 سجلاً في المرة الواحدة."),
        );
      const values = records.map((row) =>
        mealItem({
          name: String(row.name),
          calories: Number(row.calories),
          protein_g: Number(row.protein_g),
          carbs_g: Number(row.carbs_g),
          fat_g: Number(row.fat_g),
        }),
      );
      setRows(values);
      setSelected(new Set(values.map((_, i) => i)));
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function confirm() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const request =
        pending ??
        (await prepareMealCopy(
          userId,
          day,
          meal,
          (rows ?? []).filter((_, i) => selected.has(i)),
          portion,
          offline,
        ));
      setPending(request);
      await commitMealCopy(userId, request);
      setPending(null);
      setRows(null);
      setOpen(false);
      onLogged();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  let total: number | null = null;
  try {
    total = pending
      ? pending.items.reduce((sum, row) => sum + row.calories, 0)
      : (rows
          ?.filter((_, i) => selected.has(i))
          .reduce((sum, row) => sum + scaleMealItem(row, portion).calories, 0) ?? null);
  } catch {
    /* Submission explains invalid portions. */
  }
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-gold"
        disabled={disabled || busy}
        onClick={() => setOpen(true)}
      >
        {pending
          ? l("Review saved meal copy", "مراجعة طلب النسخ المحفوظ")
          : l("Copy a previous meal", "نسخ وجبة سابقة")}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!busy) setOpen(next);
        }}
      >
        <DialogContent
          className="max-h-[90dvh] overflow-y-auto"
          dir={locale === "ar" ? "rtl" : "ltr"}
        >
          <DialogHeader>
            <DialogTitle>{l("Review meal copy", "مراجعة نسخ الوجبة")}</DialogTitle>
            <DialogDescription>
              {l(
                "Review food and portions before saving. If confirmation is interrupted, retry the saved copy to avoid adding it twice.",
                "راجع الطعام والحصص قبل الحفظ. إذا انقطع التأكيد، أعد محاولة النسخة المحفوظة لتجنب إضافتها مرتين.",
              )}
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm">
            {l("Destination", "الوجهة")}: <bdi>{pending?.day ?? day}</bdi> ·{" "}
            {t((pending?.items[0]?.meal ?? meal) as TKey)}
          </p>
          {!pending && (
            <>
              <label className="text-sm">
                {l("Source date", "تاريخ المصدر")}
                <Input
                  type="date"
                  value={source}
                  max={activityDay()}
                  disabled={busy}
                  onChange={(e) => {
                    setSource(e.target.value);
                    setRows(null);
                  }}
                />
              </label>
              <label className="text-sm">
                {l("Source meal", "وجبة المصدر")}
                <NativeSelect
                  aria-label={l("Source meal", "وجبة المصدر")}
                  value={fromMeal}
                  disabled={busy}
                  onChange={(e) => {
                    setFromMeal(e.target.value);
                    setRows(null);
                  }}
                >
                  {MEALS.map((m) => (
                    <option value={m} key={m}>
                      {t(m as TKey)}
                    </option>
                  ))}
                </NativeSelect>
              </label>
              <Button variant="outline" disabled={busy} onClick={() => void load()}>
                {l("Preview meal", "معاينة الوجبة")}
              </Button>
            </>
          )}
          <ul className="space-y-2">
            {(pending?.items ?? rows ?? []).map((row, i) => (
              <li key={i} className="rounded-lg bg-background p-3 text-sm">
                {pending ? (
                  <span>
                    {row.name} · {row.calories} kcal
                  </span>
                ) : (
                  <label className="flex min-h-11 items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selected.has(i)}
                      disabled={busy}
                      onChange={(e) =>
                        setSelected((current) => {
                          const next = new Set(current);
                          if (e.target.checked) next.add(i);
                          else next.delete(i);
                          return next;
                        })
                      }
                    />
                    {row.name} · {row.calories} kcal
                  </label>
                )}
              </li>
            ))}
          </ul>
          {!pending && rows && (
            <label className="text-sm">
              {l("Copy portion multiplier", "مضاعف الحصص المنسوخة")}
              <Input
                inputMode="decimal"
                dir="ltr"
                value={portion}
                disabled={busy}
                onChange={(e) => setPortion(e.target.value)}
              />
            </label>
          )}
          {total != null && (
            <p className="text-sm tabular-nums">
              {l("Total to copy", "إجمالي النسخ")}: {total} kcal
            </p>
          )}
          {pending && (
            <p role="status" className="text-sm">
              {l(
                "A confirmed copy is saved on this device. Retry to reconcile it before creating another. It may already be on the server.",
                "طلب نسخ مؤكد محفوظ على الجهاز. أعد المحاولة للتحقق منه قبل إنشاء طلب آخر؛ فقد يكون محفوظاً على الخادم بالفعل.",
              )}
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button
            disabled={busy || (!pending && (!rows || !selected.size))}
            onClick={() => void confirm()}
          >
            {busy
              ? "…"
              : pending
                ? l("Retry saved copy", "إعادة طلب النسخ المحفوظ")
                : l("Confirm meal copy", "تأكيد نسخ الوجبة")}
          </Button>
          <Button variant="ghost" disabled={busy} onClick={() => setOpen(false)}>
            {l("Close review", "إغلاق المراجعة")}
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
