import type { Metadata } from "next";
import { MessagesSquare } from "lucide-react";

export const metadata: Metadata = { title: "Chats" };

/** Desktop placeholder for the thread pane (phones show the list instead). */
export default function ChatsIndexPage() {
  return (
    <div className="grid h-dvh place-items-center px-6">
      <div className="flex max-w-xs flex-col items-center text-center">
        <div className="relative mb-6 grid size-24 place-items-center">
          <span className="absolute inset-0 rotate-6 rounded-[2rem] bg-primary-soft" />
          <span className="absolute inset-0 rounded-[2rem] border border-border bg-surface shadow-soft" />
          <MessagesSquare className="relative size-10 text-primary" aria-hidden />
        </div>
        <h2 className="font-display text-xl font-semibold tracking-tight">Pick a conversation</h2>
        <p className="mt-2 text-[0.9375rem] text-ink-muted">Choose a chat from the list, or head to Discover to meet someone new.</p>
      </div>
    </div>
  );
}
