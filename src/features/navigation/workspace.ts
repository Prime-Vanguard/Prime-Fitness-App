export type Workspace = "fitness" | "staff";

export function workspaceName(workspace: Workspace, ar: boolean) {
  return workspace === "fitness"
    ? ar
      ? "لياقتي"
      : "My Fitness"
    : ar
      ? "مساحة عمل الفريق"
      : "Staff Workspace";
}

/** URL destinations identify a workspace. Profile is deliberately shared, so
 * opening settings does not silently replace the navigation the member was using. */
export function routeWorkspace(path: string): Workspace | null {
  if (path === "/profile") return null;
  return path === "/members" ||
    path.startsWith("/members/") ||
    path === "/admin" ||
    path.startsWith("/admin/")
    ? "staff"
    : "fitness";
}

export function staffAccess(roles: readonly string[], active: boolean) {
  const admin = active && (roles.includes("admin") || roles.includes("super_admin"));
  return {
    admin,
    staff: active && (admin || roles.includes("coach") || roles.includes("pod_leader")),
  };
}

export const fitnessDestinations = [
  "/today",
  "/train",
  "/nutrition",
  "/progress",
  "/rewards",
] as const;
export const adminDestinations = [
  "/admin/analytics",
  "/admin/members",
  "/admin/programs",
  "/admin/exercises",
  "/admin/pods",
  "/admin/pv",
  "/admin/shop",
  "/admin/invites",
  "/admin/targets",
] as const;
export type WorkspaceDestination =
  (typeof fitnessDestinations)[number] | (typeof adminDestinations)[number] | "/members";

/** A menu is a presentation of existing permissions, never an authorization grant. */
export function workspaceDestinations(
  workspace: Workspace,
  access: ReturnType<typeof staffAccess>,
): readonly WorkspaceDestination[] {
  if (workspace === "fitness") return fitnessDestinations;
  if (!access.staff) return [];
  return access.admin ? [...adminDestinations, "/members"] : ["/members"];
}

export function workspaceHome(workspace: Workspace, admin: boolean): WorkspaceDestination {
  return workspace === "fitness" ? "/today" : admin ? "/admin/analytics" : "/members";
}
