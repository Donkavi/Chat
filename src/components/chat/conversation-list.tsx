"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { Search, MessageCircleHeart, Compass, Ban } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatConversationTime } from "@/lib/format";
import { Avatar } from "@/components/ui/avatar";
import { buttonClasses, Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useChats } from "@/components/providers/chat-provider";
import { useSession } from "@/components/providers/session-provider";
import { useLivePresence, useTrackPresence } from "@/components/providers/presence-provider";
import { useNow } from "@/components/hooks/use-now";
import type { ConversationDTO } from "@/shared/types";
import { TypingDots } from "./typing-dots";

function ConversationRow({ c, active, typing, meId }: { c: ConversationDTO; active: boolean; typing: boolean; meId: string }) {
  const live = useLivePresence(c.otherUser);
  const unread = c.unreadCount > 0 && !c.blockedByMe;
  const blocked = c.blockedByMe || c.blockedMe;
  const preview = c.lastMessage
    ? `${c.lastMessage.senderId === meId ? "You: " : ""}${c.lastMessage.content}`
    : "Say hello 👋";
  return (
    <Link
      href={`/chats/${c.id}`}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex items-center gap-3.5 rounded-2xl px-3 py-3 transition",
        active ? "bg-surface shadow-soft ring-1 ring-border" : "hover:bg-surface/70",
      )}
    >
      <Avatar name={c.otherUser.displayName} src={c.otherUser.avatarUrl} seed={c.otherUser.id} size="lg" online={!blocked && live.isOnline} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className={cn("truncate text-[0.9375rem] text-ink", unread ? "font-bold" : "font-semibold")}>{c.otherUser.displayName}</p>
          <time
            dateTime={c.activityAt}
            className={cn("shrink-0 text-xs tabular-nums", unread ? "font-semibold text-primary-ink" : "text-ink-subtle")}
          >
            {formatConversationTime(c.activityAt)}
          </time>
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-2">
          {typing && !blocked ? (
            <p className="flex items-center gap-1.5 text-sm font-medium text-primary">
              <TypingDots /> typing…
            </p>
          ) : (
            <p className={cn("truncate text-sm", unread ? "font-medium text-ink" : "text-ink-muted", !c.lastMessage && "italic")}>
              {c.blockedByMe ? (
                <span className="inline-flex items-center gap-1">
                  <Ban className="size-3.5" aria-hidden /> Blocked
                </span>
              ) : (
                preview
              )}
            </p>
          )}
          {unread && (
            <span className="inline-flex h-5.5 min-w-5.5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[0.6875rem] font-bold text-white tabular-nums">
              {c.unreadCount > 99 ? "99+" : c.unreadCount}
              <span className="sr-only"> unread</span>
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

export function ConversationList({ activeId }: { activeId: string | null }) {
  const { conversations, loaded, loadError, hasMore, loadMore, reload, typing } = useChats();
  const { me } = useSession();
  const [query, setQuery] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);
  useNow(60_000); // keep relative times fresh

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter(
      (c) => c.otherUser.displayName.toLowerCase().includes(q) || c.otherUser.username.includes(q),
    );
  }, [conversations, query]);

  useTrackPresence(conversations.slice(0, 60).map((c) => c.otherUser.id));

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pt-6 pb-3 sm:px-5 lg:pt-8">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">Chats</h1>
        <div className="relative mt-4">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2 text-ink-subtle" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search conversations"
            aria-label="Search conversations"
            className="h-11 w-full rounded-2xl border border-border bg-surface pr-4 pl-10 text-sm text-ink outline-none transition placeholder:text-ink-subtle focus:border-primary focus:ring-4 focus:ring-[var(--ring)]/20"
          />
        </div>
      </div>

      <div className="scrollbar-thin flex-1 overflow-y-auto px-2 pb-6 sm:px-3">
        {!loaded ? (
          <ul aria-busy="true" aria-label="Loading conversations" className="space-y-1">
            {Array.from({ length: 6 }).map((_, i) => (
              <li key={i} className="flex items-center gap-3.5 px-3 py-3">
                <div className="skeleton size-14 shrink-0 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-3.5 w-2/5 rounded-full" />
                  <div className="skeleton h-3 w-4/5 rounded-full" />
                </div>
              </li>
            ))}
          </ul>
        ) : loadError && conversations.length === 0 ? (
          <EmptyState
            title="Couldn't load your chats"
            description={loadError}
            action={
              <Button variant="secondary" onClick={() => void reload()}>
                Try again
              </Button>
            }
          />
        ) : conversations.length === 0 ? (
          <EmptyState
            icon={<MessageCircleHeart className="size-9" />}
            title="No conversations yet"
            description="Find someone interesting nearby and say hello. Your chats will show up here."
            action={
              <Link href="/discover" className={buttonClasses("primary")}>
                <Compass className="size-4.5" aria-hidden /> Discover people
              </Link>
            }
          />
        ) : filtered.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-ink-muted">No chats match “{query}”.</p>
        ) : (
          <motion.ul layout className="space-y-0.5">
            {filtered.map((c) => (
              <motion.li key={c.id} layout="position" transition={{ type: "spring", stiffness: 500, damping: 40 }}>
                <ConversationRow c={c} active={c.id === activeId} typing={!!typing[c.id]} meId={me.id} />
              </motion.li>
            ))}
          </motion.ul>
        )}
        {hasMore && !query && (
          <div className="mt-3 flex justify-center">
            <Button
              variant="ghost"
              size="sm"
              loading={loadingMore}
              onClick={async () => {
                setLoadingMore(true);
                await loadMore().catch(() => {});
                setLoadingMore(false);
              }}
            >
              Load older chats
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
