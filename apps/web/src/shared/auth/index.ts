import type { Role } from "@/shared/config";

/** Cookie name holding the session role (stub — replace with real auth). */
export const SESSION_COOKIE = "tc_role";

export function portalForRole(role: Role): "/admin/dashboard" | "/customer/dashboard" {
  return role === "admin" ? "/admin/dashboard" : "/customer/dashboard";
}
