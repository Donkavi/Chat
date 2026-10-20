"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { PresenceUpdate } from "@/shared/events";
import type { PublicUser } from "@/shared/types";
import { useRealtime, useSocketEvent } from "./realtime-provider";

type PresenceMap = Record<string, { isOnline: boolean; lastSeenAt: string | null }>;

interface PresenceContextValue {
  presence: PresenceMap;
  retain: (ids: string[]) => () => void;
}

const PresenceContext = createContext<PresenceContextValue | null>(null);

/**
 * Live presence for the users currently on screen. Components declare which
 * users they show; the provider sends the union to the server (debounced) and
 * merges `presence:update` pushes into one map.
 */
export function PresenceProvider({ children }: { children: React.ReactNode }) {
  const { socket, connectionEpoch } = useRealtime();
  const [presence, setPresence] = useState<PresenceMap>({});
  const counts = useRef(new Map<string, number>());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSent = useRef("");

  const flush = useCallback(
    (force = false) => {
      if (!socket?.connected) return;
      const ids = [...counts.current.keys()].sort().slice(0, 200);
      const key = ids.join(",");
      if (!force && key === lastSent.current) return;
      lastSent.current = key;
      socket.emit("presence:subscribe", { userIds: ids }, (res) => {
        if (!res.ok) return;
        setPresence((prev) => {
          const next = { ...prev };
          for (const p of res.data) next[p.userId] = { isOnline: p.isOnline, lastSeenAt: p.lastSeenAt };
          return next;
        });
      });
    },
    [socket],
  );

  const schedule = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => flush(), 150);
  }, [flush]);

  // Re-subscribe after every (re)connection; server-side rooms don't survive a reconnect.
  useEffect(() => {
    if (connectionEpoch > 0) flush(true);
  }, [connectionEpoch, flush]);

  useSocketEvent("presence:update", (p: PresenceUpdate) => {
    setPresence((prev) => ({ ...prev, [p.userId]: { isOnline: p.isOnline, lastSeenAt: p.lastSeenAt } }));
  });

  const retain = useCallback(
    (ids: string[]) => {
      for (const id of ids) counts.current.set(id, (counts.current.get(id) ?? 0) + 1);
      schedule();
      return () => {
        for (const id of ids) {
          const n = (counts.current.get(id) ?? 1) - 1;
          if (n <= 0) counts.current.delete(id);
          else counts.current.set(id, n);
        }
        schedule();
      };
    },
    [schedule],
  );

  const value = useMemo(() => ({ presence, retain }), [presence, retain]);
  return <PresenceContext.Provider value={value}>{children}</PresenceContext.Provider>;
}

/** Keep presence subscriptions for these users while the component is mounted. */
export function useTrackPresence(userIds: string[]) {
  const ctx = useContext(PresenceContext);
  const key = [...new Set(userIds)].sort().join(",");
  useEffect(() => {
    if (!ctx || !key) return;
    return ctx.retain(key.split(","));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ctx?.retain]);
}

/** Live status for a user, falling back to the status included in the API response. */
export function useLivePresence(user: Pick<PublicUser, "id" | "isOnline" | "lastSeenAt"> | null | undefined) {
  const ctx = useContext(PresenceContext);
  if (!user) return { isOnline: false, lastSeenAt: null };
  return ctx?.presence[user.id] ?? { isOnline: user.isOnline, lastSeenAt: user.lastSeenAt };
}
