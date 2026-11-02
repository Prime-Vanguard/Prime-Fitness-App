import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { useI18n } from "@/lib/i18n";
import { adminDate } from "@/lib/admin-format";
import { mutationSummary } from "@/lib/recovery-presentation";
import type { MemberState } from "@/lib/member-store";
import {
  createPersonalBackup,
  downloadBackup,
  projectHost,
  RESTORE_TABLES,
  restorePersonalBackup,
  validateBackup,
  verifyMedia,
  type PersonalBackup,
} from "@/lib/personal-backup";

export function BackupRestore({ userId }: { userId: string }) {
  return <BackupRestoreAccount key={userId} userId={userId} />;
}
function BackupRestoreAccount({ userId }: { userId: string }) {
  const { locale, setLocale } = useI18n();
  const ar = locale === "ar";
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [backup, setBackup] = useState<PersonalBackup | null>(null);
  const [preferences, setPreferences] = useState(false);
  const [error, setError] = useState("");
  const [report, setReport] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [phase, setPhase] = useState<"idle" | "validating" | "restoring" | "exporting">("idle");
  const lock = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const l = (en: string, arabic: string) => (ar ? arabic : en);
  const labels = {
    workout_sessions: l("Workouts", "التمارين"),
    set_logs: l("Sets", "المجموعات"),
    food_logs: l("Food entries", "سجلات الطعام"),
    water_logs: l("Water entries", "سجلات الماء"),
    body_measurements: l("Measurements", "القياسات"),
    saved_meals: l("Favorites", "المفضلة"),
    progress_photos: l("Progress photos", "صور التقدم"),
    wellness_checkins: l("Wellness check-ins", "تسجيل الحالة اليومية"),
  };
  async function run(
    action: () => Promise<void>,
    operation: "validating" | "restoring" | "exporting" = "exporting",
  ) {
    if (lock.current) return;
    lock.current = true;
    setPhase(operation);
    setBusy(true);
    setError("");
    setReport("");
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : String((e as { message?: string }).message ?? e));
    } finally {
      lock.current = false;
      setPhase("idle");
      setBusy(false);
    }
  }
  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-6" aria-busy={busy}>
      <h2 className="font-heading font-semibold">
        {l("Backup & restore", "النسخ الاحتياطي والاستعادة")}
      </h2>
      <p className="text-sm text-muted-foreground">
        {l(
          "Keep a private backup of your logs, favorites, photos and pending workout. Restore adds missing personal records to this account and keeps existing data. Save the downloaded file securely.",
          "احتفظ بنسخة خاصة من سجلاتك ووجباتك وصورك والتمرين المعلق. تضيف الاستعادة البيانات الناقصة إلى حسابك وتحافظ على البيانات الحالية. احفظ الملف في مكان آمن.",
        )}
      </p>
      <Button
        disabled={busy}
        variant="outline"
        onClick={() =>
          void run(async () => {
            const result = await createPersonalBackup(userId);
            if (!alive.current) return;
            downloadBackup(result);
            toast.success(l("Backup downloaded", "تم تنزيل النسخة"));
          })
        }
      >
        {l("Download full backup (JSON)", "تنزيل نسخة كاملة (JSON)")}
      </Button>
      <label className="block space-y-2 text-sm">
        {l("Choose backup to review", "اختر نسخة لمراجعتها")}
        <input
          disabled={busy}
          type="file"
          accept=".json,application/json"
          className="block max-w-full"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            setBackup(null);
            setPreferences(false);
            setAcknowledged(false);
            if (file)
              void run(async () => {
                if (file.size > 128 * 1024 * 1024)
                  throw new Error(
                    l("Maximum backup size is 128 MB.", "الحد الأقصى للملف 128 ميجابايت."),
                  );
                const parsed = validateBackup(JSON.parse(await file.text()), userId, projectHost());
                await verifyMedia(parsed);
                if (!alive.current) return;
                setBackup(parsed);
              }, "validating");
          }}
        />
      </label>
      {backup && (
        <div className="space-y-3 rounded-lg border p-4">
          <p className="font-semibold">
            {l("Restore preview", "معاينة الاستعادة")} · {adminDate(backup.exportedAt, locale)} ·
            Africa/Cairo
          </p>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">
                {l("Owner (verified as this account)", "المالك (تم التحقق أنه حسابك)")}
              </dt>
              <dd className="break-all">
                <bdi>{backup.ownerId}</bdi>
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">
                {l("Format / storage units", "الصيغة / الوحدات المخزنة")}
              </dt>
              <dd>
                v{backup.version} · {backup.storageUnits}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">
                {l("Source project (verified)", "مشروع المصدر (تم التحقق)")}
              </dt>
              <dd className="break-all">
                <bdi>{backup.projectHost}</bdi>
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{l("Pending workout", "تمرين معلق")}</dt>
              <dd>
                {backup.workoutDraft
                  ? l("Included — opens for review", "مضمن — يفتح للمراجعة")
                  : l("Not included", "غير مضمن")}
              </dd>
            </div>
          </dl>
          <p className="text-sm">
            {RESTORE_TABLES.map(
              (tab) => `${labels[tab]}: ${(backup.data[tab] as unknown[]).length}`,
            ).join(" · ")}{" "}
            · {l("Photo files", "ملفات الصور")}: {backup.media.length}
          </p>
          {backup.pendingMemberData != null && (
            <div className="rounded-lg border border-border p-3 text-sm">
              <p>
                {l("Pending member changes", "تغييرات العضو المعلقة")}:{" "}
                {(backup.pendingMemberData as MemberState).queue.length}
              </p>
              <p>
                {Object.entries(mutationSummary((backup.pendingMemberData as MemberState).queue))
                  .map(
                    ([key, count]) =>
                      `${{ queued: l("Waiting", "بانتظار التزامن"), sending: l("Sending / uncertain", "إرسال / غير مؤكد"), conflict: l("Conflicts", "تعارضات"), rejected: l("Needs attention", "تحتاج معالجة") }[key as "queued" | "sending" | "conflict" | "rejected"]}: ${count}`,
                  )
                  .join(" · ")}
              </p>
            </div>
          )}
          <p className="text-sm text-muted-foreground">
            {l(
              "Imported workouts retain their provenance and remain ineligible for rewards. Pending changes may still need synchronization or conflict review after restoration. This preview counts file records, not how many are missing on the server.",
              "تحتفظ التمارين المستوردة بمصدرها ولا تصبح مؤهلة للمكافآت. قد تحتاج التغييرات المعلقة للمزامنة أو حل التعارضات بعد الاستعادة. الأعداد تخص الملف وليست عدد السجلات الناقصة في الخادم.",
            )}
          </p>
          <p className="text-sm text-muted-foreground">
            {l(
              "Roles, membership, program assignments, points, badges, claims and shields are reference records only. The server recalculates any earned rewards. A pending workout opens for review; your current pending workout takes priority.",
              "الأدوار والعضوية والبرامج المعينة والنقاط والأوسمة والطلبات والدروع محفوظة للمرجعية فقط. يحسب الخادم المكافآت المستحقة. يفتح التمرين المعلق للمراجعة مع إعطاء الأولوية للتمرين الحالي.",
            )}
          </p>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={preferences}
              disabled={busy}
              onChange={(e) => setPreferences(e.target.checked)}
            />
            {l(
              "Also restore name, language, units and avatar",
              "استعادة الاسم واللغة والوحدات والصورة الشخصية أيضاً",
            )}
          </label>
          <label className="flex items-start gap-3 text-sm">
            <input
              className="mt-1 h-5 w-5"
              type="checkbox"
              checked={acknowledged}
              disabled={busy}
              onChange={(e) => setAcknowledged(e.target.checked)}
            />
            {l(
              "I reviewed the owner, record counts and pending changes. Add missing records without replacing existing history.",
              "راجعت المالك وأعداد السجلات والتغييرات المعلقة. أضف الناقص دون استبدال السجل الحالي.",
            )}
          </label>
          <Button
            disabled={busy || !acknowledged}
            onClick={() =>
              void run(async () => {
                const draft = await restorePersonalBackup(backup, userId, preferences);
                if (!alive.current) return;
                void qc.invalidateQueries();
                if (preferences)
                  setLocale((backup.data["profile"] as { locale: "ar" | "en" }).locale);
                setBackup(null);
                setReport(
                  l("Missing personal records restored.", "تمت استعادة البيانات الشخصية الناقصة.") +
                    " " +
                    (draft === "kept"
                      ? l(
                          "Your current pending workout was kept.",
                          "تم الاحتفاظ بالتمرين المعلق الحالي.",
                        )
                      : draft === "restored"
                        ? l(
                            "Pending workout is ready to review in Train.",
                            "التمرين المعلق جاهز للمراجعة في التدريب.",
                          )
                        : draft === "finished"
                          ? l(
                              "The saved workout is already completed.",
                              "التمرين المحفوظ مكتمل بالفعل.",
                            )
                          : ""),
                );
              }, "restoring")
            }
          >
            {l("Restore missing personal data", "استعادة البيانات الشخصية الناقصة")}
          </Button>
          <Button disabled={busy} variant="ghost" onClick={() => setBackup(null)}>
            {l("Cancel", "إلغاء")}
          </Button>
        </div>
      )}
      {busy && (
        <p role="status">
          {phase === "validating"
            ? l(
                "Validating file, owner and photo checksums… No data is being restored.",
                "جارٍ التحقق من الملف والمالك وبصمات الصور… لا تُستعاد بيانات الآن.",
              )
            : phase === "restoring"
              ? l(
                  "Restoring… Keep this page open. A failed attempt can be retried with the same file.",
                  "جارٍ الاستعادة… أبقِ الصفحة مفتوحة. يمكن إعادة محاولة الملف نفسه إذا فشلت العملية.",
                )
              : l(
                  "Preparing your complete backup… Keep this page open.",
                  "جارٍ إعداد نسختك الكاملة… أبقِ الصفحة مفتوحة.",
                )}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {report && (
        <p role="status" className="text-sm">
          {report}
        </p>
      )}
    </section>
  );
}
