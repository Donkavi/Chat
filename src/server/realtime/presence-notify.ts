import { User } from "../models/User";
import { PUBLIC_USER_FIELDS, toPublicUser, type PublicUserSource } from "../services/mappers";
import { emitToRoom, getIO, presenceRoom, userRoom } from "./hub";
import type { PresenceUpdate } from "@/shared/events";

export function presenceOf(u: PublicUserSource, now = Date.now()): PresenceUpdate {
  const pub = toPublicUser(u, now);
  return { userId: pub.id, isOnline: pub.isOnline, lastSeenAt: pub.lastSeenAt };
}

/** Push a user's current (privacy-filtered) presence to everyone subscribed to it. */
export async function broadcastPresence(userId: string) {
  if (!getIO()) return;
  const u = await User.findById(userId).select(PUBLIC_USER_FIELDS).lean<PublicUserSource>();
  if (!u) return;
  emitToRoom(presenceRoom(userId), "presence:update", presenceOf(u));
}

/** After a block, stop both users receiving each other's presence. */
export function severPresence(a: string, b: string) {
  const io = getIO();
  if (!io) return;
  io.in(userRoom(a)).socketsLeave(presenceRoom(b));
  io.in(userRoom(b)).socketsLeave(presenceRoom(a));
}
