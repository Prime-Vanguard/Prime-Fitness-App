import { trainingLabel } from "@/lib/training-labels";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
export function TrainingRollout({ userId }: { userId: string }) {
  const { locale } = useI18n();
  const l = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const qc = useQueryClient();
  const [pilot, setPilot] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { data } = useQuery({
    queryKey: ["training-rollout-admin", userId],
    queryFn: async () => {
      const [flags, pilots] = await Promise.all([
        supabase.from("training_rollout").select("*").order("feature"),
        supabase.from("training_pilots").select("member_id"),
      ]);
      if (flags.error) throw flags.error;
      if (pilots.error) throw pilots.error;
      return { flags: flags.data, pilots: pilots.data };
    },
  });
  if (!data) return null;
  async function run(fn: () => PromiseLike<{ error: { message: string } | null }>) {
    setBusy(true);
    setError("");
    try {
      const r = await fn();
      if (r.error) throw new Error(r.error.message);
      await qc.invalidateQueries({ queryKey: ["training-rollout-admin", userId] });
      await qc.invalidateQueries({ queryKey: ["training-features"] });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="mt-5 rounded-xl border border-gold/30 p-4">
      <summary>
        {l(
          "Training rollout: staff and pilot controls",
          "إطلاق التدريب: إعدادات الموظفين والتجربة",
        )}
      </summary>
      <p className="my-3 text-sm">
        {l(
          "Keep general release disabled until content rights, database/browser checks and physical-device acceptance pass.",
          "أبقِ الإطلاق العام معطلاً حتى مراجعة المحتوى والحقوق والاختبارات واختبار الأجهزة الفعلية.",
        )}
      </p>
      {error && <p role="alert">{error}</p>}
      {data.flags.map((f) => (
        <div
          key={trainingLabel(f.feature, locale)}
          className="my-2 flex flex-wrap items-center gap-3 text-sm"
        >
          <span>{trainingLabel(f.feature, locale)}</span>
          {(
            [
              [
                "available",
                l("Available (emergency off disables everyone)", "متاحة (تعطيل طارئ للجميع)"),
              ],
              ["staff_enabled", l("Staff", "الموظفون")],
              ["enabled", l("All active members", "جميع الأعضاء النشطين")],
            ] as const
          ).map(([key, label]) => (
            <label key={key}>
              <input
                aria-label={`${trainingLabel(f.feature, locale)}: ${label}`}
                disabled={busy}
                type="checkbox"
                checked={f[key]}
                onChange={(e) => {
                  const checked = e.target.checked;
                  if (
                    key === "enabled" &&
                    checked &&
                    !confirm(
                      l(
                        "Release this feature to all active members after completing its acceptance gate?",
                        "إطلاق الميزة لجميع الأعضاء النشطين بعد اجتياز معايير القبول؟",
                      ),
                    )
                  )
                    return;
                  void run(() =>
                    supabase
                      .from("training_rollout")
                      .update(
                        key === "available"
                          ? { available: checked }
                          : key === "enabled"
                            ? { enabled: checked }
                            : { staff_enabled: checked },
                      )
                      .eq("feature", f.feature),
                  );
                }}
              />{" "}
              {label}
            </label>
          ))}
        </div>
      ))}
      <label className="block text-xs">
        {l("Pilot member UUID", "معرف العضو للتجربة")}
        <Input
          value={pilot}
          onChange={(e) => setPilot(e.target.value)}
          placeholder="00000000-0000-4000-8000-000000000000"
        />
      </label>
      <Button
        disabled={busy || !pilot}
        className="mt-2"
        onClick={() =>
          void run(() => supabase.from("training_pilots").insert({ member_id: pilot }))
        }
      >
        {l("Add pilot member", "إضافة عضو للتجربة")}
      </Button>
      <ul className="mt-2">
        {data.pilots.map((p) => (
          <li className="flex items-center gap-2 text-xs" key={p.member_id}>
            {p.member_id}
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() =>
                void run(() =>
                  supabase.from("training_pilots").delete().eq("member_id", p.member_id),
                )
              }
            >
              {l("Remove", "إزالة")}
            </Button>
          </li>
        ))}
      </ul>
    </details>
  );
}
