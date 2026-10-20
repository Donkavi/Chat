import { authed } from "@/server/http";
import { getMemberConversation, toConversationDTO } from "@/server/services/conversations";

export const GET = authed<{ id: string }>(async ({ user, params }) => {
  const conv = await getMemberConversation(params.id, user._id);
  return toConversationDTO(conv, user._id);
});
