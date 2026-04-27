import { NextRequest, NextResponse } from "next/server";

import { AUTH_COOKIE_NAME } from "@/lib/authCookie";

function isProtectedPath(pathname: string): boolean {
  return (
    pathname === "/me" ||
    pathname.startsWith("/me/") ||
    pathname.startsWith("/pose") ||
    pathname.startsWith("/pose-2d")
  );
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (!isProtectedPath(pathname)) {
    return NextResponse.next();
  }

  const hasSessionCookie = Boolean(request.cookies.get(AUTH_COOKIE_NAME)?.value);
  if (hasSessionCookie) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/auth/login", request.url);
  loginUrl.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/me/:path*", "/pose/:path*", "/pose-2d/:path*"],
};
