import { createFileRoute, useBlocker } from "@tanstack/react-router";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";
import { useI18n } from "@/lib/i18n";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AdminPersonPicker } from "@/components/admin-person-picker";
import { AdminChangeReview, type AdminReview } from "@/components/admin-change-review";
import { saveAdminTargets, sameTargets, type TargetRow } from "@/lib/admin-member-write";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { targetInput } from "@/lib/numeric-input";
import { fetchAll } from "@/lib/pagination";

export const Route = createFileRoute("/_authenticated/_shell/admin/targets")({
  head: () => ({
    meta: [
      { title: "Nutrition targets — Prime Fitness Admin" },
      { name: "description", content: "Set daily calorie, macro and water targets for members." },
      { property: "og:title", content: "Nutrition targets — Prime Fitness Admin" },
      {
        property: "og:description",
        content: "Set daily calorie, macro and water targets for members.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Targets,
});

const empty = { calories: "", protein_g: "", carbs_g: "", fat_g: "", water_ml: "2500" };
type Form = typeof empty;
function formOf(row: TargetRow | null): Form {
  return row
    ? (Object.fromEntries(
        Object.keys(empty).map((key) => [key, String(row[key as keyof Form] ?? "")]),
      ) as Form)
    : { ...empty };
}
function Targets() {
  const { user } = Route.useRouteContext();
  const { data: me } = useMe(user.id);
  const { t, locale } = useI18n();
  const [memberId, setMemberId] = useState("");
  const [visited, setVisited] = useState<string[]>([]);
  const [dirtyMembers, setDirtyMembers] = useState<Record<string, boolean>>({});
  const reportDirty = useCallback(
    (id: string, dirty: boolean) =>
      setDirtyMembers((old) => (old[id] === dirty ? old : { ...old, [id]: dirty })),
    [],
  );
  const allowed = !!me?.isAdmin && !!me.profile?.access_active;
  const unsaved = allowed && Object.values(dirtyMembers).some(Boolean);
  const blocker = useBlocker({
    shouldBlockFn: ({ current, next }) => unsaved && current.pathname !== next.pathname,
    withResolver: true,
    enableBeforeUnload: () => unsaved,
  });
  const members = useQuery({
    queryKey: ["all-profiles", user.id],
    enabled: allowed,
    queryFn: () =>
      fetchAll(
        (from, to) =>
          supabase
            .from("profiles")
            .select("id,display_name,email")
            .order("display_name")
            .order("id")
            .range(from, to),
        (row) => row.id,
      ),
  });
  if (me && !allowed) return <p className="mt-10 text-muted-foreground">{t("notAllowed")}</p>;
  return (
    <>
      <PageHeader eyebrow={t("admin")} title={t("targets")} />
      <div className="mt-6 max-w-3xl space-y-5 rounded-xl border border-border bg-card p-4 sm:p-6">
        {members.isPending && (
          <p role="status">{locale === "ar" ? "جارٍ تحميل الأعضاء…" : "Loading members…"}</p>
        )}
        {members.error && (
          <div role="alert" className="text-sm text-destructive">
            {members.error.message}
            <Button variant="ghost" onClick={() => void members.refetch()}>
              {locale === "ar" ? "إعادة المحاولة" : "Retry members"}
            </Button>
          </div>
        )}
        <AdminPersonPicker
          label={t("member")}
          people={members.data ?? []}
          value={memberId}
          disabled={!allowed || !!members.error}
          onChange={(id) => {
            setMemberId(id);
            if (id) setVisited((old) => (old.includes(id) ? old : [...old, id]));
          }}
        />
        {visited.map((id) => (
          <div key={id} hidden={id !== memberId}>
            <TargetEditor
              actor={user.id}
              member={id}
              name={
                members.data?.find((p) => p.id === id)?.display_name ||
                members.data?.find((p) => p.id === id)?.email ||
                id
              }
              enabled={allowed && memberId === id}
              onDirty={reportDirty}
            />
          </div>
        ))}
        <p className="text-xs text-muted-foreground">{t("nutritionSafety")}</p>
      </div>
      <AlertDialog
        open={blocker.status === "blocked"}
        onOpenChange={(open) => {
          if (!open && blocker.status === "blocked") blocker.reset();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {locale === "ar" ? "توجد أهداف غير محفوظة" : "Unsaved target drafts"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {locale === "ar"
                ? "مغادرة الصفحة تزيل جميع مسودات الأهداف غير المحفوظة."
                : "Leaving this page discards all unsaved member target drafts."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {locale === "ar" ? "متابعة التعديل" : "Keep editing"}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (blocker.status === "blocked") blocker.proceed();
              }}
            >
              {locale === "ar" ? "إزالة المسودات والمتابعة" : "Discard and continue"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function TargetEditor({
  actor,
  member,
  name,
  enabled,
  onDirty,
}: {
  actor: string;
  member: string;
  name: string;
  enabled: boolean;
  onDirty: (id: string, dirty: boolean) => void;
}) {
  const { t, locale } = useI18n();
  const l = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const qc = useQueryClient();
  const [draft, setDraft] = useState<{ baseline: TargetRow | null; form: Form } | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [review, setReview] = useState<AdminReview | null>(null);
  const [reload, setReload] = useState(false);
  const [reloading, setReloading] = useState(false);
  const current = useQuery({
    queryKey: ["targets", member, actor],
    enabled,
    queryFn: async () => {
      const result = await supabase
        .from("nutrition_targets")
        .select("*")
        .eq("member_id", member)
        .maybeSingle();
      if (result.error) throw result.error;
      return result.data;
    },
  });
  useEffect(() => {
    // Background refreshes must not replace a captured editing baseline.
    if (!draft && current.data !== undefined)
      setDraft({ baseline: current.data, form: formOf(current.data) });
  }, [draft, current.data]);
  const dirty =
    !!draft &&
    Object.keys(empty).some(
      (key) => draft.form[key as keyof Form] !== formOf(draft.baseline)[key as keyof Form],
    );
  useEffect(() => {
    onDirty(member, dirty);
  }, [dirty, member, onDirty]);
  const fields: [keyof Form, string][] = [
    ["calories", "kcal"],
    ["protein_g", `${t("protein")} g`],
    ["carbs_g", `${t("carbs")} g`],
    ["fat_g", `${t("fat")} g`],
    ["water_ml", `${t("water")} ml`],
  ];
  const changed =
    draft &&
    current.data !== undefined &&
    (draft.baseline?.updated_at !== current.data?.updated_at ||
      fields.some(([key]) => draft.baseline?.[key] !== current.data?.[key]));
  async function reloadTargets() {
    setReloading(true);
    try {
      const result = await current.refetch();
      if (result.error) throw result.error;
      if (result.data === undefined)
        throw new Error(l("Targets could not be loaded.", "تعذر تحميل الأهداف."));
      setDraft({ baseline: result.data, form: formOf(result.data) });
      setSaved(false);
      setError("");
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setReloading(false);
    }
  }
  function prepare(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSaved(false);
    if (!draft || current.error || reloading || !enabled) return;
    try {
      const values = targetInput(draft.form);
      if (sameTargets(draft.baseline, values)) {
        setError(l("No target values changed.", "لم تتغير قيم الأهداف."));
        return;
      }
      setReview({
        title: l("Review daily targets", "مراجعة الأهداف اليومية"),
        description: name,
        details: (
          <dl className="space-y-3">
            {fields
              .filter(([key]) => (draft.baseline?.[key] ?? null) !== values[key])
              .map(([key, label]) => (
                <div key={key} className="flex flex-wrap justify-between gap-3">
                  <dt>{label}</dt>
                  <dd>
                    <bdi>
                      {draft.baseline?.[key] ?? l("Not set", "غير محدد")} →{" "}
                      {values[key] ?? l("Not set", "غير محدد")}
                    </bdi>
                  </dd>
                </div>
              ))}
          </dl>
        ),
        save: async () => {
          const accepted = await saveAdminTargets(actor, member, values, draft.baseline);
          setDraft({ baseline: accepted, form: formOf(accepted) });
          setSaved(true);
          qc.setQueryData(["targets", member, actor], accepted);
          void qc.invalidateQueries({ queryKey: ["targets", member] });
          void qc.invalidateQueries({ queryKey: ["coach-member-nutrition", actor, member] });
        },
      });
    } catch (failure) {
      setError((failure as Error).message);
    }
  }
  return (
    <section className="space-y-4" aria-label={l("Daily targets editor", "تعديل الأهداف اليومية")}>
      <h2 className="break-words font-display text-lg">{name}</h2>
      {current.isPending && (
        <p role="status">{l("Loading saved targets…", "جارٍ تحميل الأهداف المحفوظة…")}</p>
      )}
      {current.error && (
        <div role="alert" className="text-sm text-destructive">
          {current.error.message}
          <Button variant="ghost" onClick={() => void current.refetch()}>
            {l("Retry targets", "إعادة المحاولة")}
          </Button>
        </div>
      )}
      {changed && (
        <p role="status" className="text-sm">
          {l(
            "Saved targets changed. Your draft is retained; reload to review the latest values.",
            "تغيرت الأهداف المحفوظة. تم الاحتفاظ بمسودتك؛ أعد التحميل لمراجعة القيم الجديدة.",
          )}
        </p>
      )}
      {draft && (
        <form onSubmit={prepare} className="space-y-4">
          <p className="text-xs text-muted-foreground">
            {l(
              "Daily targets. Empty fields mean not set. Unsaved drafts stay available when switching members here.",
              "أهداف يومية. الحقول الفارغة غير محددة. تبقى المسودات متاحة عند التبديل بين الأعضاء هنا.",
            )}
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {fields.map(([key, label]) => (
              <label key={key} className="text-sm">
                {label}
                <Input
                  className="mt-1"
                  aria-label={label}
                  inputMode="numeric"
                  disabled={!!review || !enabled || reloading || !!current.error}
                  value={draft.form[key]}
                  onChange={(event) => {
                    setDraft({ ...draft, form: { ...draft.form, [key]: event.target.value } });
                    setSaved(false);
                    setError("");
                  }}
                />
                <span className="mt-1 block text-xs text-muted-foreground">
                  {l("Saved", "المحفوظ")}:{" "}
                  <bdi>{draft.baseline?.[key] ?? l("Not set", "غير محدد")}</bdi>
                </span>
              </label>
            ))}
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          {saved && (
            <p role="status" className="text-sm text-success">
              {l("Daily targets saved.", "تم حفظ الأهداف اليومية.")}
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <Button
              type="submit"
              disabled={!dirty || !enabled || reloading || !!review || !!current.error}
            >
              {l("Review targets", "مراجعة الأهداف")}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={reloading || !!review || !enabled}
              onClick={() => setReload(true)}
            >
              {l("Reload saved targets", "إعادة تحميل الأهداف المحفوظة")}
            </Button>
          </div>
        </form>
      )}
      <AdminChangeReview review={review} close={() => setReview(null)} />
      <AlertDialog open={reload} onOpenChange={setReload}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {l("Discard this target draft?", "إزالة مسودة الأهداف؟")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {l(
                "Reloading replaces this member’s draft with their current saved targets. Other member drafts are retained.",
                "تستبدل إعادة التحميل مسودة هذا العضو بالأهداف المحفوظة الحالية. تبقى مسودات الأعضاء الآخرين محفوظة.",
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{l("Keep editing", "متابعة التعديل")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void reloadTargets()}>
              {l("Discard and reload", "إزالة المسودة وإعادة التحميل")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
