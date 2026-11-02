import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bookmark, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";
import {
  mealItem,
  scaleMealItem,
  parseMealItems,
  mealCalories,
  type MealItem,
} from "@/lib/nutrition-tools";
import { useTrainingFeatures } from "@/hooks/use-training-features";
import { useMemberData, retainMemberRows, beginMemberRead } from "@/hooks/use-member-data";
import { queueMemberWrites, syncMemberEntries } from "@/lib/member-store";

export function SavedMeals({
  userId,
  day,
  meal,
  draft,
  logged,
  onLogged,
}: {
  userId: string;
  day: string;
  meal: string;
  draft: {
    name: string;
    calories: string;
    protein_g: string;
    carbs_g: string;
    fat_g: string;
    portion?: string;
  };
  logged: MealItem[];
  onLogged: () => void;
}) {
  const { locale } = useI18n();
  const { data: features } = useTrainingFeatures(userId);
  const { state: local } = useMemberData(userId);
  const l = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  const key = ["saved-meals", userId];
  const { data: remoteData, error } = useQuery({
    queryKey: [...key, !!features?.offline],
    enabled: !features?.offline || navigator.onLine,
    queryFn: async () => {
      const cacheToken = features?.offline ? await beginMemberRead(userId) : {};
      const r = await supabase
        .from("saved_meals")
        .select("*")
        .eq("member_id", userId)
        .order("created_at", { ascending: false });
      if (r.error) throw r.error;
      if (features?.offline) await retainMemberRows(userId, "saved_meals", r.data, cacheToken);
      return r.data;
    },
  });
  const data = features?.offline
    ? ((local.records.saved_meals ?? []) as typeof remoteData)
    : remoteData;
  async function run(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : String((e as { message?: string }).message ?? e),
      );
    } finally {
      setBusy(false);
    }
  }
  async function save(kind: "food" | "meal") {
    await run(async () => {
      const items =
        kind === "food" ? [scaleMealItem(draft, draft.portion ?? "1")] : logged.map(mealItem);
      if (!items.length)
        throw new Error(l("Log this meal's ingredients first.", "سجّل مكونات الوجبة أولاً."));
      const title = (name || (kind === "food" ? draft.name : "")).trim();
      if (!title || title.length > 100)
        throw new Error(
          l(
            "Give this favorite a name (up to 100 characters).",
            "اختر اسماً للمفضلة (حتى 100 حرف).",
          ),
        );
      if (features?.offline) {
        await queueMemberWrites(userId, [
          {
            entity: "saved_meals",
            op: "put",
            record: { id: crypto.randomUUID(), name: title, kind, items },
          },
        ]);
        void syncMemberEntries(userId).catch(() => {});
      } else {
        const r = await supabase
          .from("saved_meals")
          .insert({ member_id: userId, name: title, kind, items });
        if (r.error) throw r.error;
      }
      setName("");
      void qc.invalidateQueries({ queryKey: key });
      toast.success(l("Saved to favorites", "تم الحفظ في المفضلة"));
    });
  }
  return (
    <section className="mt-5 rounded-xl border border-gold/30 bg-card p-4">
      <h2 className="flex items-center gap-2 font-display font-bold">
        <Bookmark size={18} className="text-gold" />
        {l("My foods & favorite meals", "أطعمتي ووجباتي المفضلة")}
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        {l(
          "Save the macros above as a custom food, or save every item in the selected meal as a reusable template. Your entries are unverified.",
          "احفظ القيم أعلاه كطعام مخصص، أو احفظ كل عناصر الوجبة المحددة كقالب. بياناتك غير موثقة.",
        )}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {draft.portion && draft.portion !== "1" && (
          <p className="w-full text-sm">
            {l(
              `Custom food uses ${draft.portion} × the current values. Logged meal templates already contain consumed totals.`,
              `يستخدم الطعام المخصص ${draft.portion} × القيم الحالية. قوالب الوجبات المسجلة تحتوي بالفعل على الإجماليات المستهلكة.`,
            )}
          </p>
        )}
        <Input
          className="min-w-0 flex-1"
          aria-label={l("Favorite name", "اسم المفضلة")}
          placeholder={l("e.g. Post-workout shake", "مثال: وجبة ما بعد التمرين")}
          maxLength={100}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Button variant="outline" disabled={busy} onClick={() => void save("food")}>
          {l("Save custom food", "حفظ طعام مخصص")}
        </Button>
        <Button
          variant="outline"
          disabled={busy || !logged.length}
          onClick={() => void save("meal")}
        >
          {l("Save selected meal", "حفظ الوجبة المحددة")}
        </Button>
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {l(
            "Favorites could not be loaded. Try again when connected.",
            "تعذر تحميل المفضلة. حاول مجدداً عند الاتصال.",
          )}
        </p>
      )}
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {data?.map((favorite) => {
          let items: MealItem[];
          try {
            items = parseMealItems(favorite.items);
          } catch {
            return null;
          }
          return (
            <li
              key={favorite.id}
              className="flex items-center gap-2 rounded-lg border border-border p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{favorite.name}</p>
                <p className="text-xs text-muted-foreground">
                  {items.length} {l("items", "عناصر")} · {mealCalories(items)} kcal
                </p>
              </div>
              <Button
                aria-label={`${l("Add", "إضافة")} ${favorite.name}`}
                variant="outline"
                size="icon"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    if (features?.offline) {
                      await queueMemberWrites(
                        userId,
                        items.map((item) => ({
                          entity: "food_logs",
                          op: "put",
                          record: {
                            ...item,
                            id: crypto.randomUUID(),
                            member_id: userId,
                            log_date: day,
                            meal,
                          },
                        })),
                      );
                      void syncMemberEntries(userId).catch(() => {});
                    } else {
                      const r = await supabase.from("food_logs").insert(
                        items.map((item) => ({
                          ...item,
                          member_id: userId,
                          log_date: day,
                          meal,
                        })),
                      );
                      if (r.error) throw r.error;
                    }
                    onLogged();
                    toast.success(l("Meal added", "تمت إضافة الوجبة"));
                  })
                }
              >
                <Plus size={16} />
              </Button>
              <Button
                aria-label={`${l("Delete", "حذف")} ${favorite.name}`}
                variant="ghost"
                size="icon"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    if (features?.offline) {
                      await queueMemberWrites(userId, [
                        { entity: "saved_meals", op: "delete", record: { id: favorite.id } },
                      ]);
                      void syncMemberEntries(userId).catch(() => {});
                    } else {
                      const r = await supabase
                        .from("saved_meals")
                        .delete()
                        .eq("id", favorite.id)
                        .eq("member_id", userId);
                      if (r.error) throw r.error;
                    }
                    void qc.invalidateQueries({ queryKey: key });
                  })
                }
              >
                <Trash2 size={16} />
              </Button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
