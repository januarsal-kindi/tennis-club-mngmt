"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  allDayRange,
  blackoutDateLabel,
  blackoutInclusiveEnd,
  courtMayHaveFutureHolds,
  createBlackout,
  createCourt,
  deleteBlackout,
  getWeeklyHours,
  listBlackouts,
  listCourts,
  putWeeklyHours,
  resolveCourtsApiSource,
  updateCourt,
  WEEKDAY_LABEL,
  WEEKDAY_ORDER,
  type Blackout,
  type Court,
  type CourtsSource,
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

export default function AdminCourtsPage() {
  const [source, setSource] = useState<CourtsSource | null>(null);
  const [courts, setCourts] = useState<Court[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hours, setHours] = useState<HourDraft>(emptyHours());
  const [blackouts, setBlackouts] = useState<Blackout[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [newName, setNewName] = useState("");
  const [editName, setEditName] = useState("");
  const [pendingDeactivateId, setPendingDeactivateId] = useState<string | null>(null);
  const [boStart, setBoStart] = useState("");
  const [boEnd, setBoEnd] = useState("");
  const [boReason, setBoReason] = useState("");

  const selected = courts.find((c) => c.id === selectedId) ?? null;
  const hoursConfigured = WEEKDAY_ORDER.some((d) => hours[d].open);

  const loadCourts = useCallback(async (preferId?: string | null) => {
    setLoadError(null);
    try {
      const src = await resolveCourtsApiSource();
      setSource(src);
      const list = await listCourts();
      setCourts(list);
      setSelectedId((current) => {
        const next = preferId ?? current;
        if (next && list.some((c) => c.id === next)) return next;
        return list[0]?.id ?? null;
      });
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load courts");
    }
  }, []);

  useEffect(() => {
    void loadCourts();
  }, [loadCourts]);

  useEffect(() => {
    if (!selectedId) {
      setHours(emptyHours());
      setBlackouts([]);
      setEditName("");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [h, b] = await Promise.all([getWeeklyHours(selectedId), listBlackouts(selectedId)]);
        if (cancelled) return;
        setHours(hoursToDraft(h));
        setBlackouts(b);
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Failed to load schedule");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  useEffect(() => {
    const court = courts.find((c) => c.id === selectedId);
    if (court) setEditName(court.name);
  }, [selectedId, courts]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setBusy(true);
    setLoadError(null);
    try {
      const court = await createCourt({ name: newName });
      setNewName("");
      await loadCourts(court.id);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Could not create court");
    } finally {
      setBusy(false);
    }
  }

  async function onSaveName() {
    if (!selected || !editName.trim()) return;
    setBusy(true);
    try {
      await updateCourt(selected.id, { name: editName });
      await loadCourts(selected.id);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Could not rename court");
    } finally {
      setBusy(false);
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
    setBusy(true);
    setPendingDeactivateId(null);
    try {
      await updateCourt(court.id, { active });
      await loadCourts(court.id);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Could not update court");
    } finally {
      setBusy(false);
    }
  }

  async function onSaveHours() {
    if (!selected) return;
    const next = draftToHours(hours);
    if (next.some((h) => h.startLocal >= h.endLocal)) {
      setLoadError("Open hours need a start time before the end time.");
      return;
    }
    setBusy(true);
    setLoadError(null);
    try {
      await putWeeklyHours(selected.id, next);
      setHours(hoursToDraft(await getWeeklyHours(selected.id)));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Could not save hours");
    } finally {
      setBusy(false);
    }
  }

  async function onAddBlackout(e: FormEvent) {
    e.preventDefault();
    if (!selected || !boStart) return;
    const endDate = boEnd || boStart;
    if (endDate < boStart) {
      setLoadError("Blackout end date must be on or after the start date.");
      return;
    }
    setBusy(true);
    setLoadError(null);
    try {
      const range = allDayRange(boStart, endDate);
      await createBlackout(selected.id, {
        start: range.start,
        end: range.end,
        reason: boReason.trim() || undefined,
      });
      setBoStart("");
      setBoEnd("");
      setBoReason("");
      setBlackouts(await listBlackouts(selected.id));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Could not add blackout");
    } finally {
      setBusy(false);
    }
  }

  async function onDeleteBlackout(id: string) {
    if (!selected) return;
    setBusy(true);
    try {
      await deleteBlackout(selected.id, id);
      setBlackouts(await listBlackouts(selected.id));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Could not delete blackout");
    } finally {
      setBusy(false);
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
          Using local mock data — <code className="text-xs">GET /api/v1/courts</code> is unreachable.
          Changes stay in this browser until the courts API responds with 2xx/401/403.
        </p>
      )}

      {loadError && (
        <p className="text-sm rounded-lg border border-red-200 bg-red-50 text-red-800 px-4 py-3">{loadError}</p>
      )}

      <form onSubmit={onCreate} className="flex flex-wrap gap-2 items-end">
        <label className="space-y-1">
          <span className="block text-sm font-medium text-gray-700">New court</span>
          <input
            className={inputClass}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Court name"
            required
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
                <div className="flex flex-wrap gap-2 items-end">
                  <label className="space-y-1 flex-1 min-w-48">
                    <span className="block text-sm font-medium text-gray-700">Name</span>
                    <input
                      className={`${inputClass} w-full`}
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                    />
                  </label>
                  <button className={primaryBtn} type="button" disabled={busy} onClick={() => void onSaveName()}>
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
                </div>

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

              <section className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-semibold text-green-800">Weekly hours</h2>
                  <button className={primaryBtn} type="button" disabled={busy} onClick={() => void onSaveHours()}>
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
                        <input
                          type="checkbox"
                          checked={hours[day].open}
                          onChange={(e) =>
                            setHours((prev) => ({
                              ...prev,
                              [day]: { ...prev[day], open: e.target.checked },
                            }))
                          }
                        />
                        {WEEKDAY_LABEL[day]}
                      </label>
                      <input
                        type="time"
                        className={inputClass}
                        disabled={!hours[day].open}
                        value={hours[day].startLocal}
                        onChange={(e) =>
                          setHours((prev) => ({
                            ...prev,
                            [day]: { ...prev[day], startLocal: e.target.value },
                          }))
                        }
                      />
                      <span className="text-gray-400">to</span>
                      <input
                        type="time"
                        className={inputClass}
                        disabled={!hours[day].open}
                        value={hours[day].endLocal}
                        onChange={(e) =>
                          setHours((prev) => ({
                            ...prev,
                            [day]: { ...prev[day], endLocal: e.target.value },
                          }))
                        }
                      />
                    </div>
                  ))}
                </div>
              </section>

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
                <form onSubmit={onAddBlackout} className="flex flex-wrap gap-2 items-end">
                  <label className="space-y-1">
                    <span className="block text-xs font-medium text-gray-600">Start date</span>
                    <input
                      type="date"
                      required
                      className={inputClass}
                      value={boStart}
                      onChange={(e) => setBoStart(e.target.value)}
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="block text-xs font-medium text-gray-600">End date</span>
                    <input
                      type="date"
                      className={inputClass}
                      value={boEnd}
                      onChange={(e) => setBoEnd(e.target.value)}
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="block text-xs font-medium text-gray-600">Reason</span>
                    <input
                      className={inputClass}
                      value={boReason}
                      onChange={(e) => setBoReason(e.target.value)}
                      placeholder="Optional"
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
