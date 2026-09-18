"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, useLogoutMutation } from "@/shared/api";
import { ROUTES } from "@/shared/config";

export function LogoutButton() {
  const router = useRouter();
  const logoutMutation = useLogoutMutation();
  const [error, setError] = useState<string | null>(null);
  const busy = logoutMutation.isPending;

  async function onLogout() {
    setError(null);
    try {
      await logoutMutation.mutateAsync();
      router.replace(ROUTES.login);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : "Couldn't log out. Try again.");
    }
  }

  return (
    <span className="ml-auto flex items-center gap-2">
      {error && (
        <span className="text-xs text-red-100 max-w-[16rem]" role="alert">
          {error}
        </span>
      )}
      <button
        type="button"
        onClick={() => void onLogout()}
        disabled={busy}
        aria-busy={busy}
        className="px-3 py-2 rounded text-sm font-medium text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-50 transition-colors"
      >
        {busy ? "Logging out…" : "Logout"}
      </button>
    </span>
  );
}
