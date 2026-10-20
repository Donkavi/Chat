import type { Metadata } from "next";
import { ChatThread } from "@/components/chat/chat-thread";

export const metadata: Metadata = { title: "Chat" };

export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ChatThread key={id} conversationId={id} />;
}
