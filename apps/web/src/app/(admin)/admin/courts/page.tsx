"use client";

import { useEffect, useState } from "react";
import { Controller, useForm, type Path } from "react-hook-form";
import {
  allDayRange,
  blackoutDateLabel,
  blackoutInclusiveEnd,
  courtMayHaveFutureHolds,
  courtsApiSource,
  useBlackoutsQuery,
  useCourtsQuery,
  useCreateBlackoutMutation,
  useCreateCourtMutation,
  useDeleteBlackoutMutation,
  usePutWeeklyHoursMutation,
  useUpdateCourtMutation,
  useWeeklyHoursQuery,
  WEEKDAY_LABEL,
  WEEKDAY_ORDER,
  type Court,
  type Weekday,
  type WeeklyHour,
} from "@/shared/api";

const inputClass =
  "border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500";
const primaryBtn =
  "bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white font-semibold rounded-lg px-4 py-2 text-sm";
const secondaryBtn =
  "border border-gray-300 rounded-lg px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50";

type HourDraft = Record<Weekday, { open: boolean; startLocal: string; endLocal: string }>;

function emptyHours(): HourDraft {
  return {
    0: { open: false, startLocal: "08:00", endLocal: "21:00" },
    1: { open: false, startLocal: "08:00", endLocal: "21:00" },
    2: { open: false, startLocal: "08:00", endLocal: "21:00" },
    3: { open: false, startLocal: "08:00", endLocal: "21:00" },
    4: { open: false, startLocal: "08:00", endLocal: "21:00" },
    5: { open: false, startLocal: "08:00", endLocal: "21:00" },
    6: { open: false, startLocal: "08:00", endLocal: "21:00" },
  };
}

function hoursToDraft(hours: WeeklyHour[]): HourDraft {
  const draft = emptyHours();
  for (const h of hours) {
    draft[h.weekday] = { open: true, startLocal: h.startLocal, endLocal: h.endLocal };
  }
  return draft;
}

function draftToHours(draft: HourDraft): WeeklyHour[] {
  return WEEKDAY_ORDER.filter((d) => draft[d].open).map((weekday) => ({
    weekday,
    startLocal: draft[weekday].startLocal,
    endLocal: draft[weekday].endLocal,
  }));
}

function errMessage(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

export default function AdminCourtsPage() {
  const courtsQuery = useCourtsQuery();
  const createCourt = useCreateCourtMutation();
  const updateCourt = useUpdateCourtMutation();
  const putHours = usePutWeeklyHoursMutation();
  const addBlackout = useCreateBlackoutMutation();
  const removeBlackout = useDeleteBlackoutMutation();

  const courts = courtsQuery.data ?? [];
  const source = courtsQuery.isSuccess ? courtsApiSource() : null;

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingDeactivateId, setPendingDeactivateId] = useState<string | null>(null);

  const hoursQuery = useWeeklyHoursQuery(selectedId);
  const blackoutsQuery = useBlackoutsQuery(selectedId);

  const createForm = useForm<{ name: string }>({ defaultValues: { name: "" } });
  const renameForm = useForm<{ name: string }>({ defaultValues: { name: "" } });
  const { reset: resetRename } = renameForm;
  const hoursForm = useForm<HourDraft>({ defaultValues: emptyHours() });
  const { reset: resetHours } = hoursForm;
  const blackoutForm = useForm<{ start: string; end: string; reason: string }>({
    defaultValues: { start: "", end: "", reason: "" },
  });

  const hours = hoursForm.watch();
  const selected = courts.find((c) => c.id === selectedId) ?? null;
  const blackouts = blackoutsQuery.data ?? [];
  const hoursConfigured = WEEKDAY_ORDER.some((d) => hours[d]?.open);

  useEffect(() => {
    const list = courtsQuery.data;
    if (!list) return;
    if (!list.length) {
      setSelectedId(null);
      return;
    }
    setSelectedId((current) => {
      if (current && list.some((c) => c.id === current)) return current;
      if (current) return current;
      return list[0]?.id ?? null;
    });
  }, [courtsQuery.data]);

  useEffect(() => {
    resetRename({ name: selected?.name ?? "" });
  }, [selected?.id, selected?.name, resetRename]);

  useEffect(() => {
    if (!selectedId) {
      resetHours(emptyHours());
      return;
    }
    if (hoursQuery.data) resetHours(hoursToDraft(hoursQuery.data));
  }, [selectedId, hoursQuery.data, resetHours]);

  const queryError = courtsQuery.error ?? hoursQuery.error ?? blackoutsQuery.error;
  const loadError =
    actionError ?? (queryError ? errMessage(queryError, "Failed to load courts") : null);

  const busy =
    createCourt.isPending ||
    updateCourt.isPending ||
    putHours.isPending ||
    addBlackout.isPending ||
    removeBlackout.isPending;

  async function onCreate({ name }: { name: string }) {
    if (!name.trim()) return;
    setActionError(null);
    try {
      const court = await createCourt.mutateAsync({ name });
      createForm.reset({ name: "" });
      setSelectedId(court.id);
    } catch (err) {
      setActionError(errMessage(err, "Could not create court"));
    }
  }

  async function onSaveName({ name }: { name: string }) {
    if (!selected || !name.trim()) return;
    setActionError(null);
    try {
      await updateCourt.mutateAsync({ id: selected.id, input: { name } });
    } catch (err) {
      setActionError(errMessage(err, "Could not rename court"));
    }
  }

  async function requestDeactivate(court: Court) {
    if (court.active && (await courtMayHaveFutureHolds(court.id))) {
      setPendingDeactivateId(court.id);
      return;
    }
    await applyActive(court, !court.active);
  }

  async function applyActive(court: Court, active: boolean) {
    setPendingDeactivateId(null);
    setActionError(null);
    try {
      await updateCourt.mutateAsync({ id: court.id, input: { active } });
    } catch (err) {
      setActionError(errMessage(err, "Could not update court"));
    }
  }

  async function onSaveHours(draft: HourDraft) {
    if (!selected) return;
    const next = draftToHours(draft);
    if (next.some((h) => h.startLocal >= h.endLocal)) {
      setActionError("Open hours need a start time before the end time.");
      return;
    }
    setActionError(null);
    try {
      await putHours.mutateAsync({ courtId: selected.id, hours: next });
    } catch (err) {
      setActionError(errMessage(err, "Could not save hours"));
    }
  }

  async function onAddBlackout({ start, end, reason }: { start: string; end: string; reason: string }) {
    if (!selected || !start) return;
    const endDate = end || start;
    if (endDate < start) {
      setActionError("Blackout end date must be on or after the start date.");
      return;
    }
    setActionError(null);
    try {
      const range = allDayRange(start, endDate);
      await addBlackout.mutateAsync({
        courtId: selected.id,
        input: { start: range.start, end: range.end, reason: reason.trim() || undefined },
      });
      blackoutForm.reset({ start: "", end: "", reason: "" });
    } catch (err) {
      setActionError(errMessage(err, "Could not add blackout"));
    }
  }

  async function onDeleteBlackout(id: string) {
    if (!selected) return;
    setActionError(null);
    try {
      await removeBlackout.mutateAsync({ courtId: selected.id, blackoutId: id });
    } catch (err) {
      setActionError(errMessage(err, "Could not delete blackout"));
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-green-900">Courts & Schedule</h1>
        <p className="text-gray-500 text-sm mt-1">
          Create courts, set weekly hours, and add date-specific blackouts.
        </p>
      </div>

      {source === "mock" && (
        <p className="text-sm rounded-lg border border-amber-200 bg-amber-50 text-amber-900 px-4 py-3">
          Using local mock data — BE-3 courts API is not available yet. Changes stay in this browser
          until <code className="text-xs">GET /api/v1/courts</code> is live.
        </p>
      )}

      {loadError && (
        <p className="text-sm rounded-lg border border-red-200 bg-red-50 text-red-800 px-4 py-3">{loadError}</p>
      )}

      <form onSubmit={createForm.handleSubmit(onCreate)} className="flex flex-wrap gap-2 items-end">
        <label className="space-y-1">
          <span className="block text-sm font-medium text-gray-700">New court</span>
          <Controller
            name="name"
            control={createForm.control}
            rules={{ required: true }}
            render={({ field }) => (
              <input {...field} className={inputClass} placeholder="Court name" required />
            )}
          />
        </label>
        <button className={primaryBtn} type="submit" disabled={busy}>
          Create
        </button>
      </form>

      {courts.length === 0 ? (
        <p className="text-sm text-gray-500 bg-white border border-dashed border-gray-300 rounded-xl p-6">
          No courts yet. Create one to configure weekly hours and blackouts.
        </p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <ul className="space-y-2">
            {courts.map((court) => (
              <li key={court.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(court.id)}
                  className={`w-full text-left p-4 rounded-xl border transition-all ${
                    court.id === selectedId
                      ? "border-green-500 bg-green-50 shadow-sm"
                      : "border-gray-200 bg-white hover:border-green-300"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-green-900">{court.name}</span>
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        court.active ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-600"
                      }`}
                    >
                      {court.active ? "Active" : "Inactive"}
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>

          {selected && (
            <div className="lg:col-span-2 space-y-6">
              <section className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
                <h2 className="font-semibold text-green-800">Court</h2>
                <form onSubmit={renameForm.handleSubmit(onSaveName)} className="flex flex-wrap gap-2 items-end">
                  <label className="space-y-1 flex-1 min-w-48">
                    <span className="block text-sm font-medium text-gray-700">Name</span>
                    <Controller
                      name="name"
                      control={renameForm.control}
                      rules={{ required: true }}
                      render={({ field }) => <input {...field} className={`${inputClass} w-full`} />}
                    />
                  </label>
                  <button className={primaryBtn} type="submit" disabled={busy}>
                    Save name
                  </button>
                  <button
                    className={secondaryBtn}
                    type="button"
                    disabled={busy}
                    onClick={() => void requestDeactivate(selected)}
                  >
                    {selected.active ? "Deactivate" : "Activate"}
                  </button>
                </form>

                {pendingDeactivateId === selected.id && (
                  <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 space-y-3 text-sm text-amber-950">
                    <p>
                      This court may have future holds. Existing bookings and sessions will remain;
                      new bookings will be blocked (A11). Occupancy check is not wired yet.
                    </p>
                    <div className="flex gap-2">
                      <button
                        className={primaryBtn}
                        type="button"
                        disabled={busy}
                        onClick={() => void applyActive(selected, false)}
                      >
                        Deactivate anyway
                      </button>
                      <button
                        className={secondaryBtn}
                        type="button"
                        onClick={() => setPendingDeactivateId(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </section>

              <form
                onSubmit={hoursForm.handleSubmit(onSaveHours)}
                className="bg-white border border-gray-200 rounded-xl p-5 space-y-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-semibold text-green-800">Weekly hours</h2>
                  <button className={primaryBtn} type="submit" disabled={busy}>
                    Save hours
                  </button>
                </div>
                {!hoursConfigured && (
                  <p className="text-sm text-gray-500">No hours configured — this court will have no bookable slots.</p>
                )}
                <div className="space-y-2">
                  {WEEKDAY_ORDER.map((day) => (
                    <div key={day} className="flex flex-wrap items-center gap-3 text-sm">
                      <label className="w-28 flex items-center gap-2">
                        <Controller
                          name={`${day}.open` as Path<HourDraft>}
                          control={hoursForm.control}
                          render={({ field }) => (
                            <input
                              type="checkbox"
                              checked={Boolean(field.value)}
                              onChange={(e) => field.onChange(e.target.checked)}
                              onBlur={field.onBlur}
                              ref={field.ref}
                              name={field.name}
                            />
                          )}
                        />
                        {WEEKDAY_LABEL[day]}
                      </label>
                      <Controller
                        name={`${day}.startLocal` as Path<HourDraft>}
                        control={hoursForm.control}
                        render={({ field }) => (
                          <input
                            {...field}
                            type="time"
                            className={inputClass}
                            disabled={!hours[day]?.open}
                            value={String(field.value ?? "")}
                          />
                        )}
                      />
                      <span className="text-gray-400">to</span>
                      <Controller
                        name={`${day}.endLocal` as Path<HourDraft>}
                        control={hoursForm.control}
                        render={({ field }) => (
                          <input
                            {...field}
                            type="time"
                            className={inputClass}
                            disabled={!hours[day]?.open}
                            value={String(field.value ?? "")}
                          />
                        )}
                      />
                    </div>
                  ))}
                </div>
              </form>

              <section className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
                <h2 className="font-semibold text-green-800">Blackouts</h2>
                {blackouts.length === 0 ? (
                  <p className="text-sm text-gray-500">No blackout dates.</p>
                ) : (
                  <ul className="divide-y divide-gray-100 border border-gray-100 rounded-lg">
                    {blackouts.map((b) => (
                      <li key={b.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                        <span>
                          {blackoutDateLabel(b.start)}
                          {blackoutInclusiveEnd(b.start, b.end) !== blackoutDateLabel(b.start)
                            ? ` – ${blackoutInclusiveEnd(b.start, b.end)}`
                            : ""}
                          {b.reason ? ` · ${b.reason}` : ""}
                        </span>
                        <button
                          type="button"
                          className="text-red-700 hover:underline text-xs"
                          disabled={busy}
                          onClick={() => void onDeleteBlackout(b.id)}
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <form
                  onSubmit={blackoutForm.handleSubmit(onAddBlackout)}
                  className="flex flex-wrap gap-2 items-end"
                >
                  <label className="space-y-1">
                    <span className="block text-xs font-medium text-gray-600">Start date</span>
                    <Controller
                      name="start"
                      control={blackoutForm.control}
                      rules={{ required: true }}
                      render={({ field }) => (
                        <input {...field} type="date" required className={inputClass} />
                      )}
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="block text-xs font-medium text-gray-600">End date</span>
                    <Controller
                      name="end"
                      control={blackoutForm.control}
                      render={({ field }) => <input {...field} type="date" className={inputClass} />}
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="block text-xs font-medium text-gray-600">Reason</span>
                    <Controller
                      name="reason"
                      control={blackoutForm.control}
                      render={({ field }) => (
                        <input {...field} className={inputClass} placeholder="Optional" />
                      )}
                    />
                  </label>
                  <button className={primaryBtn} type="submit" disabled={busy}>
                    Add blackout
                  </button>
                </form>
              </section>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
