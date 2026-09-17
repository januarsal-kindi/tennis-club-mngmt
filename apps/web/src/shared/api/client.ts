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

/** Probe result for GET /courts — never treat 5xx as "use mock". */
export type CourtsProbe = "live" | "missing" | "error";

export async function probeCourtsRoute(): Promise<CourtsProbe> {
  try {
    await http.get("/courts");
    return "live";
  } catch (err) {
    if (err instanceof ApiError) {
      // 2xx handled above; 401 / 403 → courts router is present.
      if (err.status === 401 || err.status === 403) return "live";
      // 404 → route not mounted yet.
      if (err.status === 404) return "missing";
      // 5xx / other → fail closed (caller must not sticky-mock).
      return "error";
    }
    return "error";
  }
}
