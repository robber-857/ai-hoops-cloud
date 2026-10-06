import { describe, it, expect } from "vitest";
import { canRoleOpenPath, resolveLoginRedirect } from "../authRedirect";

describe("role workspace boundaries", () => {
  it.each(["admin", "coach"])("keeps %s out of student pages including deep links", role => {
    for (const path of ["/me", "/me/profile", "/me/reports?page=2"]) {
      expect(canRoleOpenPath(role, path)).toBe(false);
      expect(resolveLoginRedirect(role, path)).toBe(`/${role}`);
    }
  });
  it.each(["student", "user"])("keeps %s in the student workspace", role => {
    expect(canRoleOpenPath(role, "/me/profile")).toBe(true);
    expect(canRoleOpenPath(role, "/coach/students/example")).toBe(false);
    expect(canRoleOpenPath(role, "/admin/users")).toBe(false);
  });
  it("allows admins to review players in the coach workspace", () => {
    expect(canRoleOpenPath("admin", "/coach/students/example")).toBe(true);
    expect(canRoleOpenPath("coach", "/admin/users")).toBe(false);
  });
});
