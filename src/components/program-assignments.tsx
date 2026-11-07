import { NativeSelect } from "@/components/ui/native-select";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import {
  assignReviewedVersion,
  loadProgramAssignments,
  loadProgramMembers,
  loadProgramVersions,
  readActiveAssignment,
  removeAssignment,
  type Program,
} from "@/lib/admin-programs";
import { AdminPersonPicker } from "./admin-person-picker";
import { AdminChangeReview, type AdminReview } from "./admin-change-review";
import { adminDate } from "@/lib/admin-format";
import { Button } from "./ui/button";
export function ProgramAssignments({
  actor,
  program,
  enabled,
  selectedVersion,
  onDirty,
}: {
  actor: string;
  program: Program;
  enabled: boolean;
  selectedVersion: string;
  onDirty: (dirty: boolean) => void;
}) {
  const { locale } = useI18n(),
    qc = useQueryClient(),
    l = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const [version, setVersion] = useState(""),
    [member, setMember] = useState(""),
    [review, setReview] = useState<AdminReview | null>(null),
    [error, setError] = useState(""),
    [preparing, setPreparing] = useState(false),
    [saved, setSaved] = useState(false);
  const versions = useQuery({
      queryKey: ["program-versions", program.id, actor],
      enabled,
      retry: false,
      queryFn: ({ signal }) => loadProgramVersions(program.id, signal),
    }),
    people = useQuery({
      queryKey: ["program-editor-members", actor],
      enabled,
      retry: false,
      queryFn: ({ signal }) => loadProgramMembers(signal),
    }),
    assigned = useQuery({
      queryKey: ["program-assignments", program.id, actor],
      enabled,
      retry: false,
      queryFn: ({ signal }) => loadProgramAssignments(program.id, signal),
    });
  useEffect(() => {
    if (selectedVersion) setVersion(selectedVersion);
  }, [selectedVersion]);
  useEffect(() => onDirty(!!member || !!review || preparing), [member, review, preparing, onDirty]);
  const chosen = versions.data?.find((v) => v.id === (version || versions.data[0]?.id));
  const ready =
    enabled &&
    !!chosen &&
    !!people.data &&
    !!assigned.data &&
    !versions.error &&
    !people.error &&
    !assigned.error;
  const name = (id: string) =>
    people.data?.find((p) => p.id === id)?.display_name ||
    people.data?.find((p) => p.id === id)?.email ||
    l("Member unavailable", "بيانات العضو غير متاحة");
  async function prepare() {
    if (!ready || !chosen || !member || preparing) return;
    setPreparing(true);
    setError("");
    try {
      const original = await readActiveAssignment(member);
      let previous = l("No active program", "لا يوجد برنامج نشط");
      if (original?.program_version_id) {
        const label = await supabase
          .from("program_versions")
          .select("name,version")
          .eq("id", original.program_version_id)
          .maybeSingle()
          .retry(false);
        if (label.error) throw label.error;
        previous = label.data
          ? `${label.data.name} · v${label.data.version}`
          : l("Active program details unavailable", "بيانات البرنامج النشط غير متاحة");
      }
      setReview({
        title: l("Review program assignment", "مراجعة تعيين البرنامج"),
        description: name(member),
        details: (
          <div className="space-y-3 text-sm">
            <p>
              {l("Current assignment", "التعيين الحالي")}: {previous}
            </p>
            <p>
              {l("Assign frozen version", "تعيين نسخة مجمدة")}: {chosen.name} · v{chosen.version} ·{" "}
              {chosen.weeks} {l("weeks", "أسابيع")}
            </p>
            <p>
              {l(
                "This replaces the member’s active program. Previous history and frozen versions remain saved. An assignment changed by another administrator must be reviewed again.",
                "يستبدل هذا البرنامج النشط للعضو. يبقى السجل والنسخ المجمدة محفوظاً. يجب إعادة مراجعة أي تعيين يغيّره مسؤول آخر.",
              )}
            </p>
          </div>
        ),
        save: async () => {
          await assignReviewedVersion(actor, member, chosen, original);
          setMember("");
          setSaved(true);
          await qc.invalidateQueries({ queryKey: ["program-assignments", program.id, actor] });
          void qc.invalidateQueries({ queryKey: ["my-program"] });
          void qc.invalidateQueries({ queryKey: ["training-schedule"] });
        },
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPreparing(false);
    }
  }
  return (
    <section
      className="space-y-4"
      aria-label={l("Frozen versions and assignments", "النسخ المجمدة والتعيينات")}
    >
      <p className="text-sm text-muted-foreground">
        {l(
          "Assign a published snapshot. Editing the draft never rewrites these versions or completed workouts.",
          "عيّن نسخة منشورة. تعديل المسودة لا يعيد كتابة هذه النسخ أو التدريبات المكتملة.",
        )}
      </p>
      {enabled && (versions.isPending || people.isPending || assigned.isPending) && (
        <p role="status">{l("Loading versions and members…", "جارٍ تحميل النسخ والأعضاء…")}</p>
      )}
      {(
        [
          [versions, l("Retry versions", "إعادة تحميل النسخ")],
          [people, l("Retry members", "إعادة تحميل الأعضاء")],
          [assigned, l("Retry assignments", "إعادة تحميل التعيينات")],
        ] as const
      ).map(([resource, label]) =>
        resource.error ? (
          <div key={label} role="alert" className="text-sm text-destructive">
            {resource.error.message}
            <Button variant="outline" onClick={() => void resource.refetch()}>
              {label}
            </Button>
          </div>
        ) : null,
      )}
      <label className="block text-sm min-w-0 max-w-full">
        {l("Published version", "النسخة المنشورة")}
        <NativeSelect
          className="mt-2"
          value={chosen?.id ?? ""}
          disabled={!enabled || preparing || !!review}
          onChange={(e) => setVersion(e.target.value)}
        >
          <option value="">
            {l("Publish the saved draft first", "انشر المسودة المحفوظة أولاً")}
          </option>
          {versions.data?.map((v) => (
            <option key={v.id} value={v.id}>
              v{v.version} · {adminDate(v.created_at, locale)}
            </option>
          ))}
        </NativeSelect>
      </label>
      {chosen && (
        <details className="rounded-xl border border-border p-4">
          <summary className="min-h-11 cursor-pointer text-sm">
            {l("Preview frozen version", "معاينة النسخة المجمدة")} v{chosen.version}
          </summary>
          <p className="break-words text-sm">
            {chosen.name} · {chosen.weeks} {l("weeks", "أسابيع")}
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            {Array.isArray(chosen.items) &&
              chosen.items.flatMap((item, index) => {
                if (!item || typeof item !== "object" || Array.isArray(item)) return [];
                return (
                  <li key={index} className="break-words">
                    {String(item["week"] ?? "—")}/{String(item["day"] ?? "—")} ·{" "}
                    {String(
                      locale === "ar"
                        ? item["name_ar"] || item["name_en"] || "—"
                        : item["name_en"] || "—",
                    )}{" "}
                    · {String(item["target_sets"] ?? "—")} × {String(item["target_reps"] ?? "—")}
                  </li>
                );
              })}
          </ul>
        </details>
      )}
      <AdminPersonPicker
        label={l("Member to assign", "العضو المراد تعيينه")}
        people={people.data ?? []}
        value={member}
        onChange={setMember}
        disabled={!ready || preparing || !!review}
      />
      <Button disabled={!ready || !member || preparing || !!review} onClick={() => void prepare()}>
        {preparing ? "…" : l("Review assignment", "مراجعة التعيين")}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {saved && (
        <p role="status" className="text-sm text-success">
          {l("Assignment changes saved.", "تم حفظ تغييرات التعيين.")}
        </p>
      )}
      <h3 className="font-medium">{l("Active assignments", "التعيينات النشطة")}</h3>
      <ul className="space-y-3">
        {assigned.data?.map((a) => (
          <li key={a.id} className="space-y-2 rounded-xl border border-border p-4">
            <p className="break-words text-sm">
              {name(a.member_id)} · <bdi>{a.start_date}</bdi> · v
              {versions.data?.find((v) => v.id === a.program_version_id)?.version ?? "—"}
            </p>
            <Button
              variant="outline"
              disabled={!ready || !!review}
              onClick={() =>
                setReview({
                  title: l("Review assignment removal", "مراجعة إزالة التعيين"),
                  description: name(a.member_id),
                  details: (
                    <p>
                      {l(
                        "Deactivate this assignment only. Workout history and the published version remain saved; a newer replacement assignment is retained.",
                        "أوقف هذا التعيين فقط. يبقى سجل التدريب والنسخة المنشورة محفوظاً؛ ويُحتفظ بأي تعيين بديل أحدث.",
                      )}
                    </p>
                  ),
                  save: async () => {
                    await removeAssignment(actor, a);
                    setSaved(true);
                    await qc.invalidateQueries({
                      queryKey: ["program-assignments", program.id, actor],
                    });
                    void qc.invalidateQueries({ queryKey: ["my-program"] });
                  },
                })
              }
            >
              {l("Remove assignment", "إزالة التعيين")}
            </Button>
          </li>
        ))}
      </ul>
      <AdminChangeReview review={review} close={() => setReview(null)} />
    </section>
  );
}
