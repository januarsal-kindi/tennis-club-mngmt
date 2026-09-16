import { apiFetch, courtsRouteExists } from "./client";

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
  reason?: string;
};

export type Court = {
  id: string;
  name: string;
  active: boolean;
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

export async function resolveCourtsApiSource(): Promise<CourtsSource> {
  if (source) return source;
  // TODO(BE-3): drop mock once GET /api/v1/courts is on main / contract published.
  source = (await courtsRouteExists()) ? "live" : "mock";
  return source;
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
    try {
      return asList<WeeklyHour>(await apiFetch<unknown>(`/courts/${courtId}/weekly-hours`), "hours");
    } catch (err) {
      if (isNotFound(err)) return [];
      throw err;
    }
  }
  return readMock().hours[courtId] ?? [];
}

export async function putWeeklyHours(courtId: string, hours: WeeklyHour[]): Promise<WeeklyHour[]> {
  if ((await resolveCourtsApiSource()) === "live") {
    // Architecture: PUT /courts/:id/weekly-hours — body is the full week replacement.
    return asList<WeeklyHour>(
      await apiFetch<unknown>(`/courts/${courtId}/weekly-hours`, {
        method: "PUT",
        body: JSON.stringify(hours),
      }),
      "hours",
    );
  }
  const db = readMock();
  db.hours[courtId] = hours;
  writeMock(db);
  return hours;
}

export async function listBlackouts(courtId: string): Promise<Blackout[]> {
  if ((await resolveCourtsApiSource()) === "live") {
    try {
      return asList<Blackout>(await apiFetch<unknown>(`/courts/${courtId}/blackouts`), "blackouts");
    } catch (err) {
      if (isNotFound(err)) return [];
      throw err;
    }
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

export function allDayRange(startDate: string, endDateInclusive: string): { start: string; end: string } {
  const end = new Date(`${endDateInclusive}T00:00:00`);
  end.setDate(end.getDate() + 1);
  const y = end.getFullYear();
  const m = String(end.getMonth() + 1).padStart(2, "0");
  const d = String(end.getDate()).padStart(2, "0");
  return { start: `${startDate}T00:00:00`, end: `${y}-${m}-${d}T00:00:00` };
}

export function blackoutDateLabel(iso: string): string {
  return iso.slice(0, 10);
}

/** Half-open `end` at midnight displays as the previous inclusive date. */
export function blackoutInclusiveEnd(start: string, end: string): string {
  const startDay = start.slice(0, 10);
  const time = end.slice(11, 19);
  if (time === "00:00:00" || time === "") {
    const d = new Date(`${end.slice(0, 10)}T00:00:00`);
    d.setDate(d.getDate() - 1);
    const label = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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

function isNotFound(err: unknown): boolean {
  return typeof err === "object" && err !== null && "status" in err && (err as { status: number }).status === 404;
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
