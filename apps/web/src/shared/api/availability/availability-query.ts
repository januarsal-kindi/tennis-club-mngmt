"use client";

import { useQuery } from "@tanstack/react-query";
import { getAvailability } from "./availability";

export const availabilityKeys = {
  all: ["availability"] as const,
  slots: (courtId: string, date: string) => [...availabilityKeys.all, "slots", courtId, date] as const,
};

export function useAvailabilityQuery(courtId: string | null, date: string | null) {
  return useQuery({
    queryKey: availabilityKeys.slots(courtId ?? "", date ?? ""),
    queryFn: () => getAvailability(courtId!, date!),
    enabled: Boolean(courtId && date),
    retry: false,
  });
}
