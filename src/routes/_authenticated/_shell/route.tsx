import { createFileRoute, Link, Outlet, useNavigate, useLocation } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Dumbbell, Menu, User } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { toast } from "sonner";
import { signOutMember } from "@/integrations/supabase/client";
import { WorkoutCompletionRefresh } from "@/components/workout-sync";
import { MemberSync } from "@/components/member-sync";
import { StaffOfflineRevalidation } from "@/components/staff-offline-downloads";
import { AutomaticOfflinePreparation } from "@/components/automatic-offline-preparation";
import { useTrainingFeatures } from "@/hooks/use-training-features";
import { haptic } from "@/lib/device-feedback";
import { LevelUpWatcher } from "@/components/level-up-watcher";
import { NotificationBell } from "@/components/notification-bell";
import { useMe } from "@/hooks/use-me";
import { stripAppBase } from "@/lib/app-path";
import { useI18n } from "@/lib/i18n";
import { useWorkoutSummary } from "@/hooks/use-workout-summary";
import { BrandLockup } from "@/components/brand-lockup";
import {
  WorkspaceNavigation,
  WorkspaceBottomNavigation,
} from "@/features/navigation/workspace-navigation";
import {
  routeWorkspace,
  staffAccess,
  workspaceDestinations,
  workspaceHome,
  workspaceName,
  type Workspace,
} from "@/features/navigation/workspace";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/_shell")({ component: Shell });

// This is an account/project-scoped presentation preference, never permission evidence.
function readWorkspace(key: string): Workspace {
  try {
    return typeof window !== "undefined" && sessionStorage.getItem(key) === "staff"
      ? "staff"
      : "fitness";
  } catch {
    return "fitness";
  }
}

// Shared signed-in layout: navigation, permission-aware routes and sync owners.
function Shell() {
  const { user } = Route.useRouteContext();
  const { data: trainingFeatures } = useTrainingFeatures(user.id);
  const { data, error: permissionError } = useMe(user.id);
  const location = useLocation();
  const path = stripAppBase(location.pathname).replace(/\/$/, "") || "/";
  const adminRoute = path === "/admin" || path.startsWith("/admin/");
  const { t, locale, setLocale } = useI18n();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);
  const preferenceKey = `pf-workspace:${import.meta.env["VITE_SUPABASE_URL"]}:${user.id}`;
  const [sharedWorkspace, setSharedWorkspace] = useState(() => ({
    key: preferenceKey,
    value: readWorkspace(preferenceKey),
  }));
  const routedWorkspace = routeWorkspace(path);
  const access = staffAccess(
    data?.roles ?? [],
    !permissionError && data?.profile?.access_active === true,
  );
  const workspace =
    routedWorkspace ??
    (access.staff && sharedWorkspace.key === preferenceKey ? sharedWorkspace.value : "fitness");
  const destinations = workspaceDestinations(workspace, access);
  useEffect(() => {
    setSharedWorkspace({ key: preferenceKey, value: readWorkspace(preferenceKey) });
  }, [preferenceKey]);
  useEffect(() => {
    if (!routedWorkspace) return;
    setSharedWorkspace({ key: preferenceKey, value: routedWorkspace });
    try {
      sessionStorage.setItem(preferenceKey, routedWorkspace);
    } catch {
      /* Preference storage is optional. */
    }
  }, [routedWorkspace, preferenceKey]);
  useEffect(() => {
    setMenuOpen(false);
  }, [path]);
  useEffect(() => {
    const media = matchMedia("(min-width: 768px)");
    const closeOnDesktop = () => {
      if (media.matches) setMenuOpen(false);
    };
    media.addEventListener("change", closeOnDesktop);
    return () => media.removeEventListener("change", closeOnDesktop);
  }, []);
  const switchWorkspace = (next: Workspace) => {
    if (next === "staff" && !access.staff) return;
    setMenuOpen(false);
    // Navigate first; route-owned selection changes only if draft guards accept it.
    void navigate({ to: workspaceHome(next, access.admin) });
  };

  const pageRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
    if (reducedMotion.matches) return;
    const animation = pageRef.current?.animate([{ opacity: 0.85 }, { opacity: 1 }], {
      duration: 140,
      easing: "ease-out",
    });
    const cancel = () => animation?.cancel();
    reducedMotion.addEventListener("change", cancel);
    return () => {
      cancel();
      reducedMotion.removeEventListener("change", cancel);
    };
  }, [path]);
  const workout = useWorkoutSummary(user.id);
  const focused =
    path === "/train" &&
    !!workout?.session &&
    new URLSearchParams(location.searchStr).get("view") !== "overview";

  useEffect(() => {
    if (data?.profile && !data.profile.onboarding_completed)
      navigate({ to: "/onboarding", replace: true });
  }, [data, navigate]);
  useEffect(() => {
    const l = data?.profile?.locale;
    if ((l === "ar" || l === "en") && !localStorage.getItem("pf-locale")) setLocale(l);
  }, [data?.profile?.locale]); // eslint-disable-line react-hooks/exhaustive-deps

  async function signOut() {
    try {
      sessionStorage.removeItem(preferenceKey);
    } catch {
      /* Optional UI preference only. */
    }
    const result = await signOutMember().catch((error: unknown) => ({
      error: error instanceof Error ? error : new Error(String(error)),
    }));
    // The session is still valid, so stay here rather than show a sign-in page
    // that would send the member straight back in.
    if (result.error) {
      toast.error(
        locale === "ar"
          ? `تعذر تسجيل الخروج: ${result.error.message}`
          : `Sign-out failed: ${result.error.message}`,
      );
      return;
    }
    await qc.cancelQueries();
    qc.clear();
    navigate({ to: "/auth", search: { redirect: undefined }, replace: true });
  }

  if (data?.profile && !data.profile.access_active) {
    return (
      <div className="bg-hero flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        {/* A paused account stays outside member navigation; this card grants no cached access. */}
        <BrandLockup />
        <section className="w-full max-w-md space-y-5 rounded-xl bg-card p-6 text-start">
          <h1 className="font-display text-2xl font-bold">{t("accessPausedTitle")}</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">{t("accessPausedBody")}</p>
          <button
            className="min-h-11 rounded-lg border border-destructive/50 px-4 text-sm text-destructive focus-visible:ring-2 focus-visible:ring-gold"
            onClick={signOut}
          >
            {t("signOut")}
          </button>
        </section>
      </div>
    );
  }

  const controlClass =
    "flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold";
  const navigationProps = {
    workspace,
    destinations,
    canSwitch: access.staff,
    onSwitch: switchWorkspace,
    onClose: () => setMenuOpen(false),
    onSignOut: () => void signOut(),
  };

  return (
    <div className="min-h-dvh bg-background md:flex" data-studio-shell data-workspace={workspace}>
      <a
        href="#main-content"
        className="fixed start-4 top-2 z-[100] -translate-y-24 rounded-lg bg-primary px-4 py-3 text-primary-foreground focus:translate-y-0"
      >
        {locale === "ar" ? "تخطى إلى المحتوى" : "Skip to content"}
      </a>
      <aside
        className={
          focused
            ? "hidden"
            : "sticky top-0 hidden h-dvh w-[88px] shrink-0 flex-col overflow-hidden border-e border-border bg-sidebar md:flex lg:w-60"
        }
      >
        <WorkspaceNavigation {...navigationProps} />
      </aside>

      <header
        className={
          focused
            ? "hidden"
            : "flex min-h-18 items-center justify-between gap-2 border-b border-border px-4 py-3 md:hidden"
        }
      >
        <div className="min-w-0">
          <BrandLockup />
          {/* Members have one workspace; only staff need to see which one is active. */}
          {workspace !== "fitness" && (
            <p className="mt-1 text-xs text-muted-foreground">
              {workspaceName(workspace, locale === "ar")}
            </p>
          )}
        </div>
        <div className="flex shrink-0">
          <NotificationBell userId={user.id} className={controlClass} />
          <Link to="/profile" aria-label={t("profile")} className={controlClass}>
            <User className="h-5 w-5" />
          </Link>
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <button className={controlClass} aria-label={locale === "ar" ? "القائمة" : "Menu"}>
                <Menu className="h-5 w-5" />
              </button>
            </SheetTrigger>
            <SheetContent
              side={locale === "ar" ? "left" : "right"}
              className="flex w-72 max-w-[calc(100vw-1rem)] flex-col overflow-hidden border-border bg-sidebar p-0"
            >
              <SheetTitle className="sr-only">{locale === "ar" ? "القائمة" : "Menu"}</SheetTitle>
              <WorkspaceNavigation {...navigationProps} drawer />
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <main
        id="main-content"
        data-app-content
        data-staff-layout={adminRoute || undefined}
        tabIndex={-1}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("a[data-pf-tab]")) haptic("tab");
        }}
        className={`min-w-0 flex-1 px-4 focus:outline-none md:px-6 lg:px-8 ${focused ? "pb-[calc(10rem+env(safe-area-inset-bottom))] md:mx-auto md:max-w-4xl" : workout?.session ? "pb-[calc(11rem+env(safe-area-inset-bottom))]" : "pb-[calc(6rem+env(safe-area-inset-bottom))]"}`}
      >
        {/* Focus mode owns one compact header inside WorkoutSession. */}
        {!focused && (
          <header
            data-app-toolbar
            data-staff-toolbar={adminRoute || undefined}
            className="-mx-4 mb-6 hidden min-h-18 items-center justify-between gap-3 border-b border-border bg-sidebar px-4 md:-mx-6 md:flex md:px-6 lg:-mx-8 lg:px-8"
          >
            <p className="min-w-0 text-sm font-semibold">
              {workspaceName(workspace, locale === "ar")}
            </p>
            <div className="flex shrink-0 items-center gap-2">
              <NotificationBell userId={user.id} className={controlClass} />
              <Link to="/profile" aria-label={t("profile")} className={controlClass}>
                <User aria-hidden className="size-5" />
              </Link>
            </div>
          </header>
        )}
        {/* Staff tables use the wider reference canvas; member reading width stays bounded. */}
        <div
          ref={pageRef}
          className={`app-page-flow mx-auto w-full ${adminRoute ? "max-w-[1440px]" : "max-w-[960px]"}`}
        >
          {data?.profile && !data.offlineAccountPrepared && (
            <p role="status" className="my-4 rounded-lg border border-gold/40 p-3 text-sm">
              {locale === "ar"
                ? "تعذر تجهيز بيانات حسابك للاستخدام دون اتصال. يمكنك الاستمرار عبر الإنترنت؛ تحقق من مساحة التخزين وإعدادات المتصفح ثم أعد تحميل التطبيق."
                : "Your account details could not be prepared for offline use. You can continue online; check device storage and browser settings, then reload the app."}
            </p>
          )}
          {adminRoute && (permissionError || !data || !data.isAdmin) ? (
            <div>
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
              <Button asChild variant="outline" className="mt-4">
                <Link to="/today">
                  {locale === "ar" ? "العودة إلى لياقتي" : "Return to My Fitness"}
                </Link>
              </Button>
            </div>
          ) : (
            <Outlet />
          )}
          <LevelUpWatcher userId={user.id} />
          <WorkoutCompletionRefresh userId={user.id} />
          <StaffOfflineRevalidation actor={user.id} />
          <AutomaticOfflinePreparation
            memberId={user.id}
            completionId={workout?.completion?.id}
            enabled={
              !!trainingFeatures?.offline &&
              data?.profile?.access_active === true &&
              data.offlineAccountPrepared
            }
          />
          <MemberSync
            userId={user.id}
            recordsEnabled={trainingFeatures?.offline === true}
            workoutsEnabled
            cardioEnabled={trainingFeatures?.cardio === true}
            settingsEnabled={data?.profile?.access_active === true}
            overview={
              path === "/profile" &&
              new URLSearchParams(location.searchStr).get("section") === "offline"
            }
            workout={workout}
          />
        </div>
      </main>

      {!focused && workout?.session && (
        <Link
          to="/train"
          className="fixed inset-x-3 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-40 flex min-h-14 items-center justify-between gap-3 rounded-xl border border-gold/60 bg-card px-4 py-3 md:inset-x-auto md:end-6 md:bottom-6 md:w-96"
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
      {!focused && <WorkspaceBottomNavigation destinations={destinations} />}
    </div>
  );
}
