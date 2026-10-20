import { User } from "../models/User";
import { OFFLINE_GRACE_MS, PRESENCE_STALE_MS } from "@/shared/constants";

/**
 * Where live connections are counted. The in-memory store is correct for a
 * single server process. For multiple instances, implement this interface on
 * Redis (e.g. a SET per user with per-socket expiring keys) and add the
 * Socket.IO Redis adapter so room emits reach every instance.
 */
export interface PresenceStore {
  /** Register a socket; returns the user's live connection count afterwards. */
  add(userId: string, socketId: string): Promise<number>;
  /** Remove a socket; returns the user's live connection count afterwards. */
  remove(userId: string, socketId: string): Promise<number>;
  count(userId: string): Promise<number>;
}

export class InMemoryPresenceStore implements PresenceStore {
  private sockets = new Map<string, Set<string>>();

  async add(userId: string, socketId: string) {
    let set = this.sockets.get(userId);
    if (!set) this.sockets.set(userId, (set = new Set()));
    set.add(socketId);
    return set.size;
  }

  async remove(userId: string, socketId: string) {
    const set = this.sockets.get(userId);
    if (!set) return 0;
    set.delete(socketId);
    if (set.size === 0) this.sockets.delete(userId);
    return set.size;
  }

  async count(userId: string) {
    return this.sockets.get(userId)?.size ?? 0;
  }
}

/** lastSeenAt is persisted at most this often per user while they stay connected. */
const HEARTBEAT_WRITE_INTERVAL_MS = Math.floor(PRESENCE_STALE_MS / 2.5);

/**
 * Turns socket lifecycle into presence state with as few DB writes as possible:
 * one write when a user's first tab connects, one per ~48s of heartbeats, and
 * one when their last tab has been gone for the grace period.
 */
export class PresenceService {
  private lastWriteAt = new Map<string, number>();
  private offlineTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly store: PresenceStore,
    private readonly onChange: (userId: string) => void,
  ) {}

  /** On boot no sockets exist yet, so nobody can be online (single-instance assumption). */
  static async resetAll() {
    await User.updateMany({ isOnline: true }, { $set: { isOnline: false } });
  }

  async connected(userId: string, socketId: string) {
    const pendingOffline = this.offlineTimers.get(userId);
    if (pendingOffline) {
      clearTimeout(pendingOffline);
      this.offlineTimers.delete(userId);
    }
    const n = await this.store.add(userId, socketId);
    if (n === 1 && !pendingOffline) {
      await this.write(userId, true);
      this.onChange(userId);
    }
  }

  async heartbeat(userId: string) {
    const last = this.lastWriteAt.get(userId) ?? 0;
    if (Date.now() - last >= HEARTBEAT_WRITE_INTERVAL_MS) await this.write(userId, true);
  }

  async disconnected(userId: string, socketId: string) {
    const n = await this.store.remove(userId, socketId);
    if (n > 0 || this.offlineTimers.has(userId)) return;
    // Wait briefly so a page reload or flaky network doesn't flash "offline".
    const timer = setTimeout(async () => {
      this.offlineTimers.delete(userId);
      if ((await this.store.count(userId)) > 0) return;
      this.lastWriteAt.delete(userId);
      await this.write(userId, false).catch(() => {});
      this.onChange(userId);
    }, OFFLINE_GRACE_MS);
    timer.unref?.();
    this.offlineTimers.set(userId, timer);
  }

  private async write(userId: string, online: boolean) {
    const now = new Date();
    this.lastWriteAt.set(userId, now.getTime());
    await User.updateOne({ _id: userId }, { $set: { isOnline: online, lastSeenAt: now } });
  }

  shutdown() {
    for (const t of this.offlineTimers.values()) clearTimeout(t);
    this.offlineTimers.clear();
  }
}
