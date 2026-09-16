"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, login } from "@/shared/api";
import {
  ROLE_HINT_COOKIE,
  isRole,
  portalForRole,
  setRoleHintCookie,
} from "@/shared/auth";
import type { Role } from "@/shared/config";

/**
 * Prefer BE-2 `POST /api/v1/auth/login` (HttpOnly `tc_session`).
 * If the API is unreachable, allow a documented offline role hint so portal
 * shells (and FE-2 courts mock) remain usable without a backend.
 */
export default function LoginPage() {
  const router = useRouter();
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
      const network =
        err instanceof TypeError ||
        (err instanceof ApiError && (err.status >= 500 || err.status === 404)) ||
        (err instanceof Error && /failed to fetch|network|load failed/i.test(err.message));

      if (network) {
        // Offline fallback: set `tc_role` only — no `tc_session`.
        setRoleHintCookie(offlineRole);
        router.replace(portalForRole(offlineRole));
        router.refresh();
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
              Used only when the API is unreachable; sets `{ROLE_HINT_COOKIE}` stub. Prefer real
              login when BE-2 is running.
            </p>
          </div>
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
