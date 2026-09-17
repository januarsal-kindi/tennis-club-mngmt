"use client";

import { useState } from "react";
import {
  ApiError,
  bookingsApiSource,
  canSelfCancel,
  useCancelBookingMutation,
  useCourtsQuery,
  useMyBookingsQuery,
  type CourtBooking,
} from "@/shared/api";

const primaryBtn =
  "bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white font-semibold rounded-lg px-4 py-2 text-sm";
const secondaryBtn =
  "border border-gray-300 rounded-lg px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50";

function errMessage(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

function formatRange(start: string, end: string) {
  const opts: Intl.DateTimeFormatOptions = {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  };
  const startLabel = new Intl.DateTimeFormat("en-GB", opts).format(new Date(start));
  const endLabel = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(end));
  return `${startLabel}–${endLabel}`;
}

function paymentLabel(status: CourtBooking["paymentStatus"]) {
  if (status === "pending_verification") return "Pending verification";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export default function MyBookingsPage() {
  const bookingsQuery = useMyBookingsQuery();
  const courtsQuery = useCourtsQuery();
  const cancelBooking = useCancelBookingMutation();
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const bookings = bookingsQuery.data ?? [];
  const courtsById = new Map((courtsQuery.data ?? []).map((c) => [c.id, c.name]));
  const source = bookingsQuery.isSuccess ? bookingsApiSource() : null;
  const loadError =
    actionError ??
    (bookingsQuery.error ? errMessage(bookingsQuery.error, "Failed to load bookings") : null);

  async function onCancel(id: string) {
    setActionError(null);
    try {
      await cancelBooking.mutateAsync(id);
      setPendingId(null);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 403 || err.code === "FORBIDDEN")) {
        setActionError(err.message);
        return;
      }
      setActionError(errMessage(err, "Could not cancel booking"));
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-green-900">My bookings</h1>
        <p className="text-gray-500 text-sm mt-1">Upcoming court reservations. Cancel at least 2 hours before start.</p>
      </div>

      {source === "mock" && (
        <p className="text-sm rounded-lg border border-amber-200 bg-amber-50 text-amber-900 px-4 py-3">
          Using local mock bookings until <code className="text-xs">GET /api/v1/bookings/mine</code> is live.
        </p>
      )}

      {loadError && (
        <p className="text-sm rounded-lg border border-red-200 bg-red-50 text-red-800 px-4 py-3">{loadError}</p>
      )}

      {bookingsQuery.isPending ? (
        <p className="text-sm text-gray-500">Loading bookings…</p>
      ) : bookings.length === 0 ? (
        <p className="text-sm text-gray-500 bg-white border border-dashed border-gray-300 rounded-xl p-6">
          No bookings yet. Reserve a slot from Book a court.
        </p>
      ) : (
        <ul className="space-y-3">
          {bookings.map((b) => {
            const selfOk = canSelfCancel(b.start);
            return (
              <li
                key={b.id}
                className="bg-white border border-gray-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3"
              >
                <div>
                  <p className="font-semibold text-green-900">{courtsById.get(b.courtId) ?? "Court"}</p>
                  <p className="text-sm text-gray-600">{formatRange(b.start, b.end)}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {b.status === "confirmed" ? "Confirmed" : "Cancelled"} · Payment {paymentLabel(b.paymentStatus)}
                  </p>
                </div>
                {b.status === "confirmed" && (
                  <div className="space-y-2">
                    {pendingId === b.id ? (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className={primaryBtn}
                          disabled={cancelBooking.isPending}
                          onClick={() => void onCancel(b.id)}
                        >
                          {cancelBooking.isPending ? "Cancelling…" : "Confirm cancel"}
                        </button>
                        <button type="button" className={secondaryBtn} onClick={() => setPendingId(null)}>
                          Keep
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className={secondaryBtn}
                        disabled={!selfOk || cancelBooking.isPending}
                        title={selfOk ? "Cancel this booking" : "Inside the 2-hour window — ask the club"}
                        onClick={() => setPendingId(b.id)}
                      >
                        {selfOk ? "Cancel" : "Cancel closed"}
                      </button>
                    )}
                    {!selfOk && (
                      <p className="text-xs text-gray-500">Inside 2-hour window — only the club can cancel.</p>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
