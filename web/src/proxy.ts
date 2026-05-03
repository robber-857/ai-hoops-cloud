import { NextResponse } from "next/server";

export function proxy() {
  return NextResponse.next();
}

export const config = {
  matcher: ["/me/:path*", "/pose/:path*", "/pose-2d/:path*"],
};
