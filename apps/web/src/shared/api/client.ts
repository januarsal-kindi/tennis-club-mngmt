const BASE = "/api/v1";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const body = text ? safeJson(text) : undefined;

  if (!res.ok) {
    const code =
      body && typeof body === "object" && "code" in body && typeof body.code === "string"
        ? body.code
        : "UNKNOWN";
    const message =
      body && typeof body === "object" && "message" in body && typeof body.message === "string"
        ? body.message
        : res.statusText || `HTTP ${res.status}`;
    throw new ApiError(res.status, code, message);
  }

  return body as T;
}

/** True when GET /courts is a real courts route (auth errors still count as live). */
export async function courtsRouteExists(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/courts`, { credentials: "include", headers: { Accept: "application/json" } });
    // 2xx / 401 / 403 → courts router is present. 404 or proxy/5xx → use mock.
    return res.ok || res.status === 401 || res.status === 403;
  } catch {
    return false;
  }
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
