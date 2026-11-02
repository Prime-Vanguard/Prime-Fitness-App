import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useI18n } from "@/lib/i18n";
import { useState } from "react";
import { Button } from "./ui/button";

export function NotificationBell({
  userId,
  className = "",
}: {
  userId: string;
  className?: string;
}) {
  const { t, locale } = useI18n();
  const qc = useQueryClient();
  const key = ["notifications", userId];
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const [failedId, setFailedId] = useState<string | undefined>();
  const [page, setPage] = useState(0);
  const unreadQuery = useQuery({
    queryKey: [...key, "unread"],
    refetchInterval: 60_000,
    queryFn: async () => {
      const result = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("member_id", userId)
        .is("read_at", null);
      if (result.error) throw result.error;
      return result.count ?? 0;
    },
  });
  const { data, isPending, error, refetch } = useQuery({
    queryKey: [...key, page],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("member_id", userId)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(page * 20, (page + 1) * 20);
      if (error) throw error;
      return data;
    },
  });
  const unread = unreadQuery.data ?? 0;

  async function markRead(id?: string) {
    if (saving || (!id && !unread)) return;
    setSaving(true);
    setSaveError("");
    try {
      let query = supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("member_id", userId)
        .is("read_at", null);
      if (id) query = query.eq("id", id);
      const result = await query;
      if (result.error) throw result.error;
      qc.invalidateQueries({ queryKey: key });
    } catch {
      setFailedId(id);
      setSaveError(
        locale === "ar"
          ? "تعذر حفظ حالة القراءة. أعد المحاولة."
          : "Could not save read status. Try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Popover>
      <PopoverTrigger className={`relative ${className}`} aria-label={t("notifications")}>
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -end-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold px-1 text-[10px] font-bold text-primary-foreground">
            {unread}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(22rem,calc(100vw-2rem))] p-0">
        <p className="border-b border-border px-4 py-2 text-sm font-semibold">
          {t("notifications")}
        </p>
        {isPending && (
          <p role="status" className="p-4 text-sm">
            {locale === "ar" ? "جارٍ تحميل الإشعارات…" : "Loading notifications…"}
          </p>
        )}
        {(error || unreadQuery.error || saveError) && (
          <div role="alert" className="p-4 text-sm">
            {saveError ||
              (locale === "ar" ? "تعذر تحميل الإشعارات." : "Could not load notifications.")}
            <Button
              variant="ghost"
              onClick={() => {
                if (saveError) void markRead(failedId);
                else {
                  void refetch();
                  void unreadQuery.refetch();
                }
              }}
            >
              {locale === "ar" ? "إعادة المحاولة" : "Retry"}
            </Button>
          </div>
        )}
        {!!unread && (
          <Button
            disabled={saving}
            variant="ghost"
            className="mx-2"
            onClick={() => void markRead()}
          >
            {locale === "ar" ? "تحديد الكل كمقروء" : "Mark all read"}
          </Button>
        )}
        {!isPending && !error && !data?.length ? (
          <p className="p-4 text-sm text-muted-foreground">{t("noNotifications")}</p>
        ) : (
          <ul className="max-h-96 divide-y divide-border overflow-y-auto">
            {(data ?? []).slice(0, 20).map((n) => {
              const body = (
                <>
                  <p className={n.read_at ? "text-muted-foreground" : "font-medium"}>
                    {locale === "ar" ? n.title_ar || n.title_en : n.title_en}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {new Date(n.created_at).toLocaleString(locale === "ar" ? "ar-EG" : "en-GB", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </>
              );
              return (
                <li key={n.id} className="px-4 py-2 text-sm">
                  {n.link ? (
                    <Link
                      to={n.link}
                      onClick={() => void markRead(n.id)}
                      className="block min-h-11 hover:text-gold"
                    >
                      {body}
                    </Link>
                  ) : (
                    <button
                      className="min-h-11 w-full text-start"
                      onClick={() => void markRead(n.id)}
                    >
                      {body}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <nav
          aria-label={locale === "ar" ? "صفحات الإشعارات" : "Notification pages"}
          className="flex items-center justify-between gap-2 border-t p-2"
        >
          <Button
            variant="ghost"
            disabled={page === 0 || isPending}
            onClick={() => setPage((p) => p - 1)}
          >
            {locale === "ar" ? "الأحدث" : "Newer"}
          </Button>
          <span className="text-xs" aria-live="polite">
            {locale === "ar" ? "صفحة" : "Page"} {page + 1}
          </span>
          <Button
            variant="ghost"
            disabled={isPending || !!error || (data?.length ?? 0) <= 20}
            onClick={() => setPage((p) => p + 1)}
          >
            {locale === "ar" ? "الأقدم" : "Older"}
          </Button>
        </nav>
      </PopoverContent>
    </Popover>
  );
}
