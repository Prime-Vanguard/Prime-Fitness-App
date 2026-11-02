import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AdminChangeReview, type AdminReview } from "@/components/admin-change-review";
import { saveMemberChange, type MemberChange } from "@/lib/admin-member-write";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useMe } from "@/hooks/use-me";
import { useI18n } from "@/lib/i18n";
import { PageHeader } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import { fetchAll } from "@/lib/pagination";
import { TrainingRollout } from "@/components/training-rollout";
import { normalizeExercise } from "@/lib/exercise-guidance";

type Role = Database["public"]["Enums"]["app_role"];

export const Route = createFileRoute("/_authenticated/_shell/admin/members")({
  head: () => ({
    meta: [
      { title: "Members — Prime Fitness Admin" },
      { name: "description", content: "Manage member access, roles and coach assignments." },
      { property: "og:title", content: "Members — Prime Fitness Admin" },
      { property: "og:description", content: "Manage member access, roles and coach assignments." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

const ROLE_LABEL: Record<Role, string> = {
  member: "Member",
  coach: "Coach",
  pod_leader: "Pod Leader",
  admin: "Admin",
  super_admin: "Super Admin",
};
const ROLE_LABEL_AR: Record<Role, string> = {
  member: "عضو",
  coach: "مدرب",
  pod_leader: "قائد المجموعة",
  admin: "مسؤول",
  super_admin: "مسؤول رئيسي",
};
const sel = "min-h-11 rounded-md border border-input bg-background px-2 text-sm";

function Page() {
  const { user } = Route.useRouteContext();
  const { data: me } = useMe(user.id);
  const { t, locale } = useI18n();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [review, setReview] = useState<AdminReview | null>(null);
  const [accessFilter, setAccessFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");

  const {
    data: result,
    error,
    isPending,
    refetch,
  } = useQuery({
    queryKey: ["admin-members", user.id],
    enabled: !!me?.isAdmin && !!me.profile?.access_active,
    queryFn: async () => {
      const [p, r, c] = await Promise.all([
        fetchAll(
          (from, to) =>
            supabase
              .from("profiles")
              .select("id,display_name,email,access_active,created_at")
              .order("created_at")
              .order("id")
              .range(from, to),
          (row) => row.id,
        ),
        fetchAll(
          (from, to) =>
            supabase.from("user_roles").select("user_id,role").order("id").range(from, to),
          (row) => `${row.user_id}:${row.role}`,
        ),
        fetchAll(
          (from, to) =>
            supabase
              .from("coach_assignments")
              .select("id,coach_id,member_id")
              .eq("active", true)
              .order("id")
              .range(from, to),
          (row) => row.id,
        ),
      ]);
      return { people: p, roles: r, coaching: c };
    },
  });
  const data = error ? undefined : result;
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-members"] });

  if (me && (!me.isAdmin || !me.profile?.access_active))
    return <p className="mt-10 text-muted-foreground">{t("notAllowed")}</p>;

  const rolesOf = (id: string) =>
    data?.roles.filter((r) => r.user_id === id).map((r) => r.role) ?? [];
  const coaches = data?.people.filter((p) => rolesOf(p.id).includes("coach")) ?? [];
  const grantable: Role[] = me?.isSuperAdmin
    ? ["coach", "pod_leader", "admin"]
    : ["coach", "pod_leader"];

  const l = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const roleLabel = (role: Role) => (locale === "ar" ? ROLE_LABEL_AR[role] : ROLE_LABEL[role]);
  function reviewChange(change: MemberChange, summary: string) {
    const person = data?.people.find((p) => p.id === change.member);
    if (!person) return;
    setReview({
      title: l("Review member changes", "مراجعة تغييرات العضو"),
      description: `${person.display_name || person.email} - ${person.email}`,
      details: <p className="text-sm">{summary}</p>,
      save: async () => {
        await saveMemberChange(user.id, change);
        await refresh();
        toast.success(t("saved"));
      },
    });
  }
  const list = (data?.people ?? []).filter(
    (p) =>
      normalizeExercise(`${p.display_name ?? ""} ${p.email ?? ""}`).includes(
        normalizeExercise(q),
      ) &&
      (accessFilter === "all" || p.access_active === (accessFilter === "active")) &&
      (roleFilter === "all" || rolesOf(p.id).includes(roleFilter as Role)),
  );
  const pages = Math.max(1, Math.ceil(list.length / 50));
  const currentPage = Math.min(page, pages - 1);

  return (
    <>
      <AdminChangeReview review={review} close={() => setReview(null)} />
      <PageHeader eyebrow={t("admin")} title={t("members")} />
      <nav className="mt-4 flex flex-wrap gap-2 text-xs md:hidden">
        <Link to="/admin/pods" className="rounded-full border border-border px-3 py-1">
          {t("pods")}
        </Link>
        <Link to="/admin/invites" className="rounded-full border border-border px-3 py-1">
          {t("invites")}
        </Link>
        <Link to="/admin/programs" className="rounded-full border border-border px-3 py-1">
          {t("programs")}
        </Link>
        <Link to="/admin/exercises" className="rounded-full border border-border px-3 py-1">
          {t("exercises")}
        </Link>
        <Link to="/admin/targets" className="rounded-full border border-border px-3 py-1">
          {t("targets")}
        </Link>
        <Link to="/admin/pv" className="rounded-full border border-border px-3 py-1">
          {t("pvApprovals")}
        </Link>
        <Link to="/admin/shop" className="rounded-full border border-border px-3 py-1">
          {t("rewardsAdmin")}
        </Link>
        <Link to="/admin/analytics" className="rounded-full border border-border px-3 py-1">
          {t("analytics")}
        </Link>
      </nav>
      {error && (
        <div role="alert" className="mt-4 text-sm text-destructive">
          {locale === "ar"
            ? "تعذر تحميل قائمة الأعضاء كاملة."
            : "The complete member list could not be loaded."}
          <button onClick={() => void refetch()} className="ms-2 underline">
            {locale === "ar" ? "إعادة المحاولة" : "Retry members"}
          </button>
        </div>
      )}
      {isPending && (
        <p role="status" className="mt-3 text-sm">
          {locale === "ar" ? "جارٍ تحميل الأعضاء…" : "Loading members…"}
        </p>
      )}
      <details className="mt-6 rounded-xl border border-border p-4">
        <summary className="min-h-11 cursor-pointer text-sm">
          {l("Training rollout settings", "إعدادات إطلاق ميزات التدريب")}
        </summary>
        <TrainingRollout userId={user.id} />
      </details>
      <Input
        className="mt-6 max-w-sm"
        placeholder={t("search")}
        aria-label={t("search")}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setPage(0);
        }}
      />
      <div className="mt-3 flex flex-wrap gap-3">
        <label className="text-sm">
          {l("Access filter", "تصفية الوصول")}
          <select
            className={sel + " ms-2"}
            value={accessFilter}
            onChange={(e) => {
              setAccessFilter(e.target.value);
              setPage(0);
            }}
          >
            <option value="all">{l("All", "الكل")}</option>
            <option value="active">{t("accessOn")}</option>
            <option value="paused">{t("accessOff")}</option>
          </select>
        </label>
        <label className="text-sm">
          {l("Role filter", "تصفية الدور")}
          <select
            className={sel + " ms-2"}
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(0);
            }}
          >
            <option value="all">{l("All", "الكل")}</option>
            {Object.entries(ROLE_LABEL).map(([role, label]) => (
              <option key={role} value={role}>
                {locale === "ar" ? ROLE_LABEL_AR[role as Role] : label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {!isPending && !error && !list.length && (
        <p role="status" className="mt-4 text-sm">
          {l("No members match these filters.", "لا يوجد أعضاء يطابقون هذه التصفية.")}
        </p>
      )}
      <ul className="mt-4 max-w-5xl space-y-3">
        {list.slice(currentPage * 50, (currentPage + 1) * 50).map((p) => {
          const roles = rolesOf(p.id);
          const locked = roles.includes("super_admin");
          const coachId = data?.coaching.find((c) => c.member_id === p.id)?.coach_id ?? "";
          return (
            <li key={p.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-words font-medium">{p.display_name || p.email}</p>
                  <p className="break-all text-xs text-muted-foreground">{p.email}</p>
                </div>
                <button
                  disabled={locked || p.id === user.id}
                  onClick={() =>
                    reviewChange(
                      { kind: "access", member: p.id, active: !p.access_active },
                      `${t("access")}: ${p.access_active ? t("accessOn") : t("accessOff")} → ${p.access_active ? t("accessOff") : t("accessOn")}`,
                    )
                  }
                  className={`min-h-11 rounded-full px-3 py-1 text-xs disabled:opacity-50 ${p.access_active ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}
                >
                  {t("access")}: {p.access_active ? t("accessOn") : t("accessOff")}
                </button>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {roles.includes("super_admin") && (
                  <span className="rounded-full border border-gold px-3 py-1 text-xs text-gold">
                    {roleLabel("super_admin")}
                  </span>
                )}
                {grantable.map((r) => {
                  const has = roles.includes(r);
                  return (
                    <button
                      key={r}
                      disabled={locked || p.id === user.id}
                      onClick={() =>
                        reviewChange(
                          { kind: "role", member: p.id, role: r, grant: !has },
                          `${has ? l("Remove role", "إزالة الدور") : l("Grant role", "منح الدور")}: ${roleLabel(r)}`,
                        )
                      }
                      className={`min-h-11 rounded-full border px-3 py-1 text-xs disabled:opacity-50 ${has ? "border-gold text-gold" : "border-border text-muted-foreground"}`}
                    >
                      {roleLabel(r)}
                    </button>
                  );
                })}
                <label className="ms-auto flex w-full min-w-0 items-center gap-2 text-xs text-muted-foreground sm:w-auto">
                  {t("coach")}
                  <select
                    className={sel + " min-w-0 flex-1 sm:w-48"}
                    value={coachId}
                    disabled={!!review || !me?.profile?.access_active}
                    onChange={(e) => {
                      const next = e.target.value;
                      const name = (id: string) =>
                        data?.people.find((c) => c.id === id)?.display_name ||
                        data?.people.find((c) => c.id === id)?.email ||
                        t("none");
                      reviewChange(
                        { kind: "coach", member: p.id, coach: next },
                        `${t("coach")}: ${name(coachId)} → ${name(next)}`,
                      );
                    }}
                  >
                    <option value="">{t("none")}</option>
                    {coaches
                      .filter((c) => c.id !== p.id)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.display_name || c.email}
                        </option>
                      ))}
                  </select>
                </label>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="mt-3 flex max-w-5xl items-center justify-between text-xs">
        <button
          disabled={currentPage === 0}
          onClick={() => setPage(currentPage - 1)}
          className="rounded border p-2 disabled:opacity-50"
        >
          {locale === "ar" ? "السابق" : "Previous members"}
        </button>
        <span>
          {currentPage + 1} / {pages} · {list.length}
        </span>
        <button
          disabled={currentPage >= pages - 1}
          onClick={() => setPage(currentPage + 1)}
          className="rounded border p-2 disabled:opacity-50"
        >
          {locale === "ar" ? "التالي" : "Next members"}
        </button>
      </div>
    </>
  );
}
