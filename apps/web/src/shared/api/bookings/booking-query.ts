"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { availabilityKeys } from "../availability/availability-query";
import { cancelBooking, createBooking, listMyBookings, type CreateBookingInput } from "./booking";

export const bookingsKeys = {
  all: ["bookings"] as const,
  mine: () => [...bookingsKeys.all, "mine"] as const,
};

export function useMyBookingsQuery() {
  return useQuery({
    queryKey: bookingsKeys.mine(),
    queryFn: listMyBookings,
    retry: false,
  });
}

export function useCreateBookingMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBookingInput) => createBooking(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: bookingsKeys.mine() });
      void qc.invalidateQueries({ queryKey: availabilityKeys.all });
    },
  });
}

export function useCancelBookingMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => cancelBooking(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: bookingsKeys.mine() });
      void qc.invalidateQueries({ queryKey: availabilityKeys.all });
    },
  });
}
