import { createFileRoute, Link, Outlet, useNavigate, useLocation } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  Apple,
  BadgeCheck,
  Users,
  UsersRound,
  CalendarRange,
  Target,
  Dumbbell,
  Gift,
  Home,
  LineChart,
  LogOut,
  Mail,
  Menu,
  User,
} from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { WorkoutSync } from "@/components/workout-sync";
import { MemberSync } from "@/components/member-sync";
import { useTrainingFeatures } from "@/hooks/use-training-features";
import { haptic } from "@/lib/device-feedback";
import { LevelUpWatcher } from "@/components/level-up-watcher";
import { NotificationBell } from "@/components/notification-bell";
import { useMe } from "@/hooks/use-me";
import { useI18n, type TKey } from "@/lib/i18n";
import logo from "@/assets/logo.png";
import { useWorkoutSummary } from "@/hooks/use-workout-summary";

export const Route = createFileRoute("/_authenticated/_shell")({ component: Shell });

const nav: {
  to: "/today" | "/train" | "/nutrition" | "/progress" | "/rewards" | "/profile";
  key: TKey;
  icon: typeof Home;
}[] = [
  { to: "/today", key: "today", icon: Home },
  { to: "/train", key: "train", icon: Dumbbell },
  { to: "/nutrition", key: "nutrition", icon: Apple },
  { to: "/progress", key: "progress", icon: LineChart },
  { to: "/rewards", key: "rewards", icon: Gift },
  { to: "/profile", key: "profile", icon: User },
];

function Shell() {
  const { user } = Route.useRouteContext();
  const { data: trainingFeatures } = useTrainingFeatures(user.id);
  const { data, error: permissionError } = useMe(user.id);
  const location = useLocation();
  const adminRoute = location.pathname === "/admin" || location.pathname.startsWith("/admin/");
  const { t, locale, setLocale } = useI18n();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);
  const workout = useWorkoutSummary(user.id);
  const focused = location.pathname === "/train" && !!workout?.session;

  useEffect(() => {
    if (data?.profile && !data.profile.onboarding_completed)
      navigate({ to: "/onboarding", replace: true });
  }, [data, navigate]);
  useEffect(() => {
    const l = data?.profile?.locale;
    if ((l === "ar" || l === "en") && !localStorage.getItem("pf-locale")) setLocale(l);
  }, [data?.profile?.locale]); // eslint-disable-line react-hooks/exhaustive-deps

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", search: { redirect: undefined }, replace: true });
  }

  if (data?.profile && !data.profile.access_active) {
    return (
      <div className="bg-hero flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <img src={logo} alt="Prime Vanguard" className="h-16 w-16 object-contain" />
        <h1 className="font-display text-2xl font-bold">{t("accessPausedTitle")}</h1>
        <p className="max-w-sm text-sm text-muted-foreground">{t("accessPausedBody")}</p>
        <button className="text-sm text-gold underline" onClick={signOut}>
          {t("signOut")}
        </button>
      </div>
    );
  }

  const linkCls =
    "flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-gold";
  const activeCls = "bg-accent text-gold";
  const adminLinks = [
    { to: "/admin/members", key: "members", icon: Users },
    { to: "/admin/pods", key: "pods", icon: UsersRound },
    { to: "/admin/invites", key: "invites", icon: Mail },
    { to: "/admin/exercises", key: "exercises", icon: Dumbbell },
    { to: "/admin/programs", key: "programs", icon: CalendarRange },
    { to: "/admin/analytics", key: "analytics", icon: LineChart },
    { to: "/admin/shop", key: "rewardsAdmin", icon: Gift },
    { to: "/admin/targets", key: "targets", icon: Target },
    { to: "/admin/pv", key: "pvApprovals", icon: BadgeCheck },
  ] as const;

  const navBody = (
    <>
      <img src={logo} alt="Prime Vanguard" className="mb-6 h-12 w-12 object-contain" />
      <nav className="flex flex-col gap-1">
        {nav.map(({ to, key, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            onClick={() => haptic("tab")}
            className={linkCls}
            activeProps={{ className: activeCls }}
          >
            <Icon className="h-4 w-4" />
            {t(key)}
          </Link>
        ))}
        {(data?.isAdmin || data?.roles.includes("coach") || data?.roles.includes("pod_leader")) && (
          <Link to="/members" className={`${linkCls} mt-4`} activeProps={{ className: activeCls }}>
            <UsersRound className="h-4 w-4" />
            {t("myMembers")}
          </Link>
        )}
        {data?.isAdmin && (
          <>
            <p className="mt-6 px-3 text-xs font-semibold uppercase tracking-widest text-gold">
              {t("admin")}
            </p>
            {adminLinks.map(({ to, key, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                onClick={() => haptic("tab")}
                className={linkCls}
                activeProps={{ className: activeCls }}
              >
                <Icon className="h-4 w-4" />
                {t(key)}
              </Link>
            ))}
          </>
        )}
      </nav>
      <div className="mt-auto flex flex-col gap-1 pt-6">
        <button className={linkCls} onClick={() => setLocale(locale === "ar" ? "en" : "ar")}>
          {locale === "ar" ? "English" : "العربية"}
        </button>
        <button className={linkCls} onClick={signOut}>
          <LogOut className="h-4 w-4" />
          {t("signOut")}
        </button>
      </div>
    </>
  );

  return (
    <div className="bg-hero min-h-screen md:flex">
      <aside
        className={
          focused
            ? "hidden"
            : "hidden w-60 shrink-0 flex-col border-e border-border bg-sidebar p-4 md:flex"
        }
      >
        {navBody}
        <div className="mt-1">
          <NotificationBell userId={user.id} className={linkCls} />
        </div>
      </aside>

      <header
        className={focused ? "hidden" : "flex items-center justify-between px-4 py-3 md:hidden"}
      >
        <img src={logo} alt="Prime Vanguard" className="h-9 w-9 object-contain" />
        <div className="flex gap-1">
          <Link to="/profile" aria-label={t("profile")} className={linkCls}>
            <User className="h-5 w-5" />
          </Link>
          <NotificationBell userId={user.id} className={linkCls} />
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <button className={linkCls} aria-label={locale === "ar" ? "القائمة" : "Menu"}>
                <Menu className="h-5 w-5" />
              </button>
            </SheetTrigger>
            <SheetContent
              side={locale === "ar" ? "left" : "right"}
              className="flex w-72 flex-col overflow-y-auto border-border bg-sidebar p-4"
            >
              <SheetTitle className="sr-only">{locale === "ar" ? "القائمة" : "Menu"}</SheetTitle>
              <div
                className="flex flex-1 flex-col"
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest("a,button")) setMenuOpen(false);
                }}
              >
                {navBody}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <main
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("a[data-pf-tab]")) haptic("tab");
        }}
        className={`min-w-0 flex-1 px-4 ${focused ? "pb-32 md:mx-auto md:max-w-4xl md:px-8" : workout?.session ? "pb-44 md:px-10 md:py-8" : "pb-24 md:px-10 md:py-8"}`}
      >
        {adminRoute && (permissionError || !data || !data.isAdmin) ? (
          <p
            role={permissionError ? "alert" : "status"}
            className="mt-6 text-sm text-muted-foreground"
          >
            {permissionError
              ? locale === "ar"
                ? "تعذر التحقق من الصلاحيات. أعد الاتصال وحاول مرة أخرى."
                : "Permissions could not be verified. Reconnect and try again."
              : !data
                ? locale === "ar"
                  ? "جارٍ التحقق من الصلاحيات…"
                  : "Checking permissions…"
                : t("notAllowed")}
          </p>
        ) : (
          <Outlet />
        )}
        <LevelUpWatcher userId={user.id} />
        <WorkoutSync userId={user.id} />
        {trainingFeatures?.offline && <MemberSync userId={user.id} />}
      </main>

      {!focused && workout?.session && (
        <Link
          to="/train"
          className="fixed inset-x-3 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-40 flex min-h-14 items-center justify-between gap-3 rounded-xl border border-gold bg-card px-4 py-3 shadow-lg md:inset-x-auto md:end-6 md:bottom-6 md:w-96"
        >
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">
              {workout.session.title || t("workout")}
            </span>
            <span className="text-xs text-muted-foreground">
              {workout.phase === "active"
                ? t("continueWorkout")
                : locale === "ar"
                  ? "بانتظار تأكيد المزامنة"
                  : "Waiting for sync confirmation"}
            </span>
          </span>
          <Dumbbell className="h-5 w-5 shrink-0 text-gold" />
        </Link>
      )}
      {!focused && (
        <nav
          aria-label={locale === "ar" ? "التنقل الرئيسي" : "Primary navigation"}
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-border bg-sidebar md:hidden"
        >
          {nav
            .filter((item) => item.to !== "/profile")
            .map(({ to, key, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                onClick={() => haptic("tab")}
                className="flex min-h-14 flex-col items-center justify-center gap-1 py-2 text-xs text-muted-foreground focus-visible:ring-2 focus-visible:ring-gold"
                activeProps={{ className: "text-gold" }}
              >
                <Icon className="h-5 w-5" />
                {t(key)}
              </Link>
            ))}
        </nav>
      )}
    </div>
  );
}
