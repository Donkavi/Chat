"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client/api";
import { useToast } from "@/components/ui/toast";
import { useChats } from "@/components/providers/chat-provider";
import type { ConversationDTO } from "@/shared/types";

/** Open (or create) the conversation with a user and navigate to it. */
export function useStartChat() {
  const router = useRouter();
  const toast = useToast();
  const { upsert } = useChats();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const start = useCallback(
    async (userId: string) => {
      setPendingId(userId);
      try {
        const conv = await api.post<ConversationDTO>("/api/conversations", { userId });
        upsert(conv);
        router.push(`/chats/${conv.id}`);
      } catch (e) {
        toast.error("Couldn't start the chat", e instanceof Error ? e.message : undefined);
        setPendingId(null);
      }
    },
    [router, toast, upsert],
  );

  return { start, pendingId };
}
