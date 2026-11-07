import { NativeSelect } from "@/components/ui/native-select";
import { adminDate } from "@/lib/admin-format";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMe } from "@/hooks/use-me";
import { useI18n } from "@/lib/i18n";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AdminChangeReview, type AdminReview } from "@/components/admin-change-review";
import { AdminEditorDrawer, AdminDraftWarning } from "@/components/admin-editor-drawer";
import {
  createInvitation,
  invitationInput,
  inviteSearch,
  inviteStatus,
  inviteStatuses,
  loadInvitations,
  revokeInvitation,
  type Invitation,
  type InviteRole,
} from "@/lib/admin-invites";

export const Route = createFileRoute("/_authenticated/_shell/admin/invites")({
  validateSearch: inviteSearch,
  head: () => ({
    meta: [
      { title: "Invites — Prime Fitness Admin" },
      { name: "description", content: "Invite members to Prime Fitness." },
      { property: "og:title", content: "Invites — Prime Fitness Admin" },
      { property: "og:description", content: "Invite members to Prime Fitness." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Invites,
});

const roleLabels: Record<InviteRole, [string, string]> = {
  member: ["Member", "عضو"],
  coach: ["Coach", "مدرب"],
  pod_leader: ["Pod Leader", "قائد المجموعة"],
  admin: ["Admin", "مسؤول"],
  super_admin: ["Super Admin", "مسؤول رئيسي"],
};
function Invites() {
  const { user } = Route.useRouteContext(),
    search = Route.useSearch(),
    navigate = Route.useNavigate();
  const { data: me } = useMe(user.id),
    { t, locale } = useI18n(),
    qc = useQueryClient();
  const l = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const allowed = !!me?.isAdmin && !!me.profile?.access_active,
    key = ["invites", user.id];
  const [open, setOpen] = useState(false),
    [now, setNow] = useState(Date.now);
  const [draft, setDraft] = useState(() => ({
    id: crypto.randomUUID(),
    email: "",
    role: "member" as InviteRole,
  }));
  const [pending, setPending] = useState<typeof draft | null>(null),
    [error, setError] = useState("");
  const [review, setReview] = useState<AdminReview | null>(null);
  const [message, setMessage] = useState<{ action: "created" | "revoked"; email: string } | null>(
    null,
  );
  useEffect(() => {
    const update = () => setNow(Date.now());
    const interval = setInterval(update, 30000);
    window.addEventListener("focus", update);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", update);
    };
  }, []);
  const invitations = useQuery({
    queryKey: key,
    enabled: allowed,
    retry: false,
    queryFn: ({ signal }) => loadInvitations(signal),
  });
  const roleName = (role: InviteRole) => roleLabels[role]?.[locale === "ar" ? 1 : 0] ?? role;
  const statusName = (status: string) =>
    status === "unknown"
      ? l("Status unavailable", "الحالة غير متاحة")
      : t(status as "pending" | "accepted" | "revoked" | "expired");
  const rows = (invitations.data ?? []).filter(
    (i) =>
      i.email.toLowerCase().includes((search.q ?? "").trim().toLowerCase()) &&
      (!search.status || inviteStatus(i, now) === search.status),
  );
  const pages = Math.max(1, Math.ceil(rows.length / 25)),
    page = Math.min(search.page ?? 1, pages);
  const roles: InviteRole[] = me?.isSuperAdmin
    ? ["member", "coach", "pod_leader", "admin", "super_admin"]
    : ["member", "coach", "pod_leader"];
  function accepted(invite: Invitation) {
    qc.setQueryData<Invitation[]>(key, (old) =>
      old ? [invite, ...old.filter((i) => i.id !== invite.id)] : [invite],
    );
    void qc.invalidateQueries({ queryKey: key });
  }
  function prepare(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!allowed || invitations.error) return;
    try {
      const request = pending ?? { id: draft.id, ...invitationInput(draft.email, draft.role) };
      setReview({
        title: l("Review invitation", "مراجعة الدعوة"),
        description: request.email,
        details: (
          <div className="space-y-3 text-sm">
            <p>
              {t("role")}: {roleName(request.role)}
            </p>
            <p>
              {l(
                "New invitations use the existing 14-day validity. This saves signup eligibility; email delivery is not confirmed here.",
                "تستخدم الدعوات الجديدة فترة الصلاحية الحالية البالغة ١٤ يوماً. يُحفظ السماح بالتسجيل؛ لا يتم تأكيد تسليم البريد الإلكتروني هنا.",
              )}
            </p>
          </div>
        ),
        save: async () => {
          const row = await createInvitation(user.id, request, () => setPending(request));
          accepted(row);
          setMessage({ action: "created", email: row.email });
          setPending(null);
          setDraft({ id: crypto.randomUUID(), email: "", role: "member" });
          setOpen(false);
        },
      });
    } catch (failure) {
      setError((failure as Error).message);
    }
  }
  function reviewRevoke(row: Invitation) {
    setReview({
      title: l("Review invitation revocation", "مراجعة إلغاء الدعوة"),
      description: row.email,
      details: (
        <div className="space-y-3 text-sm">
          <p>
            {t("role")}: {roleName(row.role)}
          </p>
          <p>
            {l("Expires", "تنتهي")}: <bdi>{adminDate(row.expires_at, locale)}</bdi>
          </p>
          <p>
            {l(
              "Revoking prevents this invitation from being used for signup. Accepted accounts are managed separately from Members.",
              "يمنع الإلغاء استخدام هذه الدعوة للتسجيل. تُدار الحسابات التي قبلت الدعوة بشكل منفصل من صفحة الأعضاء.",
            )}
          </p>
        </div>
      ),
      save: async () => {
        const saved = await revokeInvitation(user.id, row);
        accepted(saved);
        setMessage({ action: "revoked", email: saved.email });
      },
    });
  }
  if (me && !allowed) return <p className="mt-10 text-muted-foreground">{t("notAllowed")}</p>;
  return (
    <>
      <PageHeader eyebrow={t("admin")} title={t("invites")} />
      <p className="mt-3 max-w-3xl text-sm text-muted-foreground">
        {l(
          "Manage signup invitations and their status. Dates use Cairo time. Email delivery is not tracked on this page.",
          "أدر دعوات التسجيل وحالتها. التواريخ بتوقيت القاهرة. لا تُتابع هذه الصفحة تسليم البريد الإلكتروني.",
        )}
      </p>
      <div className="mt-6 flex flex-wrap items-end gap-4">
        <label className="w-full max-w-sm text-sm">
          {l("Search invitations", "بحث الدعوات")}
          <Input
            className="mt-1"
            type="search"
            dir="ltr"
            value={search.q ?? ""}
            onChange={(e) =>
              void navigate({
                search: (old) => ({ ...old, q: e.target.value || undefined, page: undefined }),
                replace: true,
              })
            }
            placeholder={l("Email address", "البريد الإلكتروني")}
          />
        </label>
        <label className="text-sm min-w-0 max-w-full block">
          {l("Invitation status", "حالة الدعوة")}
          <NativeSelect
            className="mt-2"
            value={search.status ?? "all"}
            onChange={(e) =>
              void navigate({
                search: (old) => ({
                  ...old,
                  status: e.target.value === "all" ? undefined : e.target.value,
                  page: undefined,
                }),
              })
            }
          >
            <option value="all">{l("All statuses", "كل الحالات")}</option>
            {inviteStatuses.map((status) => (
              <option key={status} value={status}>
                {statusName(status)}
              </option>
            ))}
          </NativeSelect>
        </label>
        <Button
          disabled={!allowed || !!invitations.error || invitations.isPending}
          onClick={() => setOpen(true)}
        >
          {l("Create invitation", "إنشاء دعوة")}
        </Button>
        <Button
          variant="outline"
          disabled={!allowed || invitations.isFetching}
          onClick={() => void invitations.refetch()}
        >
          {l("Refresh invitations", "تحديث الدعوات")}
        </Button>
      </div>
      {message && (
        <p role="status" className="mt-4 break-words text-sm text-success">
          {message.action === "created"
            ? l(
                "Invitation saved; email delivery is not confirmed.",
                "تم حفظ الدعوة؛ لم يُؤكد تسليم البريد الإلكتروني.",
              )
            : l("Invitation revoked.", "تم إلغاء الدعوة.")}{" "}
          <bdi dir="ltr">{message.email}</bdi>
        </p>
      )}
      {invitations.isPending && (
        <p role="status" className="mt-5">
          {l("Loading invitations…", "جارٍ تحميل الدعوات…")}
        </p>
      )}
      {invitations.error && (
        <div role="alert" className="mt-4 text-sm text-destructive">
          {l(
            "Invitations could not be loaded completely. Displayed data may be out of date; changes are paused.",
            "تعذر تحميل الدعوات بالكامل. قد تكون البيانات قديمة؛ تم إيقاف التعديلات مؤقتاً.",
          )}
          <Button variant="outline" onClick={() => void invitations.refetch()}>
            {l("Retry invitations", "إعادة تحميل الدعوات")}
          </Button>
        </div>
      )}
      {!invitations.isPending && !invitations.error && !rows.length && (
        <p role="status" className="mt-6 text-sm">
          {l("No invitations match these filters.", "لا توجد دعوات تطابق هذه التصفية.")}
        </p>
      )}
      <ul className="mt-6 grid gap-4 lg:grid-cols-2">
        {rows.slice((page - 1) * 25, page * 25).map((row) => (
          <li
            key={row.id}
            className="min-w-0 space-y-3 rounded-xl border border-border bg-card p-5"
          >
            <p className="break-all font-medium">
              <bdi dir="ltr">{row.email}</bdi>
            </p>
            <div className="flex flex-wrap gap-3 text-sm">
              <span>{roleName(row.role)}</span>
              <span
                className={
                  inviteStatus(row, now) === "pending" ? "text-gold" : "text-muted-foreground"
                }
              >
                {statusName(inviteStatus(row, now))}
              </span>
            </div>
            <dl className="space-y-2 text-xs text-muted-foreground">
              {[
                [l("Created", "أُنشئت"), row.created_at],
                [l("Expires", "تنتهي"), row.expires_at],
                ...(row.accepted_at ? [[l("Accepted", "قُبلت"), row.accepted_at]] : []),
                ...(row.revoked_at ? [[l("Revoked", "أُلغيت"), row.revoked_at]] : []),
              ].map(([label, date]) => (
                <div key={label} className="flex flex-wrap justify-between gap-2">
                  <dt>{label}</dt>
                  <dd>
                    <bdi>{adminDate(date ?? null, locale)}</bdi>
                  </dd>
                </div>
              ))}
            </dl>
            {!row.accepted_at && !row.revoked_at && (
              <Button
                variant="outline"
                disabled={
                  !!invitations.error ||
                  !!review ||
                  (!me?.isSuperAdmin && (row.role === "admin" || row.role === "super_admin"))
                }
                onClick={() => reviewRevoke(row)}
              >
                {t("revoke")}
              </Button>
            )}
            {!me?.isSuperAdmin && (row.role === "admin" || row.role === "super_admin") && (
              <p className="text-xs text-muted-foreground">
                {l(
                  "Privileged invitations require a super administrator.",
                  "تتطلب الدعوات ذات الصلاحيات المرتفعة مسؤولاً رئيسياً.",
                )}
              </p>
            )}
          </li>
        ))}
      </ul>
      {pages > 1 && (
        <nav
          aria-label={l("Invitation pages", "صفحات الدعوات")}
          className="mt-5 flex items-center justify-between gap-3"
        >
          <Button
            variant="outline"
            disabled={page === 1}
            onClick={() => void navigate({ search: (old) => ({ ...old, page: page - 1 }) })}
          >
            {l("Previous invitations", "الدعوات السابقة")}
          </Button>
          <span>
            <bdi>
              {page} / {pages}
            </bdi>
          </span>
          <Button
            variant="outline"
            disabled={page === pages}
            onClick={() => void navigate({ search: (old) => ({ ...old, page: page + 1 }) })}
          >
            {l("Next invitations", "الدعوات التالية")}
          </Button>
        </nav>
      )}
      <AdminEditorDrawer
        open={open}
        close={() => setOpen(false)}
        locked={!!review}
        title={l("Create invitation", "إنشاء دعوة")}
        description={l(
          "Review the email and role before saving signup eligibility.",
          "راجع البريد الإلكتروني والدور قبل حفظ السماح بالتسجيل.",
        )}
      >
        <form onSubmit={prepare} className="space-y-5">
          <label className="block text-sm">
            {t("email")}
            <Input
              className="mt-1"
              type="email"
              dir="ltr"
              required
              maxLength={254}
              value={draft.email}
              disabled={!!pending || !!review}
              onChange={(e) => {
                setDraft({ ...draft, email: e.target.value });
                setError("");
              }}
            />
          </label>
          <label className="block text-sm min-w-0 max-w-full">
            {t("role")}
            <NativeSelect
              className="mt-2"
              value={draft.role}
              disabled={!!pending || !!review}
              onChange={(e) => setDraft({ ...draft, role: e.target.value as InviteRole })}
            >
              {roles.map((role) => (
                <option key={role} value={role}>
                  {roleName(role)}
                </option>
              ))}
            </NativeSelect>
          </label>
          {pending && (
            <p role="status" className="text-sm">
              {l(
                "This request may already be saved. Review and retry the same invitation before starting another.",
                "قد يكون هذا الطلب محفوظاً بالفعل. راجع الدعوة نفسها وأعد محاولتها قبل بدء دعوة أخرى.",
              )}
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button
            type="submit"
            disabled={!allowed || !!invitations.error || !!review || !draft.email.trim()}
          >
            {l("Review invitation", "مراجعة الدعوة")}
          </Button>
          <p className="text-xs text-muted-foreground">
            {l(
              "Closing retains this draft for this page visit. Invitation creation does not confirm email delivery.",
              "الإغلاق يحتفظ بالمسودة خلال هذه الزيارة. إنشاء الدعوة لا يؤكد تسليم البريد الإلكتروني.",
            )}
          </p>
        </form>
      </AdminEditorDrawer>
      <AdminChangeReview review={review} close={() => setReview(null)} />
      <AdminDraftWarning dirty={allowed && (!!draft.email || !!pending || !!review)} />
    </>
  );
}
