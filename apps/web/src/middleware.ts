import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, portalForRole } from "@/shared/auth";
import type { Role } from "@/shared/config";

const PUBLIC_PATHS = ["/login"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const role = req.cookies.get(SESSION_COOKIE)?.value as Role | undefined;

  if (!role) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (pathname === "/" || pathname === "") {
    return NextResponse.redirect(new URL(portalForRole(role), req.url));
  }

  if (pathname.startsWith("/admin") && role !== "admin") {
    return NextResponse.redirect(new URL(portalForRole(role), req.url));
  }

  if (pathname.startsWith("/customer") && role === "admin") {
    return NextResponse.redirect(new URL("/admin/dashboard", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
