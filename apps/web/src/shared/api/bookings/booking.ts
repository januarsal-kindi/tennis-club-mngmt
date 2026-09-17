import { allowOfflineAuth } from "@/shared/auth";
import { ApiError, http, probeRoute, type RouteProbe } from "../client";

export type BookingStatus = "confirmed" | "cancelled";
export type PaymentStatus = "unpaid" | "pending_verification" | "paid" | "waived";

export type CourtBooking = {
  id: string;
  courtId: string;
  userId: string;
  blockId: string;
  start: string;
  end: string;
  status: BookingStatus;
  createdByAdminId?: string | null;
  paymentStatus: PaymentStatus;
  createdAt: string;
  updatedAt: string;
};

export type CreateBookingInput = {
  courtId: string;
  start: string;
  end: string;
};

export type BookingsSource = "live" | "mock";

const MOCK_KEY = "tc_fe3_bookings_mock";
const MOCK_USER_ID = "00000000-0000-4000-8000-000000000001";
export const CANCEL_LEAD_MS = 2 * 60 * 60 * 1000;

let source: BookingsSource | null = null;

export function bookingsApiSource(): BookingsSource | null {
  return source;
}

/**
 * Resolve live vs mock once.
 * - live sticks after GET /bookings/mine exists
 * - mock only when route missing AND offline/demo auth gate allows it
 * - 5xx / network → throw (fail closed)
 */
export async function resolveBookingsApiSource(): Promise<BookingsSource> {
  if (source === "live") return "live";
  if (source === "mock") return "mock";

  const probe: RouteProbe = await probeRoute("/bookings/mine");
  if (probe === "live") {
    source = "live";
    return "live";
  }
  if (probe === "missing" && allowOfflineAuth()) {
    source = "mock";
    return "mock";
  }
  if (probe === "missing") {
    throw new Error("Bookings API is not available (mock disabled outside local demo).");
  }
  throw new Error("Bookings API unavailable (fail closed on 5xx/network).");
}

export function canSelfCancel(startIso: string, now = Date.now()): boolean {
  return new Date(startIso).getTime() - now >= CANCEL_LEAD_MS;
}

export async function listMyBookings(): Promise<CourtBooking[]> {
  if ((await resolveBookingsApiSource()) === "live") {
    const { data } = await http.get<unknown>("/bookings/mine");
    return asList(data).map(asBooking);
  }
  return readMock().filter((b) => b.status !== "cancelled");
}

export async function createBooking(input: CreateBookingInput): Promise<CourtBooking> {
  if ((await resolveBookingsApiSource()) === "live") {
    const { data } = await http.post<unknown>("/bookings", input);
    return asBooking(data);
  }
  return mockCreate(input);
}

export async function cancelBooking(id: string): Promise<CourtBooking> {
  if ((await resolveBookingsApiSource()) === "live") {
    const { data } = await http.post<unknown>(`/bookings/${id}/cancel`);
    return asBooking(data);
  }
  return mockCancel(id);
}

/** Confirmed mock holds — used by mock availability to subtract occupied slots. */
export function listMockOccupancy(courtId: string): { start: string; end: string }[] {
  return readMock()
    .filter((b) => b.courtId === courtId && b.status === "confirmed")
    .map((b) => ({ start: b.start, end: b.end }));
}

function mockCreate(input: CreateBookingInput): CourtBooking {
  if (input.start >= input.end) {
    throw new ApiError(400, "VALIDATION", "End must be after start.");
  }
  const db = readMock();
  const conflict = db.some(
    (b) =>
      b.status === "confirmed" &&
      b.courtId === input.courtId &&
      b.start < input.end &&
      input.start < b.end,
  );
  if (conflict) {
    throw new ApiError(409, "CONFLICT", "That slot is no longer available.");
  }
  const now = new Date().toISOString();
  const booking: CourtBooking = {
    id: crypto.randomUUID(),
    courtId: input.courtId,
    userId: MOCK_USER_ID,
    blockId: crypto.randomUUID(),
    start: input.start,
    end: input.end,
    status: "confirmed",
    paymentStatus: "unpaid",
    createdAt: now,
    updatedAt: now,
  };
  writeMock([...db, booking]);
  return booking;
}

function mockCancel(id: string): CourtBooking {
  const db = readMock();
  const booking = db.find((b) => b.id === id);
  if (!booking) throw new ApiError(404, "NOT_FOUND", "Booking not found");
  if (booking.status === "cancelled") return booking;
  if (!canSelfCancel(booking.start)) {
    throw new ApiError(
      403,
      "FORBIDDEN",
      "Cancellations need at least 2 hours' notice. Ask the club if you need to cancel.",
    );
  }
  booking.status = "cancelled";
  booking.updatedAt = new Date().toISOString();
  writeMock(db);
  return booking;
}

function asBooking(data: unknown): CourtBooking {
  if (!data || typeof data !== "object") throw new Error("Invalid booking response");
  const raw = data as Record<string, unknown>;
  const nested =
    raw.booking && typeof raw.booking === "object" ? (raw.booking as Record<string, unknown>) : raw;
  const paymentStatus = paymentStatusOf(raw, nested);
  if (
    typeof nested.id !== "string" ||
    typeof nested.courtId !== "string" ||
    typeof nested.start !== "string" ||
    typeof nested.end !== "string"
  ) {
    throw new Error("Invalid booking response");
  }
  return {
    id: nested.id,
    courtId: nested.courtId,
    userId: typeof nested.userId === "string" ? nested.userId : MOCK_USER_ID,
    blockId: typeof nested.blockId === "string" ? nested.blockId : nested.id,
    start: nested.start,
    end: nested.end,
    status: nested.status === "cancelled" ? "cancelled" : "confirmed",
    createdByAdminId: typeof nested.createdByAdminId === "string" ? nested.createdByAdminId : null,
    paymentStatus,
    createdAt: typeof nested.createdAt === "string" ? nested.createdAt : new Date().toISOString(),
    updatedAt: typeof nested.updatedAt === "string" ? nested.updatedAt : new Date().toISOString(),
  };
}

function paymentStatusOf(raw: Record<string, unknown>, nested: Record<string, unknown>): PaymentStatus {
  const direct = raw.paymentStatus ?? nested.paymentStatus;
  if (isPaymentStatus(direct)) return direct;
  const payment = raw.payment ?? nested.payment;
  if (payment && typeof payment === "object" && "status" in payment) {
    const status = (payment as { status: unknown }).status;
    if (isPaymentStatus(status)) return status;
  }
  return "unpaid";
}

function isPaymentStatus(value: unknown): value is PaymentStatus {
  return value === "unpaid" || value === "pending_verification" || value === "paid" || value === "waived";
}

function asList(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object" && "bookings" in data) {
    const nested = (data as { bookings: unknown }).bookings;
    if (Array.isArray(nested)) return nested;
  }
  return [];
}

function readMock(): CourtBooking[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(MOCK_KEY);
    return raw ? (JSON.parse(raw) as CourtBooking[]) : [];
  } catch {
    return [];
  }
}

function writeMock(db: CourtBooking[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(MOCK_KEY, JSON.stringify(db));
}

export { ApiError };
