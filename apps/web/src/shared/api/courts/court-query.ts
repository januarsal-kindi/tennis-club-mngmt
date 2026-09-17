"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createBlackout,
  createCourt,
  deleteBlackout,
  getWeeklyHours,
  listBlackouts,
  listCourts,
  putWeeklyHours,
  updateCourt,
  type WeeklyHour,
} from "./court";

export const courtsKeys = {
  all: ["courts"] as const,
  lists: () => [...courtsKeys.all, "list"] as const,
  detail: (id: string) => [...courtsKeys.all, "detail", id] as const,
  weeklyHours: (id: string) => [...courtsKeys.all, "weeklyHours", id] as const,
  blackouts: (id: string) => [...courtsKeys.all, "blackouts", id] as const,
};

export function useCourtsQuery() {
  return useQuery({
    queryKey: courtsKeys.lists(),
    queryFn: listCourts,
    retry: false,
  });
}

export function useWeeklyHoursQuery(courtId: string | null) {
  return useQuery({
    queryKey: courtsKeys.weeklyHours(courtId ?? ""),
    queryFn: () => getWeeklyHours(courtId!),
    enabled: Boolean(courtId),
    retry: false,
  });
}

export function useBlackoutsQuery(courtId: string | null) {
  return useQuery({
    queryKey: courtsKeys.blackouts(courtId ?? ""),
    queryFn: () => listBlackouts(courtId!),
    enabled: Boolean(courtId),
    retry: false,
  });
}

export function useCreateCourtMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createCourt,
    onSuccess: (court) => {
      qc.setQueryData(courtsKeys.lists(), (prev: Awaited<ReturnType<typeof listCourts>> | undefined) => {
        if (!prev) return [court];
        if (prev.some((c) => c.id === court.id)) return prev;
        return [...prev, court];
      });
      void qc.invalidateQueries({ queryKey: courtsKeys.lists() });
    },
  });
}

export function useUpdateCourtMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: { name?: string; active?: boolean } }) =>
      updateCourt(id, input),
    onSuccess: (court) => {
      qc.setQueryData(courtsKeys.lists(), (prev: Awaited<ReturnType<typeof listCourts>> | undefined) =>
        prev ? prev.map((c) => (c.id === court.id ? court : c)) : [court],
      );
      void qc.invalidateQueries({ queryKey: courtsKeys.lists() });
      void qc.invalidateQueries({ queryKey: courtsKeys.detail(court.id) });
    },
  });
}

export function usePutWeeklyHoursMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ courtId, hours }: { courtId: string; hours: WeeklyHour[] }) =>
      putWeeklyHours(courtId, hours),
    onSuccess: (_hours, { courtId }) => {
      void qc.invalidateQueries({ queryKey: courtsKeys.weeklyHours(courtId) });
    },
  });
}

export function useCreateBlackoutMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      courtId,
      input,
    }: {
      courtId: string;
      input: { start: string; end: string; reason?: string };
    }) => createBlackout(courtId, input),
    onSuccess: (_blackout, { courtId }) => {
      void qc.invalidateQueries({ queryKey: courtsKeys.blackouts(courtId) });
    },
  });
}

export function useDeleteBlackoutMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ courtId, blackoutId }: { courtId: string; blackoutId: string }) =>
      deleteBlackout(courtId, blackoutId),
    onSuccess: (_void, { courtId }) => {
      void qc.invalidateQueries({ queryKey: courtsKeys.blackouts(courtId) });
    },
  });
}
