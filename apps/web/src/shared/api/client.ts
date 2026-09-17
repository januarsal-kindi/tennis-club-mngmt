import axios, { isAxiosError } from "axios";

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

/** Browser axios instance — sends `tc_session` via cookies. */
export const http = axios.create({
  baseURL: BASE,
  withCredentials: true,
  headers: { Accept: "application/json" },
});

http.interceptors.response.use(
  (res) => res,
  (err: unknown) => Promise.reject(toApiError(err)),
);

function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  if (isAxiosError(err)) {
    const status = err.response?.status ?? 0;
    const body: unknown = err.response?.data;
    const code =
      body && typeof body === "object" && "code" in body && typeof (body as { code: unknown }).code === "string"
        ? (body as { code: string }).code
        : "UNKNOWN";
    const message =
      body && typeof body === "object" && "message" in body && typeof (body as { message: unknown }).message === "string"
        ? (body as { message: string }).message
        : err.message || err.response?.statusText || `HTTP ${status}`;
    return new ApiError(status, code, message);
  }
  return new ApiError(0, "UNKNOWN", err instanceof Error ? err.message : "Request failed");
}

/** Probe result — never treat 5xx as "use mock". */
export type RouteProbe = "live" | "missing" | "error";
export type CourtsProbe = RouteProbe;

/**
 * GET a route to see if the backend mounted it.
 * 2xx / 400 (validation) / 401 / 403 → live. 404 → missing. 5xx/network → error.
 */
export async function probeRoute(path: string): Promise<RouteProbe> {
  try {
    await http.get(path);
    return "live";
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 400 || err.status === 401 || err.status === 403) return "live";
      if (err.status === 404) return "missing";
      return "error";
    }
    return "error";
  }
}

export async function probeCourtsRoute(): Promise<CourtsProbe> {
  return probeRoute("/courts");
}
