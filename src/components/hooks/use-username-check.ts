"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client/api";
import { usernameSchema } from "@/lib/validation";

export type UsernameStatus = "idle" | "checking" | "available" | "taken";

/** Debounced live availability check. `current` is the user's own username (always "idle"). */
export function useUsernameCheck(username: string, current?: string): UsernameStatus {
  const u = username.trim().toLowerCase();
  const checkable = u !== current && usernameSchema.safeParse(u).success;
  const [result, setResult] = useState<{ username: string; available: boolean } | null>(null);

  useEffect(() => {
    if (!checkable) return;
    let cancelled = false;
    const t = setTimeout(() => {
      api
        .get<{ available: boolean }>(`/api/auth/username?u=${encodeURIComponent(u)}`)
        .then((r) => !cancelled && setResult({ username: u, available: r.available }))
        .catch(() => {});
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [u, checkable]);

  if (!checkable) return "idle";
  if (result?.username !== u) return "checking";
  return result.available ? "available" : "taken";
}
