import { allowOfflineAuth } from "@/shared/auth";
import { ApiError, apiFetch, probeCourtsRoute } from "./client";

/** 0 = Sunday … 6 = Saturday (matches JS `Date.getDay` / Prisma `weekStart`). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type WeeklyHour = {
  weekday: Weekday;
  startLocal: string;
  endLocal: string;
};

export type Blackout = {
  id: string;
  courtId: string;
  start: string;
  end: string;
  reason?: string | null;
};

export type Court = {
  id: string;
  name: string;
  active: boolean;
  warning?: string;
};

export const WEEKDAY_ORDER: Weekday[] = [1, 2, 3, 4, 5, 6, 0];
export const WEEKDAY_LABEL: Record<Weekday, string> = {
  0: "Sunday",
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
};

export type CourtsSource = "live" | "mock";

const MOCK_KEY = "tc_fe2_courts_mock";

type MockDb = {
  courts: Court[];
  hours: Record<string, WeeklyHour[]>;
  blackouts: Record<string, Blackout[]>;
};

let source: CourtsSource | null = null;

export function courtsApiSource(): CourtsSource | null {
  return source;
}

/**
 * Resolve live vs mock once.
 * - live sticks: never silent-fallback to localStorage after /courts exists
 * - mock only when route missing AND offline/demo auth gate allows it
 * - 5xx / network → throw (fail closed)
 */
export async function resolveCourtsApiSource(): Promise<CourtsSource> {
  if (source === "live") return "live";
  if (source === "mock") return "mock";

  const probe = await probeCourtsRoute();
  if (probe === "live") {
    source = "live";
    return "live";
  }
  if (probe === "missing" && allowOfflineAuth()) {
    source = "mock";
    return "mock";
  }
  if (probe === "missing") {
    throw new Error("Courts API is not available (mock disabled outside local demo).");
  }
  throw new Error("Courts API unavailable (fail closed on 5xx/network).");
}

/** Safari `<input type="time">` may yield `HH:mm:ss` — contract wants `HH:mm`. */
export function toHHmm(value: string): string {
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?/.exec(value.trim());
  if (!m) return value.trim();
  const hh = m[1].padStart(2, "0");
  return `${hh}:${m[2]}`;
}

export function normalizeWeeklyHours(hours: WeeklyHour[]): WeeklyHour[] {
  return hours.map((h) => ({
    ...h,
    startLocal: toHHmm(h.startLocal),
    endLocal: toHHmm(h.endLocal),
  }));
}

export async function listCourts(): Promise<Court[]> {
  if ((await resolveCourtsApiSource()) === "live") {
    return asList<Court>(await apiFetch<unknown>("/courts"), "courts");
  }
  return readMock().courts;
}

export async function createCourt(input: { name: string; active?: boolean }): Promise<Court> {
  const name = input.name.trim();
  if ((await resolveCourtsApiSource()) === "live") {
    return apiFetch<Court>("/courts", {
      method: "POST",
      body: JSON.stringify({ name, active: input.active ?? true }),
    });
  }
  const db = readMock();
  const court: Court = { id: crypto.randomUUID(), name, active: input.active ?? true };
  db.courts.push(court);
  db.hours[court.id] = [];
  db.blackouts[court.id] = [];
  writeMock(db);
  return court;
}

export async function updateCourt(id: string, input: { name?: string; active?: boolean }): Promise<Court> {
  if ((await resolveCourtsApiSource()) === "live") {
    return apiFetch<Court>(`/courts/${id}`, { method: "PATCH", body: JSON.stringify(input) });
  }
  const db = readMock();
  const court = db.courts.find((c) => c.id === id);
  if (!court) throw new Error("Court not found");
  if (input.name !== undefined) court.name = input.name.trim();
  if (input.active !== undefined) court.active = input.active;
  writeMock(db);
  return court;
}

export async function getWeeklyHours(courtId: string): Promise<WeeklyHour[]> {
  if ((await resolveCourtsApiSource()) === "live") {
    // 404 = missing court (NOT empty hours). Empty hours are 200 `{ hours: [] }`.
    return asList<WeeklyHour>(await apiFetch<unknown>(`/courts/${courtId}/weekly-hours`), "hours");
  }
  return readMock().hours[courtId] ?? [];
}

export async function putWeeklyHours(courtId: string, hours: WeeklyHour[]): Promise<WeeklyHour[]> {
  const normalized = normalizeWeeklyHours(hours);
  if ((await resolveCourtsApiSource()) === "live") {
    // Architecture: PUT /courts/:id/weekly-hours — body is the full week replacement (raw array OK).
    return asList<WeeklyHour>(
      await apiFetch<unknown>(`/courts/${courtId}/weekly-hours`, {
        method: "PUT",
        body: JSON.stringify(normalized),
      }),
      "hours",
    );
  }
  const db = readMock();
  db.hours[courtId] = normalized;
  writeMock(db);
  return normalized;
}

export async function listBlackouts(courtId: string): Promise<Blackout[]> {
  if ((await resolveCourtsApiSource()) === "live") {
    // 404 = missing court; empty list is 200.
    return asList<Blackout>(await apiFetch<unknown>(`/courts/${courtId}/blackouts`), "blackouts");
  }
  return readMock().blackouts[courtId] ?? [];
}

export async function createBlackout(
  courtId: string,
  input: { start: string; end: string; reason?: string },
): Promise<Blackout> {
  if ((await resolveCourtsApiSource()) === "live") {
    return apiFetch<Blackout>(`/courts/${courtId}/blackouts`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  }
  const db = readMock();
  const blackout: Blackout = {
    id: crypto.randomUUID(),
    courtId,
    start: input.start,
    end: input.end,
    reason: input.reason,
  };
  db.blackouts[courtId] = [...(db.blackouts[courtId] ?? []), blackout];
  writeMock(db);
  return blackout;
}

export async function deleteBlackout(courtId: string, blackoutId: string): Promise<void> {
  if ((await resolveCourtsApiSource()) === "live") {
    await apiFetch<void>(`/courts/${courtId}/blackouts/${blackoutId}`, { method: "DELETE" });
    return;
  }
  const db = readMock();
  db.blackouts[courtId] = (db.blackouts[courtId] ?? []).filter((b) => b.id !== blackoutId);
  writeMock(db);
}

/**
 * A11 stub: always warn before deactivating.
 * TODO(BE-4/BE-5): replace with a future-holds count when occupancy/booking APIs exist.
 */
export async function courtMayHaveFutureHolds(courtId: string): Promise<boolean> {
  void courtId;
  return true;
}

function addOneCalendarDay(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + 1);
  return dt.toISOString().slice(0, 10);
}

/**
 * Half-open all-day blackout bounds as ISO-8601 at UTC midnight of calendar dates.
 * Uses Date.UTC only (no browser local TZ). Prefer club-TZ conversion via club-settings when wired.
 */
export function allDayRange(startDate: string, endDateInclusive: string): { start: string; end: string } {
  return {
    start: `${startDate}T00:00:00.000Z`,
    end: `${addOneCalendarDay(endDateInclusive)}T00:00:00.000Z`,
  };
}

export function blackoutDateLabel(iso: string): string {
  return iso.slice(0, 10);
}

/** Half-open `end` at midnight displays as the previous inclusive date. */
export function blackoutInclusiveEnd(start: string, end: string): string {
  const startDay = start.slice(0, 10);
  const time = end.slice(11, 19);
  if (time === "00:00:00" || time === "") {
    const endDay = end.slice(0, 10);
    const [y, m, d] = endDay.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() - 1);
    const label = dt.toISOString().slice(0, 10);
    return label < startDay ? startDay : label;
  }
  return end.slice(0, 10);
}

function asList<T>(data: unknown, key: string): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object" && key in data) {
    const nested = (data as Record<string, unknown>)[key];
    if (Array.isArray(nested)) return nested as T[];
  }
  return [];
}

function emptyDb(): MockDb {
  return { courts: [], hours: {}, blackouts: {} };
}

function readMock(): MockDb {
  if (typeof window === "undefined") return emptyDb();
  try {
    const raw = localStorage.getItem(MOCK_KEY);
    return raw ? (JSON.parse(raw) as MockDb) : emptyDb();
  } catch {
    return emptyDb();
  }
}

function writeMock(db: MockDb) {
  if (typeof window === "undefined") return;
  localStorage.setItem(MOCK_KEY, JSON.stringify(db));
}

// Re-export ApiError for callers that catch probe failures.
export { ApiError };
