"use client";

import { useSelectedLayoutSegment } from "next/navigation";
import { cn } from "@/lib/utils";
import { ConversationList } from "@/components/chat/conversation-list";

/** Two panes on desktop (list + thread); one at a time on phones. */
export default function ChatsLayout({ children }: { children: React.ReactNode }) {
  const segment = useSelectedLayoutSegment();
  const activeId = segment && segment !== "__PAGE__" ? segment : null;
  return (
    <div className="lg:flex lg:h-dvh">
      <aside
        className={cn(
          "border-border/70 lg:block lg:h-dvh lg:w-[22rem] lg:shrink-0 lg:border-r xl:w-[24rem]",
          activeId ? "hidden" : "block",
        )}
        aria-label="Conversations"
      >
        <ConversationList activeId={activeId} />
      </aside>
      <section className={cn("min-w-0 flex-1", activeId ? "block" : "hidden lg:block")}>{children}</section>
    </div>
  );
}
