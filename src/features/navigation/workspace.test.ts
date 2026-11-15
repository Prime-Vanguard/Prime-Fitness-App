import { describe, expect, it } from "vitest";
import {
  adminDestinations,
  fitnessDestinations,
  routeWorkspace,
  staffAccess,
  workspaceDestinations,
  workspaceHome,
} from "./workspace";

describe("workspace navigation boundaries", () => {
  it("keeps member destinations fixed while shared settings retain their origin", () => {
    expect(routeWorkspace("/profile")).toBeNull();
    expect(routeWorkspace("/train")).toBe("fitness");
    expect(routeWorkspace("/admin/members")).toBe("staff");
    expect(routeWorkspace("/members/member-id")).toBe("staff");
    expect(workspaceDestinations("fitness", staffAccess(["admin", "coach"], true))).toEqual(
      fitnessDestinations,
    );
  });
  it("gives admins one fixed staff order and keeps coaching access available", () => {
    expect(workspaceDestinations("staff", staffAccess(["super_admin"], true))).toEqual([
      ...adminDestinations,
      "/members",
    ]);
    expect(workspaceHome("staff", true)).toBe("/admin/analytics");
  });
  it.each(["coach", "pod_leader"])("shows only existing member-management access to %s", (role) => {
    expect(workspaceDestinations("staff", staffAccess([role], true))).toEqual(["/members"]);
    expect(workspaceHome("staff", false)).toBe("/members");
  });
  it("cannot turn a workspace preference into staff access or bypass a pause", () => {
    expect(workspaceDestinations("staff", staffAccess(["member"], true))).toEqual([]);
    expect(
      workspaceDestinations("staff", staffAccess(["admin", "coach", "pod_leader"], false)),
    ).toEqual([]);
  });
});
