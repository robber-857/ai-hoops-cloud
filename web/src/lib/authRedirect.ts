import { routes } from "@/lib/routes";
import type { AuthUser } from "@/types/auth";

export type AuthRole = AuthUser["role"];

const authRoles: AuthRole[] = ["super_admin", "admin", "coach", "student", "user"];

export function isAdminRole(role: string | null | undefined): boolean {
  return role === "admin" || role === "super_admin";
}

function isKnownAuthRole(value: string): value is AuthRole {
  return authRoles.includes(value as AuthRole);
}

export function normalizeAuthRole(role: string | null | undefined): AuthRole {
  const normalized = String(role ?? "")
    .trim()
    .toLowerCase()
    .split(".")
    .pop();

  if (normalized && isKnownAuthRole(normalized)) {
    return normalized;
  }

  return "user";
}

function isSafeLocalPath(path: string | null) {
  return Boolean(path && path.startsWith("/") && !path.startsWith("//"));
}

function isPathWithin(pathname: string, basePath: string) {
  return pathname === basePath || pathname.startsWith(`${basePath}/`);
}

function getPathname(path: string) {
  try {
    return new URL(path, "http://localhost").pathname;
  } catch {
    return path;
  }
}

export function canRoleOpenPath(role: string, path: string) {
  const normalizedRole = normalizeAuthRole(role);
  const pathname = getPathname(path);

  if (isPathWithin(pathname, routes.user.me)) {
    return normalizedRole === "student" || normalizedRole === "user";
  }

  if (isAdminRole(normalizedRole)) {
    return true;
  }

  if (normalizedRole === "coach") {
    return !isPathWithin(pathname, routes.admin.home);
  }

  return (
    !isPathWithin(pathname, routes.admin.home) &&
    !isPathWithin(pathname, routes.coach.home)
  );
}

export function getDefaultPathForRole(role: string) {
  const normalizedRole = normalizeAuthRole(role);

  if (isAdminRole(normalizedRole)) {
    return routes.admin.home;
  }
  if (normalizedRole === "coach") {
    return routes.coach.home;
  }
  return routes.user.me;
}

function isCrossRoleWorkspacePath(role: AuthRole, path: string) {
  const pathname = getPathname(path);

  const workspaceRoot = [routes.admin.home, routes.coach.home, routes.user.me].find((root) =>
    isPathWithin(pathname, root),
  );

  if (!workspaceRoot) {
    return false;
  }

  return workspaceRoot !== getDefaultPathForRole(role);
}

export function resolveLoginRedirect(role: string, nextPath: string | null) {
  const normalizedRole = normalizeAuthRole(role);

  if (
    isSafeLocalPath(nextPath) &&
    nextPath &&
    canRoleOpenPath(normalizedRole, nextPath) &&
    !isCrossRoleWorkspacePath(normalizedRole, nextPath)
  ) {
    return nextPath;
  }

  return getDefaultPathForRole(normalizedRole);
}
