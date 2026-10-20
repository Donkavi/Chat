"use client";

import { AnimatePresence, motion } from "motion/react";
import { AlertCircle, Check, CheckCheck, Clock3, RotateCw, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDayDivider, formatMessageTime } from "@/lib/format";
import { Avatar } from "@/components/ui/avatar";
import type { PublicUser } from "@/shared/types";
import type { LocalMessage } from "./use-conversation-messages";

const GROUP_GAP_MS = 5 * 60_000;

function sameGroup(a: LocalMessage | undefined, b: LocalMessage | undefined) {
  if (!a || !b || a.senderId !== b.senderId) return false;
  const ta = new Date(a.createdAt);
  const tb = new Date(b.createdAt);
  return Math.abs(tb.getTime() - ta.getTime()) < GROUP_GAP_MS && ta.toDateString() === tb.toDateString();
}

export function MessageList({
  messages,
  meId,
  other,
  otherLastReadAt,
  onRetry,
  onDiscard,
}: {
  messages: LocalMessage[];
  meId: string;
  other: PublicUser;
  otherLastReadAt: string | null;
  onRetry: (m: LocalMessage) => void;
  onDiscard: (m: LocalMessage) => void;
}) {
  const lastMineIdx = messages.findLastIndex((m) => m.senderId === meId);

  return (
    <ol className="flex flex-col px-3 sm:px-6" aria-label={`Messages with ${other.displayName}`}>
      <AnimatePresence initial={false}>
        {messages.map((m, i) => {
          const prev = messages[i - 1];
          const next = messages[i + 1];
          const mine = m.senderId === meId;
          const joinPrev = sameGroup(prev, m);
          const joinNext = sameGroup(m, next);
          const newDay = !prev || new Date(prev.createdAt).toDateString() !== new Date(m.createdAt).toDateString();
          const seen = mine && m.status === "sent" && !!otherLastReadAt && otherLastReadAt >= m.createdAt;
          const isLastMine = i === lastMineIdx;

          return (
            <motion.li
              key={m.clientId && mine ? `c:${m.clientId}` : m.id}
              layout="position"
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 520, damping: 36 }}
            >
              {newDay && (
                <div className="my-4 flex justify-center">
                  <span className="rounded-full border border-border bg-bg-elevated/90 px-3 py-1 text-xs font-semibold text-ink-muted shadow-soft">
                    {formatDayDivider(m.createdAt)}
                  </span>
                </div>
              )}
              <div className={cn("flex items-end gap-2", mine ? "justify-end" : "justify-start", joinPrev && !newDay ? "mt-0.5" : "mt-3")}>
                {!mine && (
                  <span className="hidden w-7 shrink-0 sm:block">
                    {!joinNext && <Avatar name={other.displayName} src={other.avatarUrl} seed={other.id} size="xs" />}
                  </span>
                )}
                <div className={cn("flex max-w-[80%] flex-col sm:max-w-[68%]", mine ? "items-end" : "items-start")}>
                  <div
                    className={cn(
                      "rounded-[1.25rem] px-3.5 py-2 text-[0.9375rem] leading-[1.45] break-words whitespace-pre-wrap shadow-[0_1px_1px_rgb(0_0_0/0.04)]",
                      mine ? "bg-bubble-out text-bubble-out-ink" : "bg-bubble-in text-bubble-in-ink",
                      mine && joinPrev && "rounded-tr-md",
                      mine && joinNext && "rounded-br-md",
                      !mine && joinPrev && "rounded-tl-md",
                      !mine && joinNext && "rounded-bl-md",
                      m.status === "sending" && "opacity-70",
                      m.status === "failed" && "bg-danger-soft text-ink ring-1 ring-danger/40",
                    )}
                  >
                    {m.content}
                  </div>

                  {m.status === "failed" ? (
                    <div className="mt-1 flex items-center gap-2 text-xs font-medium text-danger" role="alert">
                      <AlertCircle className="size-3.5" aria-hidden />
                      <span>{m.error ?? "Not delivered"}</span>
                      <button type="button" onClick={() => onRetry(m)} className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-semibold hover:bg-danger-soft">
                        <RotateCw className="size-3" aria-hidden /> Retry
                      </button>
                      <button type="button" onClick={() => onDiscard(m)} className="rounded-md p-0.5 hover:bg-danger-soft" aria-label="Discard message">
                        <X className="size-3.5" />
                      </button>
                    </div>
                  ) : (
                    (!joinNext || isLastMine) && (
                      <div className={cn("mt-1 flex items-center gap-1 px-1 text-[0.6875rem] text-ink-subtle tabular-nums", mine && "justify-end")}>
                        <time dateTime={m.createdAt}>{formatMessageTime(m.createdAt)}</time>
                        {mine && isLastMine && (
                          <span className="inline-flex items-center gap-0.5">
                            ·
                            {m.status === "sending" ? (
                              <>
                                <Clock3 className="size-3" aria-hidden /> Sending
                              </>
                            ) : seen ? (
                              <span className="inline-flex items-center gap-0.5 text-primary-ink">
                                <CheckCheck className="size-3.5" aria-hidden /> Seen
                              </span>
                            ) : (
                              <>
                                <Check className="size-3.5" aria-hidden /> Sent
                              </>
                            )}
                          </span>
                        )}
                      </div>
                    )
                  )}
                </div>
              </div>
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ol>
  );
}
