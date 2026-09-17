"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Controller, useForm } from "react-hook-form";
import {
  ApiError,
  availabilityApiSource,
  bookingsApiSource,
  useAvailabilityQuery,
  useCreateBookingMutation,
  useCourtsQuery,
  type AvailabilitySlot,
} from "@/shared/api";
import { ROUTES } from "@/shared/config";

const inputClass =
  "border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500";
const primaryBtn =
  "bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white font-semibold rounded-lg px-4 py-2 text-sm";

type FilterValues = { courtId: string; date: string };

function todayYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function errMessage(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

function formatTime(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
}

export default function BookCourtPage() {
  const courtsQuery = useCourtsQuery();
  const createBooking = useCreateBookingMutation();
  const courts = (courtsQuery.data ?? []).filter((c) => c.active);

  const { control, watch, setValue } = useForm<FilterValues>({
    defaultValues: { courtId: "", date: todayYmd() },
  });
  const courtId = watch("courtId");
  const date = watch("date");

  const availabilityQuery = useAvailabilityQuery(courtId || null, date || null);

  const [selected, setSelected] = useState<AvailabilitySlot | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const first = courts[0];
    if (!first) return;
    if (!courtId || !courts.some((c) => c.id === courtId)) {
      setValue("courtId", first.id);
    }
  }, [courts, courtId, setValue]);

  const slots = (availabilityQuery.data?.slots ?? []).filter((s) => new Date(s.end).getTime() > Date.now());
  const timeZone = availabilityQuery.data?.timezone ?? "UTC";

  useEffect(() => {
    if (!availabilityQuery.isSuccess || !selected) return;
    if (!slots.some((s) => s.start === selected.start && s.end === selected.end)) {
      setSelected(null);
    }
  }, [availabilityQuery.isSuccess, slots, selected]);

  const availSource = availabilityQuery.isSuccess ? availabilityApiSource() : null;
  const bookSource = bookingsApiSource();
  const queryError = courtsQuery.error ?? availabilityQuery.error;
  const loadError = actionError ?? (queryError ? errMessage(queryError, "Failed to load availability") : null);

  async function onBook() {
    if (!courtId || !selected) return;
    setActionError(null);
    setSuccess(null);
    try {
      const booking = await createBooking.mutateAsync({
        courtId,
        start: selected.start,
        end: selected.end,
      });
      setSelected(null);
      setSuccess(
        `Booking confirmed ${formatTime(booking.start, timeZone)}–${formatTime(booking.end, timeZone)}. Payment status: ${booking.paymentStatus}.`,
      );
    } catch (err) {
      if (err instanceof ApiError && (err.status === 409 || err.code === "CONFLICT")) {
        setActionError("That slot was just taken. Pick another.");
        void availabilityQuery.refetch();
        return;
      }
      setActionError(errMessage(err, "Could not create booking"));
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-green-900">Book a court</h1>
        <p className="text-gray-500 text-sm mt-1">Pick a court and date, then reserve a 30-minute slot.</p>
      </div>

      {(availSource === "mock" || bookSource === "mock") && (
        <p className="text-sm rounded-lg border border-amber-200 bg-amber-50 text-amber-900 px-4 py-3">
          Using local mock data
          {availSource === "mock" ? " for availability" : ""}
          {availSource === "mock" && bookSource === "mock" ? " and" : ""}
          {bookSource === "mock" ? " for bookings" : ""}. Live swap happens automatically when{" "}
          <code className="text-xs">GET /api/v1/availability</code> /{" "}
          <code className="text-xs">GET /api/v1/bookings/mine</code> succeed.
        </p>
      )}

      {loadError && (
        <p className="text-sm rounded-lg border border-red-200 bg-red-50 text-red-800 px-4 py-3">{loadError}</p>
      )}

      {success && (
        <p className="text-sm rounded-lg border border-green-200 bg-green-50 text-green-900 px-4 py-3">
          {success}{" "}
          <Link href={ROUTES.customer.bookings} className="underline font-medium">
            View my bookings
          </Link>
        </p>
      )}

      <form className="flex flex-wrap gap-3 items-end bg-white border border-gray-200 rounded-xl p-4">
        <label className="space-y-1">
          <span className="block text-sm font-medium text-gray-700">Court</span>
          <Controller
            name="courtId"
            control={control}
            rules={{ required: true }}
            render={({ field }) => (
              <select {...field} className={inputClass} disabled={courtsQuery.isPending || courts.length === 0}>
                {courts.length === 0 ? <option value="">No courts</option> : null}
                {courts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
          />
        </label>
        <label className="space-y-1">
          <span className="block text-sm font-medium text-gray-700">Date</span>
          <Controller
            name="date"
            control={control}
            rules={{ required: true }}
            render={({ field }) => <input {...field} type="date" required className={inputClass} />}
          />
        </label>
      </form>

      {courtsQuery.isPending ? (
        <p className="text-sm text-gray-500">Loading courts…</p>
      ) : courts.length === 0 ? (
        <p className="text-sm text-gray-500 bg-white border border-dashed border-gray-300 rounded-xl p-6">
          No courts available to book.
        </p>
      ) : !courtId || !date ? (
        <p className="text-sm text-gray-500">Select a court and date to see slots.</p>
      ) : availabilityQuery.isPending ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2" aria-busy="true">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-10 rounded-lg bg-gray-200 animate-pulse" />
          ))}
        </div>
      ) : availabilityQuery.isError ? (
        <p className="text-sm text-gray-500 bg-white border border-dashed border-red-200 rounded-xl p-6">
          Failed to load availability.
        </p>
      ) : slots.length === 0 ? (
        <p className="text-sm text-gray-500 bg-white border border-dashed border-gray-300 rounded-xl p-6">
          No free 30-minute slots this day. Hours may be closed, blacked out, or fully booked.
        </p>
      ) : (
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold text-green-800">
              {availabilityQuery.data?.slotMinutes ?? 30}-minute slots
            </h2>
            <button
              type="button"
              className={primaryBtn}
              disabled={!selected || createBooking.isPending}
              onClick={() => void onBook()}
            >
              {createBooking.isPending ? "Booking…" : "Book selected slot"}
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
            {slots.map((slot) => {
              const active = selected?.start === slot.start && selected?.end === slot.end;
              return (
                <button
                  key={slot.start}
                  type="button"
                  disabled={createBooking.isPending}
                  onClick={() => setSelected(slot)}
                  className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                    active
                      ? "border-green-600 bg-green-50 text-green-900 shadow-sm"
                      : "border-gray-200 bg-white hover:border-green-300 text-gray-800"
                  }`}
                >
                  {formatTime(slot.start, timeZone)}
                </button>
              );
            })}
          </div>
          {selected && (
            <p className="text-sm text-gray-600">
              Selected {formatTime(selected.start, timeZone)}–{formatTime(selected.end, timeZone)} (
              {availabilityQuery.data?.timezone})
            </p>
          )}
        </section>
      )}
    </div>
  );
}
