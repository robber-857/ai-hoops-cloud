import { routes } from "@/lib/routes";
import type { AuthUser } from "@/types/auth";

export type AuthRole = AuthUser["role"];

const authRoles: AuthRole[] = ["admin", "coach", "student", "user"];

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

  if (normalizedRole === "admin") {
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

  if (normalizedRole === "admin") {
    return routes.admin.home;
  }
  if (normalizedRole === "coach") {
    return routes.coach.home;
  }
  return routes.user.me;
}

function isCrossRoleWorkspaceRoot(role: AuthRole, path: string) {
  const pathname = getPathname(path);

  if (
    pathname !== routes.admin.home &&
    pathname !== routes.coach.home &&
    pathname !== routes.user.me
  ) {
    return false;
  }

  return pathname !== getDefaultPathForRole(role);
}

export function resolveLoginRedirect(role: string, nextPath: string | null) {
  const normalizedRole = normalizeAuthRole(role);

  if (
    isSafeLocalPath(nextPath) &&
    nextPath &&
    canRoleOpenPath(normalizedRole, nextPath) &&
    !isCrossRoleWorkspaceRoot(normalizedRole, nextPath)
  ) {
    return nextPath;
  }

  return getDefaultPathForRole(normalizedRole);
}
