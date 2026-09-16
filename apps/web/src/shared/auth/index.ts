import type { Role } from "@/shared/config";

/** HttpOnly session cookie set by BE-2 `POST /api/v1/auth/login`. */
export const SESSION_COOKIE = "tc_session";

/**
 * Non-HttpOnly role hint for Next middleware portal routing when `/me` is
 * unreachable (API down / offline UI). Not a security boundary — API auth is
 * `tc_session`. Prefer real session + GET /me whenever the API is up.
 */
export const ROLE_HINT_COOKIE = "tc_role";

const ROLES: Role[] = ["admin", "coach", "member"];

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as string[]).includes(value);
}

export function portalForRole(role: Role): "/admin/dashboard" | "/customer/dashboard" {
  return role === "admin" ? "/admin/dashboard" : "/customer/dashboard";
}

/** Browser-only: set/clear the role hint cookie (max-age 7 days, mirrors session TTL). */
export function setRoleHintCookie(role: Role): void {
  if (typeof document === "undefined") return;
  document.cookie = `${ROLE_HINT_COOKIE}=${role}; Path=/; Max-Age=${7 * 24 * 60 * 60}; SameSite=Lax`;
}

export function clearRoleHintCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${ROLE_HINT_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}
