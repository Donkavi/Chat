"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/client/api";
import type { ConversationDTO, Paginated } from "@/shared/types";
import { useRealtime, useSocketEvent } from "./realtime-provider";
import { useSession } from "./session-provider";

type ConversationList = Paginated<ConversationDTO> & { unreadTotal: number };

interface ChatContextValue {
  conversations: ConversationDTO[];
  loaded: boolean;
  loadError: string | null;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  reload: () => Promise<void>;
  unreadTotal: number;
  upsert: (c: ConversationDTO) => void;
  get: (id: string) => ConversationDTO | undefined;
  /** Conversation currently open on screen — its incoming messages don't count as unread. */
  activeId: string | null;
  setActiveId: (id: string | null) => void;
  markRead: (id: string) => void;
  /** conversationId → typing flag of the other participant. */
  typing: Record<string, boolean>;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function useChats() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChats must be used inside <ChatProvider>");
  return ctx;
}

const TYPING_TTL_MS = 6000;

function sortByActivity(list: ConversationDTO[]) {
  return [...list].sort((a, b) => (a.activityAt < b.activityAt ? 1 : a.activityAt > b.activityAt ? -1 : 0));
}

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const { me } = useSession();
  const { connectionEpoch } = useRealtime();
  const [byId, setById] = useState<Record<string, ConversationDTO>>({});
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  /** Unread messages in conversations not loaded yet (beyond the first page). */
  const [hiddenUnread, setHiddenUnread] = useState(0);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [typing, setTyping] = useState<Record<string, boolean>>({});
  const typingTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const reload = useCallback(
    () =>
      api
        .get<ConversationList>("/api/conversations")
        .then((res) => {
          const map: Record<string, ConversationDTO> = {};
          let loadedUnread = 0;
          for (const c of res.items) {
            map[c.id] = c;
            loadedUnread += c.unreadCount;
          }
          setById(map);
          setCursor(res.nextCursor);
          setHiddenUnread(Math.max(0, res.unreadTotal - loadedUnread));
          setLoadError(null);
        })
        .catch((e) => setLoadError(e instanceof Error ? e.message : "Couldn't load your chats."))
        .finally(() => setLoaded(true)),
    [],
  );

  // Initial load + resync after every reconnect (we may have missed events).
  useEffect(() => {
    void reload();
  }, [reload, connectionEpoch]);

  const loadMore = useCallback(async () => {
    if (!cursor) return;
    const res = await api.get<ConversationList>(`/api/conversations?cursor=${encodeURIComponent(cursor)}`);
    setById((prev) => {
      const next = { ...prev };
      for (const c of res.items) if (!next[c.id]) next[c.id] = c;
      return next;
    });
    setHiddenUnread((h) => Math.max(0, h - res.items.reduce((n, c) => n + c.unreadCount, 0)));
    setCursor(res.nextCursor);
  }, [cursor]);

  const upsert = useCallback((c: ConversationDTO) => {
    setById((prev) => ({ ...prev, [c.id]: { ...prev[c.id], ...c } }));
  }, []);

  const clearTyping = useCallback((conversationId: string) => {
    const t = typingTimers.current.get(conversationId);
    if (t) clearTimeout(t);
    typingTimers.current.delete(conversationId);
    setTyping((prev) => (prev[conversationId] ? { ...prev, [conversationId]: false } : prev));
  }, []);

  // The open thread marks its own conversation read (see ChatThread), so the
  // server count is stored as-is here.
  useSocketEvent("message:new", ({ message, conversation }) => {
    upsert(conversation);
    if (message.senderId !== me.id) clearTyping(conversation.id);
  });

  useSocketEvent("conversation:updated", ({ conversation }) => upsert(conversation));

  useSocketEvent("conversation:removed", ({ conversationId }) => {
    setById((prev) => {
      const next = { ...prev };
      delete next[conversationId];
      return next;
    });
  });

  useSocketEvent("conversation:read", ({ conversationId, userId, lastReadAt }) => {
    setById((prev) => {
      const c = prev[conversationId];
      if (!c) return prev;
      const updated = userId === me.id ? { ...c, unreadCount: 0 } : { ...c, otherLastReadAt: lastReadAt };
      return { ...prev, [conversationId]: updated };
    });
  });

  useSocketEvent("typing:update", ({ conversationId, isTyping }) => {
    const existing = typingTimers.current.get(conversationId);
    if (existing) clearTimeout(existing);
    if (!isTyping) return clearTyping(conversationId);
    setTyping((prev) => ({ ...prev, [conversationId]: true }));
    typingTimers.current.set(
      conversationId,
      setTimeout(() => clearTyping(conversationId), TYPING_TTL_MS),
    );
  });

  useEffect(() => {
    const timers = typingTimers.current;
    return () => timers.forEach((t) => clearTimeout(t));
  }, []);

  const markRead = useCallback(
    (id: string) => {
      const c = byId[id];
      if (!c || c.unreadCount === 0) return;
      upsert({ ...c, unreadCount: 0 });
      api.post(`/api/conversations/${id}/read`).catch(() => {});
    },
    [byId, upsert],
  );

  const conversations = useMemo(() => sortByActivity(Object.values(byId)), [byId]);
  const unreadTotal = useMemo(
    () => hiddenUnread + conversations.reduce((n, c) => n + (c.blockedByMe ? 0 : c.unreadCount), 0),
    [conversations, hiddenUnread],
  );
  const get = useCallback((id: string) => byId[id], [byId]);

  const value = useMemo<ChatContextValue>(
    () => ({
      conversations,
      loaded,
      loadError,
      hasMore: !!cursor,
      loadMore,
      reload,
      unreadTotal,
      upsert,
      get,
      activeId,
      setActiveId,
      markRead,
      typing,
    }),
    [conversations, loaded, loadError, cursor, loadMore, reload, unreadTotal, upsert, get, activeId, markRead, typing],
  );
  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}
