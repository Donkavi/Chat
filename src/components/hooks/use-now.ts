"use client";

import { useEffect, useState } from "react";

/** Current time that re-renders every `intervalMs` — for "2 min ago" style labels. */
export function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
