import { Link } from "@tanstack/react-router";
import {
  Apple,
  BadgeCheck,
  CalendarRange,
  ChevronDown,
  Dumbbell,
  Gift,
  Globe,
  Home,
  LineChart,
  LogOut,
  Mail,
  Target,
  User,
  Users,
  UsersRound,
} from "lucide-react";
import { BrandLockup } from "@/components/brand-lockup";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useI18n, type TKey } from "@/lib/i18n";
import { haptic } from "@/lib/device-feedback";
import { useCelebration } from "@/lib/celebrate";

/** Gold dot on Rewards after a new badge, until Rewards is opened. */
function NewDot({ to }: { to: WorkspaceDestination }) {
  const { rewardsNew } = useCelebration();
  const { locale } = useI18n();
  if (to !== "/rewards" || !rewardsNew) return null;
  return (
    <span
      className="absolute -top-1 -end-1.5 size-2.5 rounded-full bg-gold ring-2 ring-sidebar"
      role="img"
      aria-label={locale === "ar" ? "وسام جديد" : "New badge"}
    />
  );
}
import { workspaceName, type Workspace, type WorkspaceDestination } from "./workspace";

const entries: Record<WorkspaceDestination, { key: TKey; icon: typeof Home }> = {
  "/today": { key: "today", icon: Home },
  "/train": { key: "train", icon: Dumbbell },
  "/nutrition": { key: "nutrition", icon: Apple },
  "/progress": { key: "progress", icon: LineChart },
  "/rewards": { key: "rewards", icon: Gift },
  "/members": { key: "myMembers", icon: UsersRound },
  "/admin/analytics": { key: "analytics", icon: LineChart },
  "/admin/members": { key: "members", icon: Users },
  "/admin/programs": { key: "programs", icon: CalendarRange },
  "/admin/exercises": { key: "exercises", icon: Dumbbell },
  "/admin/pods": { key: "pods", icon: UsersRound },
  "/admin/pv": { key: "pvApprovals", icon: BadgeCheck },
  "/admin/shop": { key: "rewardsAdmin", icon: Gift },
  "/admin/invites": { key: "invites", icon: Mail },
  "/admin/targets": { key: "targets", icon: Target },
};

/** Sidebar and phone drawer render the same ordered destinations and footer.
 * Only their sizing changes. Selection is route-owned, including blocked navigation. */
export function WorkspaceNavigation({
  workspace,
  destinations,
  canSwitch,
  onSwitch,
  onClose,
  onSignOut,
  drawer = false,
}: {
  workspace: Workspace;
  destinations: readonly WorkspaceDestination[];
  canSwitch: boolean;
  onSwitch: (workspace: Workspace) => void;
  onClose: () => void;
  onSignOut: () => void;
  drawer?: boolean;
}) {
  const { t, locale, setLocale } = useI18n();
  const ar = locale === "ar";
  const rail = drawer
    ? ""
    : "md:flex-col md:justify-center md:gap-1 md:px-1 md:text-center md:text-[11px] lg:flex-row lg:justify-start lg:gap-3 lg:px-3 lg:text-start lg:text-sm";
  // The active selector has higher specificity than muted/hover text utilities.
  const link = `flex min-h-11 min-w-0 items-center gap-3 rounded-lg border border-transparent px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground [&.active]:border-gold/50 [&.active]:bg-raised [&.active]:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold ${rail}`;
  const Icon = workspace === "fitness" ? Home : UsersRound;
  return (
    <>
      <div className="flex min-h-18 shrink-0 items-center border-b border-border px-4">
        <BrandLockup rail={!drawer} />
      </div>
      <div className="shrink-0 border-b border-border p-3" data-workspace-switcher>
        {canSwitch ? (
          <DropdownMenu dir={ar ? "rtl" : "ltr"}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={`${ar ? "مساحة العمل" : "Workspace"}: ${workspaceName(workspace, ar)}`}
                title={workspaceName(workspace, ar)}
                className={`flex min-h-12 w-full min-w-0 items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-start text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold ${drawer ? "" : "md:justify-center md:px-1 lg:justify-start lg:px-3"}`}
              >
                <Icon aria-hidden className="size-4 shrink-0 text-gold" />
                <span className={drawer ? "min-w-0 flex-1" : "min-w-0 flex-1 md:hidden lg:block"}>
                  {workspaceName(workspace, ar)}
                </span>
                <ChevronDown aria-hidden className="size-3 shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-52">
              <DropdownMenuRadioGroup
                value={workspace}
                onValueChange={(value) => {
                  if (value !== workspace) onSwitch(value as Workspace);
                }}
              >
                {(["fitness", "staff"] as const).map((value) => (
                  <DropdownMenuRadioItem key={value} value={value} className="min-h-11">
                    {workspaceName(value, ar)}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <p
            className={`flex min-h-12 items-center gap-2 text-sm font-semibold ${drawer ? "" : "md:justify-center lg:justify-start"}`}
          >
            <Icon aria-hidden className="size-4 shrink-0 text-gold" />
            <span className={drawer ? "" : "md:hidden lg:inline"}>
              {workspaceName(workspace, ar)}
            </span>
          </p>
        )}
      </div>
      <nav
        aria-label={ar ? "مساحات التطبيق" : "App workspaces"}
        data-workspace-navigation={workspace}
        className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-2 py-4"
      >
        {destinations.map((to) => {
          const { key, icon: EntryIcon } = entries[to];
          return (
            <Link
              key={to}
              to={to}
              className={link}
              activeOptions={{ exact: to === "/members" ? false : true }}
              activeProps={{ className: "active" }}
              onClick={() => {
                haptic("tab");
                onClose();
              }}
            >
              <span className="relative">
                <EntryIcon aria-hidden className="size-4 shrink-0" />
                <NewDot to={to} />
              </span>
              {to === "/admin/analytics" ? (ar ? "لوحة التحكم" : "Dashboard") : t(key)}
            </Link>
          );
        })}
      </nav>
      <div
        className="mt-auto flex shrink-0 flex-col gap-1 border-t border-border p-2"
        data-workspace-utilities
      >
        <Link
          to="/profile"
          className={link}
          onClick={onClose}
          activeProps={{ className: "active" }}
        >
          <User aria-hidden className="size-4 shrink-0" />
          {ar ? "الملف والإعدادات" : "Profile & settings"}
        </Link>
        <button
          className={link}
          onClick={() => {
            setLocale(ar ? "en" : "ar");
            onClose();
          }}
        >
          <Globe aria-hidden className="size-4 shrink-0" />
          {ar ? "English" : "العربية"}
        </button>
        <button
          className={link}
          onClick={() => {
            onClose();
            onSignOut();
          }}
        >
          <LogOut aria-hidden className="size-4 shrink-0" />
          {t("signOut")}
        </button>
      </div>
    </>
  );
}

/** Phone shortcuts are the first destinations of the selected workspace. The
 * full drawer retains the complete order, so staff never see member-only tabs here. */
export function WorkspaceBottomNavigation({
  destinations,
}: {
  destinations: readonly WorkspaceDestination[];
}) {
  const { t, locale } = useI18n();
  return (
    <nav
      aria-label={locale === "ar" ? "التنقل الرئيسي" : "Primary navigation"}
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      className="fixed inset-x-0 bottom-0 z-40 grid auto-cols-fr grid-flow-col border-t border-border bg-sidebar md:hidden"
    >
      {destinations.slice(0, 5).map((to) => {
        const { key, icon: Icon } = entries[to];
        return (
          <Link
            key={to}
            to={to}
            onClick={() => haptic("tab")}
            className="flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 px-1 py-2 text-center text-[11px] leading-tight text-muted-foreground [&.active]:bg-accent/40 [&.active]:text-gold focus-visible:ring-2 focus-visible:ring-gold"
            activeOptions={{ exact: true }}
            activeProps={{ className: "active" }}
          >
            <span className="relative">
              <Icon aria-hidden className="size-5" />
              <NewDot to={to} />
            </span>
            {to === "/admin/analytics" ? (locale === "ar" ? "لوحة التحكم" : "Dashboard") : t(key)}
          </Link>
        );
      })}
    </nav>
  );
}
