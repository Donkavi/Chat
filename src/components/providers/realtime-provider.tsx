"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "@/shared/events";
import { HEARTBEAT_INTERVAL_MS } from "@/shared/constants";

export type LumosSocket = Socket<ServerToClientEvents, ClientToServerEvents>;
export type ConnectionStatus = "connecting" | "connected" | "reconnecting";

interface RealtimeContextValue {
  socket: LumosSocket | null;
  status: ConnectionStatus;
  /** Increments on every (re)connection — effects depend on it to resync missed data. */
  connectionEpoch: number;
}

const RealtimeContext = createContext<RealtimeContextValue>({ socket: null, status: "connecting", connectionEpoch: 0 });

export function useRealtime() {
  return useContext(RealtimeContext);
}

/** Subscribe to a server event for the lifetime of the component. */
export function useSocketEvent<E extends keyof ServerToClientEvents>(event: E, handler: ServerToClientEvents[E]) {
  const { socket } = useRealtime();
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  });
  useEffect(() => {
    if (!socket) return;
    const fn = ((...args: unknown[]) => (ref.current as (...a: unknown[]) => void)(...args)) as ServerToClientEvents[E];
    // socket.io-client's typed overloads don't narrow well through generics.
    (socket.on as (ev: E, fn: ServerToClientEvents[E]) => void)(event, fn);
    return () => {
      (socket.off as (ev: E, fn: ServerToClientEvents[E]) => void)(event, fn);
    };
  }, [socket, event]);
}

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const [socket, setSocket] = useState<LumosSocket | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [connectionEpoch, setEpoch] = useState(0);

  useEffect(() => {
    // Same-origin connection; the HTTP-only session cookie authenticates it.
    const s: LumosSocket = io({
      path: "/socket.io",
      withCredentials: true,
      reconnectionDelay: 800,
      reconnectionDelayMax: 8000,
    });
    let beat: ReturnType<typeof setInterval> | null = null;

    s.on("connect", () => {
      setStatus("connected");
      setEpoch((e) => e + 1);
      s.emit("presence:heartbeat");
      if (beat) clearInterval(beat);
      beat = setInterval(() => s.emit("presence:heartbeat"), HEARTBEAT_INTERVAL_MS);
    });
    s.on("disconnect", (reason) => {
      if (beat) clearInterval(beat);
      setStatus("reconnecting");
      // The server kicked us (logout elsewhere, idle sweep): reconnect manually.
      if (reason === "io server disconnect") setTimeout(() => s.connect(), 1500);
    });
    s.on("connect_error", (err) => {
      setStatus("reconnecting");
      if (err.message === "UNAUTHENTICATED") {
        s.disconnect();
        window.dispatchEvent(new CustomEvent("lumos:unauthenticated"));
      }
    });
    s.on("session:revoked", () => window.dispatchEvent(new CustomEvent("lumos:unauthenticated")));

    // The socket is an external resource owned by this effect; exposing it via state is intended.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSocket(s);
    return () => {
      if (beat) clearInterval(beat);
      s.removeAllListeners();
      s.disconnect();
      setSocket(null);
    };
  }, []);

  return <RealtimeContext.Provider value={{ socket, status, connectionEpoch }}>{children}</RealtimeContext.Provider>;
}
