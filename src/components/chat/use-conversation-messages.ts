"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError, newClientId } from "@/lib/client/api";
import { MESSAGES_PAGE_SIZE } from "@/shared/constants";
import type { ConversationDTO, MessageDTO, Paginated } from "@/shared/types";
import { useRealtime, useSocketEvent } from "@/components/providers/realtime-provider";
import { useChats } from "@/components/providers/chat-provider";
import { useSession } from "@/components/providers/session-provider";

export type MessageStatus = "sending" | "sent" | "failed";
export type LocalMessage = MessageDTO & { status: MessageStatus; error?: string };

const SEND_TIMEOUT_MS = 10_000;

function byTime(a: LocalMessage, b: LocalMessage) {
  // Pending messages always sit at the bottom until the server confirms them.
  if (a.status !== "sent" && b.status === "sent") return 1;
  if (b.status !== "sent" && a.status === "sent") return -1;
  return a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : a.id < b.id ? -1 : 1;
}

/**
 * Messages for one conversation: paginated history, live updates, catch-up
 * after reconnects, and optimistic sends that only show as delivered once the
 * server has persisted them (retries reuse the clientId, so they're idempotent).
 */
export function useConversationMessages(conversationId: string) {
  const { socket, connectionEpoch } = useRealtime();
  const { upsert } = useChats();
  const { me } = useSession();
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [olderCursor, setOlderCursor] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const messagesRef = useRef<LocalMessage[]>([]);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const merge = useCallback((incoming: MessageDTO[]) => {
    if (incoming.length === 0) return;
    setMessages((prev) => {
      const next = [...prev];
      for (const m of incoming) {
        if (next.some((p) => p.id === m.id)) continue;
        const pending = m.clientId ? next.findIndex((p) => p.clientId === m.clientId && p.senderId === m.senderId) : -1;
        if (pending >= 0) next[pending] = { ...m, status: "sent" };
        else next.push({ ...m, status: "sent" });
      }
      return next.sort(byTime);
    });
  }, []);

  const loadLatest = useCallback(async () => {
    try {
      const res = await api.get<Paginated<MessageDTO>>(`/api/conversations/${conversationId}/messages?limit=${MESSAGES_PAGE_SIZE}`);
      setMessages(res.items.map((m) => ({ ...m, status: "sent" as const })));
      setOlderCursor(res.nextCursor);
      setState("ready");
    } catch (e) {
      setError(e instanceof ApiError && e.status === 404 ? "This conversation doesn't exist or you don't have access to it." : e instanceof Error ? e.message : "Couldn't load messages.");
      setState("error");
    }
  }, [conversationId]);

  useEffect(() => {
    void loadLatest();
  }, [loadLatest]);

  // After a reconnect, fetch anything we missed while offline.
  const firstEpoch = useRef(connectionEpoch);
  useEffect(() => {
    if (connectionEpoch === firstEpoch.current || state !== "ready") return;
    const lastServer = [...messagesRef.current].reverse().find((m) => m.status === "sent");
    const url = lastServer
      ? `/api/conversations/${conversationId}/messages?after=${lastServer.id}&limit=100`
      : `/api/conversations/${conversationId}/messages?limit=${MESSAGES_PAGE_SIZE}`;
    api
      .get<Paginated<MessageDTO>>(url)
      .then((res) => merge(res.items))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionEpoch]);

  useSocketEvent("message:new", ({ message }) => {
    if (message.conversationId === conversationId) merge([message]);
  });

  const loadOlder = useCallback(async () => {
    if (!olderCursor || loadingOlder) return false;
    setLoadingOlder(true);
    try {
      const res = await api.get<Paginated<MessageDTO>>(
        `/api/conversations/${conversationId}/messages?before=${olderCursor}&limit=${MESSAGES_PAGE_SIZE}`,
      );
      merge(res.items);
      setOlderCursor(res.nextCursor);
      return true;
    } catch {
      return false;
    } finally {
      setLoadingOlder(false);
    }
  }, [conversationId, olderCursor, loadingOlder, merge]);

  const deliver = useCallback(
    async (content: string, clientId: string): Promise<{ message: MessageDTO; conversation: ConversationDTO }> => {
      if (socket?.connected) {
        return new Promise((resolve, reject) => {
          socket.timeout(SEND_TIMEOUT_MS).emit("message:send", { conversationId, content, clientId }, (err, res) => {
            if (err) return reject(new Error("The message took too long to send."));
            if (!res.ok) return reject(new ApiError(0, res.error.code, res.error.message));
            resolve(res.data);
          });
        });
      }
      // Socket down: fall back to HTTP so sending still works.
      return api.post(`/api/conversations/${conversationId}/messages`, { content, clientId });
    },
    [socket, conversationId],
  );

  const send = useCallback(
    async (content: string, retryClientId?: string) => {
      const clientId = retryClientId ?? newClientId();
      setMessages((prev) => {
        if (retryClientId) return prev.map((m) => (m.clientId === clientId ? { ...m, status: "sending", error: undefined } : m));
        return [
          ...prev,
          {
            id: `local:${clientId}`,
            conversationId,
            senderId: me.id,
            content,
            clientId,
            createdAt: new Date().toISOString(),
            status: "sending",
          },
        ];
      });
      try {
        const res = await deliver(content, clientId);
        merge([res.message]);
        upsert(res.conversation);
      } catch (e) {
        setMessages((prev) =>
          prev.map((m) =>
            m.clientId === clientId && m.status !== "sent"
              ? { ...m, status: "failed", error: e instanceof Error ? e.message : "Not delivered" }
              : m,
          ),
        );
      }
    },
    [conversationId, deliver, me.id, merge, upsert],
  );

  const retry = useCallback(
    (m: LocalMessage) => {
      if (m.clientId) void send(m.content, m.clientId);
    },
    [send],
  );

  const discard = useCallback((m: LocalMessage) => {
    setMessages((prev) => prev.filter((x) => x.id !== m.id));
  }, []);

  return { messages, state, error, hasOlder: !!olderCursor, loadingOlder, loadOlder, send, retry, discard, reload: loadLatest };
}
