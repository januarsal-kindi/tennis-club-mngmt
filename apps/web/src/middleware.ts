import { NextRequest, NextResponse } from "next/server";
import {
  ROLE_HINT_COOKIE,
  SESSION_COOKIE,
  isRole,
  portalForRole,
} from "@/shared/auth";
import type { Role } from "@/shared/config";

const PUBLIC_PATHS = ["/login"];
const API_ORIGIN = process.env.API_ORIGIN ?? "http://localhost:3001";

async function resolveRole(req: NextRequest): Promise<Role | null> {
  const session = req.cookies.get(SESSION_COOKIE)?.value;
  if (session) {
    try {
      const res = await fetch(`${API_ORIGIN}/api/v1/me`, {
        headers: {
          Accept: "application/json",
          Cookie: `${SESSION_COOKIE}=${encodeURIComponent(session)}`,
        },
        cache: "no-store",
      });
      if (res.ok) {
        const body: unknown = await res.json();
        if (body && typeof body === "object" && "role" in body && isRole((body as { role: unknown }).role)) {
          return (body as { role: Role }).role;
        }
      }
    } catch {
      // API unreachable — fall through to role hint.
    }
  }

  // Offline / API-down fallback (documented): FE-1 `tc_role` hint only.
  const hint = req.cookies.get(ROLE_HINT_COOKIE)?.value;
  return isRole(hint) ? hint : null;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Skip API proxy paths (rewrites handled by Next; no portal gate).
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const role = await resolveRole(req);

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
