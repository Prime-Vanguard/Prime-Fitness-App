import { useEffect, useRef, useState } from "react";
import { readLegacyWorkout, adoptLegacyWorkout } from "@/lib/workout-store";
import { useI18n } from "@/lib/i18n";
import { Button } from "./ui/button";
import { supabase } from "@/integrations/supabase/client";
export function LegacyWorkoutRecovery({ userId }: { userId: string }) {
  const { locale } = useI18n(),
    l = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const [present, setPresent] = useState(false),
    [agree, setAgree] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    let alive = true;
    void readLegacyWorkout(userId)
      .then((d) => {
        if (alive) setPresent(!!d);
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
      mounted.current = false;
    };
  }, [userId]);
  async function act(adopt: boolean) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      if (adopt) {
        if (!agree) return;
        const auth = await supabase.auth.getSession();
        if (auth.data.session?.user.id !== userId || !mounted.current)
          throw new Error("Sign in to the same account before recovering this draft.");
        await adoptLegacyWorkout(userId);
        if (mounted.current) setPresent(false);
      } else {
        const draft = await readLegacyWorkout(userId);
        if (!draft) throw new Error("Legacy draft no longer exists.");
        const auth = await supabase.auth.getSession();
        if (auth.data.session?.user.id !== userId || !mounted.current)
          throw new Error("Sign in to the same account before exporting this draft.");
        const url = URL.createObjectURL(
          new Blob(
            [
              JSON.stringify({
                app: "prime-fitness-legacy-recovery",
                project: "unknown",
                workoutDraft: draft,
              }),
            ],
            { type: "application/json" },
          ),
        );
        const a = document.createElement("a");
        a.href = url;
        a.download = "prime-fitness-legacy-workout.json";
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  if (!present && !error) return null;
  return (
    <section
      className="mb-4 space-y-3 rounded-xl border border-gold/40 bg-card p-4"
      aria-label={l("Legacy workout recovery", "استعادة تمرين قديم")}
    >
      <h2 className="font-semibold">
        {l(
          "An older device draft needs project review",
          "مسودة قديمة على الجهاز تحتاج مراجعة المشروع",
        )}
      </h2>
      <p className="break-words text-sm">
        {l(
          "Its backend was not recorded. It remains on this device and will not upload until you confirm its destination.",
          "لم يُسجل خادم المسودة. ستبقى على الجهاز ولن تُرفع حتى تؤكد وجهتها.",
        )}{" "}
        {import.meta.env["VITE_SUPABASE_URL"]}
      </p>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {present && (
        <fieldset disabled={busy} className="space-y-3">
          <Button variant="outline" onClick={() => void act(false)}>
            {l("Export legacy draft", "تصدير المسودة القديمة")}
          </Button>
          <label className="flex min-h-12 items-center gap-3 text-sm">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
            {l(
              "I confirm this draft belongs to the project shown above.",
              "أؤكد أن المسودة تخص المشروع الموضح أعلاه.",
            )}
          </label>
          <Button disabled={!agree} onClick={() => void act(true)}>
            {l("Recover in this project", "استعادة في هذا المشروع")}
          </Button>
        </fieldset>
      )}
    </section>
  );
}
