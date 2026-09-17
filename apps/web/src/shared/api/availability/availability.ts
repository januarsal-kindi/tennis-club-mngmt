import { allowOfflineAuth } from "@/shared/auth";
import { ApiError, http, probeRoute, type RouteProbe } from "../client";
import { getWeeklyHours, listBlackouts, listCourts } from "../courts/court";
import { listMockOccupancy } from "../bookings/booking";

export type AvailabilitySlot = { start: string; end: string };

export type Availability = {
  courtId: string;
  date: string;
  timezone: string;
  slotMinutes: number;
  slots: AvailabilitySlot[];
};

export type AvailabilitySource = "live" | "mock";

const SLOT_MINUTES = 30;
const FALLBACK_TZ = "Asia/Jakarta";

let source: AvailabilitySource | null = null;

export function availabilityApiSource(): AvailabilitySource | null {
  return source;
}

/**
 * Resolve live vs mock once.
 * - live sticks after GET /availability exists (2xx / 400 / 401 / 403)
 * - mock only when route missing AND offline/demo auth gate allows it
 * - 5xx / network → throw (fail closed)
 */
export async function resolveAvailabilityApiSource(): Promise<AvailabilitySource> {
  if (source === "live") return "live";
  if (source === "mock") return "mock";

  const probe: RouteProbe = await probeRoute("/availability");
  if (probe === "live") {
    source = "live";
    return "live";
  }
  if (probe === "missing" && allowOfflineAuth()) {
    source = "mock";
    return "mock";
  }
  if (probe === "missing") {
    throw new Error("Availability API is not available (mock disabled outside local demo).");
  }
  throw new Error("Availability API unavailable (fail closed on 5xx/network).");
}

export async function getAvailability(courtId: string, date: string): Promise<Availability> {
  if ((await resolveAvailabilityApiSource()) === "live") {
    const { data } = await http.get<unknown>("/availability", { params: { courtId, date } });
    return asAvailability(data, courtId, date);
  }
  return mockAvailability(courtId, date);
}

function asAvailability(data: unknown, courtId: string, date: string): Availability {
  if (!data || typeof data !== "object") throw new Error("Invalid availability response");
  const d = data as Record<string, unknown>;
  const slots = Array.isArray(d.slots) ? d.slots.filter(isSlot) : [];
  return {
    courtId: typeof d.courtId === "string" ? d.courtId : courtId,
    date: typeof d.date === "string" ? d.date : date,
    timezone: typeof d.timezone === "string" ? d.timezone : FALLBACK_TZ,
    slotMinutes: typeof d.slotMinutes === "number" ? d.slotMinutes : SLOT_MINUTES,
    slots,
  };
}

function isSlot(value: unknown): value is AvailabilitySlot {
  if (!value || typeof value !== "object") return false;
  const s = value as Record<string, unknown>;
  return typeof s.start === "string" && typeof s.end === "string";
}

async function mockAvailability(courtId: string, date: string): Promise<Availability> {
  const courts = await listCourts();
  const court = courts.find((c) => c.id === courtId);
  if (!court) throw new ApiError(404, "NOT_FOUND", "Court not found");

  const timezone = await getClubTimezone();
  const empty: Availability = { courtId, date, timezone, slotMinutes: SLOT_MINUTES, slots: [] };
  if (!court.active) return empty;

  const weekday = weekdayFromYmd(date);
  let hours: { weekday: number; startLocal: string; endLocal: string }[] = [];
  try {
    hours = await getWeeklyHours(courtId);
  } catch {
    hours = [{ weekday, startLocal: "08:00", endLocal: "21:00" }];
  }
  const window = hours.find((h) => h.weekday === weekday);
  if (!window) return empty;

  let blackouts: { start: string; end: string }[] = [];
  try {
    blackouts = await listBlackouts(courtId);
  } catch {
    blackouts = [];
  }

  const occupied = [...blackouts, ...listMockOccupancy(courtId)];
  const slots = generateSlots(date, window.startLocal, window.endLocal, timezone).filter(
    (slot) => !occupied.some((block) => overlaps(slot, block)),
  );
  return { courtId, date, timezone, slotMinutes: SLOT_MINUTES, slots };
}

export async function getClubTimezone(): Promise<string> {
  try {
    const { data } = await http.get<unknown>("/club-settings");
    if (data && typeof data === "object" && "timezone" in data) {
      const tz = (data as { timezone: unknown }).timezone;
      if (typeof tz === "string" && tz.trim()) return tz;
    }
  } catch {
    // mock path: club-settings may be down
  }
  return FALLBACK_TZ;
}

function weekdayFromYmd(ymd: string): number {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0)).getUTCDay();
}

function generateSlots(date: string, startLocal: string, endLocal: string, timeZone: string): AvailabilitySlot[] {
  const slots: AvailabilitySlot[] = [];
  let t = startLocal;
  while (addMinutes(t, SLOT_MINUTES) <= endLocal) {
    const endLocalSlot = addMinutes(t, SLOT_MINUTES);
    slots.push({
      start: zonedTimeToUtc(date, t, timeZone),
      end: zonedTimeToUtc(date, endLocalSlot, timeZone),
    });
    t = endLocalSlot;
  }
  return slots;
}

function addMinutes(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** Half-open [start, end). */
export function overlaps(a: { start: string; end: string }, b: { start: string; end: string }): boolean {
  return a.start < b.end && b.start < a.end;
}

function tzOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const g = (type: string) => parts.find((p) => p.type === type)?.value ?? "0";
  const asUtc = Date.UTC(+g("year"), +g("month") - 1, +g("day"), +g("hour"), +g("minute"), +g("second"));
  return asUtc - date.getTime();
}

function zonedTimeToUtc(ymd: string, hhmm: string, timeZone: string): string {
  const [y, mo, d] = ymd.split("-").map(Number);
  const [h, mi] = hhmm.split(":").map(Number);
  const utcGuess = Date.UTC(y, mo - 1, d, h, mi, 0);
  const first = utcGuess - tzOffsetMs(new Date(utcGuess), timeZone);
  return new Date(utcGuess - tzOffsetMs(new Date(first), timeZone)).toISOString();
}

export { ApiError };
