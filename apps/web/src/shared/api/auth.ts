import type { Role } from "@/shared/config";
import { clearRoleHintCookie, isRole, setRoleHintCookie } from "@/shared/auth";
import { apiFetch } from "./client";

export type PublicUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  createdAt: string;
};

function asPublicUser(data: unknown): PublicUser {
  if (!data || typeof data !== "object") {
    throw new Error("Invalid user response");
  }
  const u = data as Record<string, unknown>;
  if (
    typeof u.id !== "string" ||
    typeof u.email !== "string" ||
    typeof u.name !== "string" ||
    !isRole(u.role) ||
    typeof u.createdAt !== "string"
  ) {
    throw new Error("Invalid user response");
  }
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    createdAt: u.createdAt,
  };
}

/** POST /api/v1/auth/login — sets HttpOnly `tc_session`; also writes role hint for middleware. */
export async function login(email: string, password: string): Promise<PublicUser> {
  const user = asPublicUser(
    await apiFetch<unknown>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  );
  setRoleHintCookie(user.role);
  return user;
}

/** POST /api/v1/auth/logout — clears `tc_session` and role hint. */
export async function logout(): Promise<void> {
  try {
    await apiFetch<void>("/auth/logout", { method: "POST" });
  } finally {
    clearRoleHintCookie();
  }
}

/** GET /api/v1/me — current user from session cookie. */
export async function getMe(): Promise<PublicUser> {
  const user = asPublicUser(await apiFetch<unknown>("/me"));
  setRoleHintCookie(user.role);
  return user;
}
