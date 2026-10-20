import type { Server } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents } from "@/shared/events";

export interface SocketData {
  userId: string;
  sessionId: string;
  lastHeartbeatAt: number;
  presenceSubs: Set<string>;
  /** conversationId → other participant id, cached after a membership check. */
  memberships: Map<string, string>;
}

export type IO = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

/**
 * Process-wide handle to the Socket.IO server. The custom server sets it at
 * boot; Next.js route handlers (bundled separately, same process) read it via
 * globalThis to push events. Outside the custom server (e.g. `next build`,
 * unit tests) it's null and emits are no-ops.
 */
const g = globalThis as unknown as { __lumosIO?: IO | null };

export function setIO(io: IO | null) {
  g.__lumosIO = io;
}

export function getIO(): IO | null {
  return g.__lumosIO ?? null;
}

export const userRoom = (userId: string) => `user:${userId}`;
export const presenceRoom = (userId: string) => `presence:${userId}`;

type EventArgs<E extends keyof ServerToClientEvents> = Parameters<ServerToClientEvents[E]>;

/** Deliver an event to every connected tab/device of a user — and nobody else. */
export function emitToUser<E extends keyof ServerToClientEvents>(userId: string, event: E, ...args: EventArgs<E>) {
  const io = getIO();
  if (!io) return;
  (io.to(userRoom(userId)).emit as (ev: E, ...a: EventArgs<E>) => boolean)(event, ...args);
}

export function emitToRoom<E extends keyof ServerToClientEvents>(room: string, event: E, ...args: EventArgs<E>) {
  const io = getIO();
  if (!io) return;
  (io.to(room).emit as (ev: E, ...a: EventArgs<E>) => boolean)(event, ...args);
}

export function disconnectUser(userId: string) {
  getIO()?.in(userRoom(userId)).disconnectSockets(true);
}

/** Disconnect only the sockets that belong to one session (used on logout). */
export async function disconnectSession(userId: string, sessionId: string) {
  const io = getIO();
  if (!io) return;
  const sockets = await io.in(userRoom(userId)).fetchSockets();
  for (const s of sockets) if (s.data.sessionId === sessionId) s.disconnect(true);
}
