"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { login } from "./auth";

export const authKeys = {
  all: ["auth"] as const,
  me: () => [...authKeys.all, "me"] as const,
};

export function useLoginMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) => login(email, password),
    onSuccess: (user) => {
      qc.setQueryData(authKeys.me(), user);
    },
  });
}
