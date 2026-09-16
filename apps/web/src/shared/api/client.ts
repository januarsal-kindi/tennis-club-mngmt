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

/** Probe result for GET /courts — never treat 5xx as "use mock". */
export type CourtsProbe = "live" | "missing" | "error";

export async function probeCourtsRoute(): Promise<CourtsProbe> {
  try {
    const res = await fetch(`${BASE}/courts`, {
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    // 2xx / 401 / 403 → courts router is present.
    if (res.ok || res.status === 401 || res.status === 403) return "live";
    // 404 → route not mounted yet.
    if (res.status === 404) return "missing";
    // 5xx / other → fail closed (caller must not sticky-mock).
    return "error";
  } catch {
    return "error";
  }
}

/** @deprecated use probeCourtsRoute */
export async function courtsRouteExists(): Promise<boolean> {
  return (await probeCourtsRoute()) === "live";
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
