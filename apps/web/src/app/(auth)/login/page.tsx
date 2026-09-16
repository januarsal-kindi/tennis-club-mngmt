"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, login } from "@/shared/api";
import {
  ROLE_HINT_COOKIE,
  allowOfflineAuth,
  isRole,
  portalForRole,
  setRoleHintCookie,
} from "@/shared/auth";
import type { Role } from "@/shared/config";

/**
 * Prefer BE-2 `POST /api/v1/auth/login` (HttpOnly `tc_session`).
 * Offline role hint (`tc_role`) is gated: NODE_ENV !== production or
 * NEXT_PUBLIC_ALLOW_OFFLINE_AUTH=true. Never treat 401/403 as offline success.
 */
export default function LoginPage() {
  const router = useRouter();
  const offlineOk = allowOfflineAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [offlineRole, setOfflineRole] = useState<Role>("admin");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const user = await login(email, password);
      router.replace(portalForRole(user.role));
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        setError(err.message || "Invalid email or password");
        return;
      }

      const network =
        err instanceof TypeError ||
        (err instanceof ApiError && (err.status >= 500 || err.status === 404)) ||
        (err instanceof Error && /failed to fetch|network|load failed/i.test(err.message));

      if (network && offlineOk) {
        // Local-demo only: set `tc_role` hint — no `tc_session`.
        setRoleHintCookie(offlineRole);
        router.replace(portalForRole(offlineRole));
        router.refresh();
        return;
      }

      if (network) {
        setError("Sign-in service unavailable. Try again when the API is up.");
        return;
      }

      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-green-700">
      <div className="bg-white rounded-2xl shadow-xl p-10 w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold text-green-800">Tennis Club</h1>
          <p className="text-sm text-gray-500">Sign in to your portal</p>
        </div>
        <form className="space-y-4" onSubmit={(e) => void onSubmit(e)}>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          {offlineOk && (
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700" htmlFor="offlineRole">
                Offline role (API down only)
              </label>
              <select
                id="offlineRole"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                value={offlineRole}
                onChange={(e) => {
                  const v = e.target.value;
                  if (isRole(v)) setOfflineRole(v);
                }}
              >
                <option value="admin">admin</option>
                <option value="member">member</option>
                <option value="coach">coach</option>
              </select>
              <p className="text-xs text-gray-400">
                Local demo only (`{ROLE_HINT_COOKIE}`). Disabled in production unless
                NEXT_PUBLIC_ALLOW_OFFLINE_AUTH=true. Never used on 401/403.
              </p>
            </div>
          )}
          {error && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="w-full bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white font-semibold rounded-lg py-2 text-sm transition-colors"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="text-center text-xs text-gray-400">
          Admins and members/coaches are redirected to their portal automatically.
        </p>
      </div>
    </main>
  );
}
