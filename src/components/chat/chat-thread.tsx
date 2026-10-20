"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowDown, ArrowLeft, Ban, MoreVertical, ShieldAlert, UserRound, UserCheck } from "lucide-react";
import { api, ApiError } from "@/lib/client/api";
import { formatLastSeen } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { Button, buttonClasses } from "@/components/ui/button";
import { Menu } from "@/components/ui/menu";
import { Spinner } from "@/components/ui/spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { useChats } from "@/components/providers/chat-provider";
import { useSession } from "@/components/providers/session-provider";
import { useRealtime } from "@/components/providers/realtime-provider";
import { useLivePresence, useTrackPresence } from "@/components/providers/presence-provider";
import { useNow } from "@/components/hooks/use-now";
import { ProfileSheet } from "@/components/people/profile-sheet";
import { BlockDialog, ReportDialog } from "@/components/people/safety-dialogs";
import type { ConversationDTO } from "@/shared/types";
import { Composer, type ComposerHandle } from "./composer";
import { Icebreakers } from "./icebreakers";
import { MessageList } from "./message-list";
import { TypingDots } from "./typing-dots";
import { useConversationMessages } from "./use-conversation-messages";

/**
 * Track the visual viewport so the composer stays above the on-screen keyboard
 * on mobile browsers that don't resize the layout viewport (iOS Safari).
 */
function useVisualViewportHeight() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement;
    const update = () => {
      root.style.setProperty("--vvh", `${vv.height}px`);
      if (window.scrollY !== 0) window.scrollTo(0, 0);
    };
    update();
    vv.addEventListener("resize", update);
    return () => {
      vv.removeEventListener("resize", update);
      root.style.removeProperty("--vvh");
    };
  }, []);
}

const NEAR_BOTTOM_PX = 140;

export function ChatThread({ conversationId }: { conversationId: string }) {
  const { me } = useSession();
  const { socket } = useRealtime();
  const chats = useChats();
  const toast = useToast();
  const [fallbackConv, setFallbackConv] = useState<ConversationDTO | null>(null);
  const [convError, setConvError] = useState<string | null>(null);
  const conversation = chats.get(conversationId) ?? fallbackConv;
  const { messages, state, error, hasOlder, loadingOlder, loadOlder, send, retry, discard } = useConversationMessages(conversationId);
  const [profileOpen, setProfileOpen] = useState(false);
  const [dialog, setDialog] = useState<"block" | "report" | null>(null);
  const [unblocking, setUnblocking] = useState(false);
  const [showJump, setShowJump] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const topSentinel = useRef<HTMLDivElement>(null);
  const composer = useRef<ComposerHandle>(null);
  const prepend = useRef<{ height: number; top: number } | null>(null);
  const lastMessageKey = useRef<string | null>(null);
  const didInitialScroll = useRef(false);
  useNow(30_000);
  useVisualViewportHeight();

  // Deep link to a conversation not in the loaded list yet.
  useEffect(() => {
    if (chats.get(conversationId)) return;
    api
      .get<ConversationDTO>(`/api/conversations/${conversationId}`)
      .then((c) => {
        setFallbackConv(c);
        chats.upsert(c);
      })
      .catch((e) => setConvError(e instanceof ApiError && e.status === 404 ? "This conversation doesn't exist or you don't have access to it." : "Couldn't open this conversation."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  useEffect(() => {
    chats.setActiveId(conversationId);
    return () => chats.setActiveId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  // Read receipts: mark read whenever unread messages arrive while the thread is visible.
  const unread = conversation?.unreadCount ?? 0;
  const { markRead } = chats;
  useEffect(() => {
    if (unread === 0) return;
    const tryMark = () => document.visibilityState === "visible" && markRead(conversationId);
    tryMark();
    document.addEventListener("visibilitychange", tryMark);
    return () => document.removeEventListener("visibilitychange", tryMark);
  }, [unread, conversationId, markRead]);

  const other = conversation?.otherUser;
  useTrackPresence(other ? [other.id] : []);
  const live = useLivePresence(other);
  const isTyping = !!chats.typing[conversationId];
  const blocked = !!conversation && (conversation.blockedByMe || conversation.blockedMe);

  const isNearBottom = () => {
    const el = scroller.current;
    return !el || el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
  };
  const scrollToBottom = (smooth: boolean) => {
    const el = scroller.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  };

  // Scroll management: initial jump, keep position when older messages load, follow new ones.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el || state !== "ready") return;
    if (prepend.current) {
      el.scrollTop = el.scrollHeight - prepend.current.height + prepend.current.top;
      prepend.current = null;
      return;
    }
    const last = messages[messages.length - 1];
    const key = last ? (last.clientId ?? last.id) : null;
    if (!didInitialScroll.current) {
      didInitialScroll.current = true;
      lastMessageKey.current = key;
      scrollToBottom(false);
      return;
    }
    if (key && key !== lastMessageKey.current) {
      lastMessageKey.current = key;
      if (last.senderId === me.id || isNearBottom()) scrollToBottom(true);
      // Depends on a DOM measurement taken in this layout effect.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      else setShowJump(true);
    }
  }, [messages, state, me.id]);

  useEffect(() => {
    if (isTyping && isNearBottom()) scrollToBottom(true);
  }, [isTyping]);

  // Infinite scroll upwards.
  const onReachTop = useCallback(async () => {
    const el = scroller.current;
    if (!el || !hasOlder || loadingOlder) return;
    prepend.current = { height: el.scrollHeight, top: el.scrollTop };
    const ok = await loadOlder();
    if (!ok) prepend.current = null;
  }, [hasOlder, loadingOlder, loadOlder]);

  useEffect(() => {
    const target = topSentinel.current;
    if (!target || !scroller.current) return;
    const io = new IntersectionObserver((entries) => entries[0]?.isIntersecting && void onReachTop(), {
      root: scroller.current,
      rootMargin: "200px 0px 0px 0px",
    });
    io.observe(target);
    return () => io.disconnect();
  }, [onReachTop, state]);

  const onTyping = useCallback(
    (typing: boolean) => {
      if (blocked) return;
      socket?.emit(typing ? "typing:start" : "typing:stop", { conversationId });
    },
    [socket, conversationId, blocked],
  );

  if (convError || (state === "error" && !conversation)) {
    return (
      <div className="grid h-dvh place-items-center">
        <EmptyState
          title="Conversation not found"
          description={convError ?? error ?? undefined}
          action={
            <Link href="/chats" className={buttonClasses("secondary")}>
              Back to chats
            </Link>
          }
        />
      </div>
    );
  }

  const firstName = other?.displayName.split(" ")[0] ?? "";
  const statusLine = !other ? "" : blocked ? "" : isTyping ? "typing" : live.isOnline ? "Online" : formatLastSeen(live.lastSeenAt);

  return (
    <div className="flex h-[var(--vvh,100dvh)] flex-col bg-bg lg:!h-dvh lg:bg-transparent">
      {/* Header */}
      <header className="z-20 flex items-center gap-2 border-b border-border/70 bg-bg-elevated/85 px-2 py-2.5 pt-[max(0.625rem,env(safe-area-inset-top))] backdrop-blur-xl sm:px-4">
        <Link href="/chats" className={buttonClasses("ghost", "icon", "lg:hidden")} aria-label="Back to chats">
          <ArrowLeft className="size-5" />
        </Link>
        {other ? (
          <button
            type="button"
            onClick={() => setProfileOpen(true)}
            className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl px-1.5 py-1 text-left transition hover:bg-surface-2/70"
          >
            <Avatar name={other.displayName} src={other.avatarUrl} seed={other.id} size="md" online={!blocked && live.isOnline} />
            <span className="min-w-0">
              <span className="block truncate font-semibold text-ink">{other.displayName}</span>
              <span className={cn("flex h-4.5 items-center gap-1.5 text-xs", statusLine === "typing" ? "text-primary" : live.isOnline ? "text-online" : "text-ink-muted")}>
                {statusLine === "typing" ? (
                  <>
                    <TypingDots /> typing…
                  </>
                ) : (
                  statusLine
                )}
              </span>
            </span>
          </button>
        ) : (
          <div className="flex flex-1 items-center gap-3 px-1.5">
            <div className="skeleton size-11 rounded-full" />
            <div className="skeleton h-4 w-32 rounded-full" />
          </div>
        )}
        {other && (
          <Menu
            label="Conversation options"
            items={[
              { label: "View profile", icon: <UserRound />, onSelect: () => setProfileOpen(true) },
              ...(conversation?.blockedByMe ? [] : [{ label: "Block", icon: <Ban />, onSelect: () => setDialog("block"), tone: "danger" as const }]),
              { label: "Report", icon: <ShieldAlert />, onSelect: () => setDialog("report"), tone: "danger" as const },
            ]}
            trigger={({ toggle, open, id }) => (
              <Button variant="ghost" size="icon" onClick={toggle} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? id : undefined} aria-label="Conversation options">
                <MoreVertical className="size-5" />
              </Button>
            )}
          />
        )}
      </header>

      {/* Messages */}
      <div className="relative min-h-0 flex-1">
        <div ref={scroller} className="scrollbar-thin h-full overflow-y-auto overscroll-contain pb-4" onScroll={() => showJump && isNearBottom() && setShowJump(false)}>
          <div ref={topSentinel} className="h-1" aria-hidden />
          {loadingOlder && (
            <div className="flex justify-center py-3 text-ink-subtle">
              <Spinner className="size-5" />
            </div>
          )}
          {!hasOlder && state === "ready" && messages.length > 0 && other && (
            <p className="px-6 pt-6 pb-2 text-center text-xs text-ink-subtle">
              This is the beginning of your conversation with {other.displayName}.
            </p>
          )}
          {state === "loading" ? (
            <div className="space-y-3 px-4 py-6 sm:px-6" aria-busy="true" aria-label="Loading messages">
              {[48, 64, 36, 56, 44].map((w, i) => (
                <div key={i} className={cn("flex", i % 2 ? "justify-end" : "justify-start")}>
                  <div className="skeleton h-10 rounded-[1.25rem]" style={{ width: `${w}%` }} />
                </div>
              ))}
            </div>
          ) : state === "error" ? (
            <EmptyState title="Couldn't load messages" description={error ?? undefined} />
          ) : messages.length === 0 && other ? (
            blocked ? null : <Icebreakers other={other} myInterests={me.interests} onPick={(t) => composer.current?.fill(t)} />
          ) : (
            other && (
              <MessageList
                messages={messages}
                meId={me.id}
                other={other}
                otherLastReadAt={conversation?.otherLastReadAt ?? null}
                onRetry={retry}
                onDiscard={discard}
              />
            )
          )}
          <AnimatePresence>
            {isTyping && !blocked && other && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                className="mt-2 flex items-end gap-2 px-3 sm:px-6"
                aria-live="polite"
              >
                <span className="hidden w-7 sm:block">
                  <Avatar name={other.displayName} src={other.avatarUrl} seed={other.id} size="xs" />
                </span>
                <span className="inline-flex h-9 items-center rounded-[1.25rem] bg-bubble-in px-4 text-ink-muted">
                  <TypingDots />
                  <span className="sr-only">{firstName} is typing</span>
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {showJump && (
            <motion.button
              type="button"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              onClick={() => {
                scrollToBottom(true);
                setShowJump(false);
              }}
              className="absolute bottom-4 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-bg shadow-lift"
            >
              <ArrowDown className="size-4" aria-hidden /> New messages
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Composer / blocked notice */}
      <div className="border-t border-border/70 bg-bg-elevated/85 px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl sm:px-6">
        {conversation?.blockedByMe ? (
          <div className="flex flex-col items-center gap-3 py-1 text-center sm:flex-row sm:text-left">
            <p className="flex-1 text-sm text-ink-muted">You blocked {firstName}. Unblock them to send messages.</p>
            <Button
              variant="secondary"
              size="sm"
              loading={unblocking}
              onClick={async () => {
                if (!other) return;
                setUnblocking(true);
                try {
                  await api.delete(`/api/users/${other.id}/block`);
                  chats.upsert({ ...conversation, blockedByMe: false });
                  toast.success(`${other.displayName} is unblocked`);
                } catch (e) {
                  toast.error("Couldn't unblock", e instanceof Error ? e.message : undefined);
                } finally {
                  setUnblocking(false);
                }
              }}
            >
              <UserCheck className="size-4" aria-hidden /> Unblock
            </Button>
          </div>
        ) : conversation?.blockedMe ? (
          <p className="py-2 text-center text-sm text-ink-muted">You can&apos;t reply to this conversation.</p>
        ) : (
          <Composer
            ref={composer}
            onSend={(t) => void send(t)}
            onTyping={onTyping}
            placeholder={other ? `Message ${firstName}…` : "Message…"}
            disabled={!other || state !== "ready"}
          />
        )}
      </div>

      {other && (
        <>
          <ProfileSheet userId={profileOpen ? other.id : null} preview={other} onClose={() => setProfileOpen(false)} hideMessageAction />
          <BlockDialog
            open={dialog === "block"}
            onClose={() => setDialog(null)}
            user={other}
            onBlocked={() => conversation && chats.upsert({ ...conversation, blockedByMe: true })}
          />
          <ReportDialog
            open={dialog === "report"}
            onClose={() => setDialog(null)}
            user={other}
            onBlocked={() => conversation && chats.upsert({ ...conversation, blockedByMe: true })}
          />
        </>
      )}
    </div>
  );
}
