import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { Types } from "mongoose";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import { LIMITS, consume } from "@/lib/rate-limit";
import { SESSION_COOKIE, readCookie, resolveSession } from "@/lib/auth/session";
import { objectId, sendMessageSchema } from "@/lib/validation";
import { SOCKET_IDLE_TIMEOUT_MS } from "@/shared/constants";
import type { AckError } from "@/shared/events";
import { Conversation } from "../models/Conversation";
import { User } from "../models/User";
import { getBlockedIdsEitherWay, isBlockedEitherWay } from "../services/blocks";
import { sendMessage } from "../services/messages";
import { PUBLIC_USER_FIELDS, type PublicUserSource } from "../services/mappers";
import { emitToUser, presenceRoom, setIO, userRoom, type IO } from "./hub";
import { InMemoryPresenceStore, PresenceService, type PresenceStore } from "./presence";
import { broadcastPresence, presenceOf } from "./presence-notify";

const MAX_PRESENCE_SUBS = 200;
const MAX_MEMBERSHIP_CACHE = 200;

const conversationPayload = z.object({ conversationId: objectId });
const subscribePayload = z.object({ userIds: z.array(objectId).max(MAX_PRESENCE_SUBS) });

function toAckError(err: unknown): AckError {
  if (err instanceof AppError) return { code: err.code, message: err.message, retryAfterSec: err.retryAfterSec };
  console.error("[socket] unexpected error", err instanceof Error ? err.message : err);
  return { code: "INTERNAL", message: "Something went wrong. Please try again." };
}

export interface SocketServerOptions {
  allowedOrigins: string[];
  presenceStore?: PresenceStore;
}

export function createSocketServer(httpServer: HttpServer, opts: SocketServerOptions) {
  const io: IO = new Server(httpServer, {
    path: "/socket.io",
    serveClient: false,
    // Let Next.js handle its own HMR websocket upgrades on the same server.
    destroyUpgrade: false,
    maxHttpBufferSize: 32 * 1024,
    pingInterval: 20_000,
    pingTimeout: 20_000,
    cors: { origin: opts.allowedOrigins, credentials: true },
    // Browsers always send Origin on websocket/XHR; reject other sites (CSWSH).
    allowRequest: (req, cb) => {
      const origin = req.headers.origin;
      cb(null, !origin || opts.allowedOrigins.includes(origin));
    },
  });

  const presence = new PresenceService(opts.presenceStore ?? new InMemoryPresenceStore(), (userId) => {
    broadcastPresence(userId).catch(() => {});
  });

  // Authenticate every connection from the HTTP-only session cookie.
  io.use(async (socket, next) => {
    try {
      const token = readCookie(socket.request.headers.cookie, SESSION_COOKIE);
      const session = await resolveSession(token);
      if (!session) return next(new Error("UNAUTHENTICATED"));
      socket.data = {
        userId: String(session.user._id),
        sessionId: String(session.sessionId),
        lastHeartbeatAt: Date.now(),
        presenceSubs: new Set(),
        memberships: new Map(),
      };
      next();
    } catch {
      next(new Error("UNAVAILABLE"));
    }
  });

  io.on("connection", (socket) => {
    const { userId } = socket.data;
    const meOid = new Types.ObjectId(userId);
    // Each user only ever joins their own room; there is no client-driven room join.
    socket.join(userRoom(userId));
    presence.connected(userId, socket.id).catch((e) => console.error("[presence] connect failed", e?.message));

    /** Returns the other participant if `userId` belongs to the conversation. Cached per socket. */
    async function otherMember(conversationId: string): Promise<string | null> {
      const cached = socket.data.memberships.get(conversationId);
      if (cached) return cached;
      const conv = await Conversation.findOne({ _id: conversationId, participants: meOid }).select("participants").lean();
      if (!conv) return null;
      const other = String(conv.participants.find((p) => !p.equals(meOid)));
      if (socket.data.memberships.size >= MAX_MEMBERSHIP_CACHE) socket.data.memberships.clear();
      socket.data.memberships.set(conversationId, other);
      return other;
    }

    socket.on("presence:heartbeat", () => {
      socket.data.lastHeartbeatAt = Date.now();
      presence.heartbeat(userId).catch(() => {});
    });

    socket.on("presence:subscribe", async (payload, ack) => {
      if (typeof ack !== "function") return;
      const parsed = subscribePayload.safeParse(payload);
      if (!parsed.success) return ack({ ok: false, error: { code: "VALIDATION_FAILED", message: "Invalid user list." } });
      try {
        const blocked = new Set((await getBlockedIdsEitherWay(meOid)).map(String));
        const wanted = new Set(parsed.data.userIds.filter((id) => id !== userId && !blocked.has(id)));
        for (const id of socket.data.presenceSubs) if (!wanted.has(id)) socket.leave(presenceRoom(id));
        for (const id of wanted) socket.join(presenceRoom(id));
        socket.data.presenceSubs = wanted;
        const users = await User.find({ _id: { $in: [...wanted] } })
          .select(PUBLIC_USER_FIELDS)
          .lean<PublicUserSource[]>();
        const now = Date.now();
        ack({ ok: true, data: users.map((u) => presenceOf(u, now)) });
      } catch (err) {
        ack({ ok: false, error: toAckError(err) });
      }
    });

    socket.on("message:send", async (payload, ack) => {
      if (typeof ack !== "function") return;
      socket.data.lastHeartbeatAt = Date.now();
      const parsed = sendMessageSchema.safeParse(payload);
      if (!parsed.success) {
        return ack({ ok: false, error: { code: "VALIDATION_FAILED", message: parsed.error.issues[0]?.message ?? "Invalid message." } });
      }
      try {
        const res = await sendMessage(meOid, parsed.data);
        ack({ ok: true, data: { message: res.message, conversation: res.conversation } });
      } catch (err) {
        ack({ ok: false, error: toAckError(err) });
      }
    });

    const onTyping = (isTyping: boolean) => async (payload: unknown) => {
      const parsed = conversationPayload.safeParse(payload);
      if (!parsed.success) return;
      if (!consume(`typing:${userId}`, LIMITS.typing).ok) return;
      try {
        const other = await otherMember(parsed.data.conversationId);
        if (!other || (await isBlockedEitherWay(meOid, other))) return;
        emitToUser(other, "typing:update", { conversationId: parsed.data.conversationId, userId, isTyping });
      } catch {
        // Typing indicators are best-effort.
      }
    };
    socket.on("typing:start", onTyping(true));
    socket.on("typing:stop", onTyping(false));

    socket.on("disconnect", () => {
      presence.disconnected(userId, socket.id).catch((e) => console.error("[presence] disconnect failed", e?.message));
    });
  });

  // Drop half-open connections whose heartbeats stopped (e.g. a laptop lid closed).
  const sweeper = setInterval(() => {
    const cutoff = Date.now() - SOCKET_IDLE_TIMEOUT_MS;
    for (const s of io.of("/").sockets.values()) {
      if (s.data.lastHeartbeatAt < cutoff) s.disconnect(true);
    }
  }, 15_000);
  sweeper.unref();

  setIO(io);

  return {
    io,
    async close() {
      clearInterval(sweeper);
      presence.shutdown();
      setIO(null);
      await new Promise<void>((resolve) => io.close(() => resolve()));
    },
  };
}
