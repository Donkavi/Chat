import type { ConversationDTO, MessageDTO } from "./types";

/** Typed Socket.IO contract shared by the browser and the realtime server. */

export type AckError = { code: string; message: string; retryAfterSec?: number };
export type Ack<T> = (res: { ok: true; data: T } | { ok: false; error: AckError }) => void;

export interface PresenceUpdate {
  userId: string;
  isOnline: boolean;
  lastSeenAt: string | null;
}

export interface ServerToClientEvents {
  "message:new": (p: { message: MessageDTO; conversation: ConversationDTO }) => void;
  "conversation:updated": (p: { conversation: ConversationDTO }) => void;
  "conversation:removed": (p: { conversationId: string }) => void;
  "conversation:read": (p: { conversationId: string; userId: string; lastReadAt: string }) => void;
  "typing:update": (p: { conversationId: string; userId: string; isTyping: boolean }) => void;
  "presence:update": (p: PresenceUpdate) => void;
  "session:revoked": () => void;
}

export interface ClientToServerEvents {
  "message:send": (
    p: { conversationId: string; content: string; clientId: string },
    ack: Ack<{ message: MessageDTO; conversation: ConversationDTO }>,
  ) => void;
  "typing:start": (p: { conversationId: string }) => void;
  "typing:stop": (p: { conversationId: string }) => void;
  "presence:heartbeat": () => void;
  /** Replace this socket's presence subscriptions with the given user ids. */
  "presence:subscribe": (p: { userIds: string[] }, ack: Ack<PresenceUpdate[]>) => void;
}
