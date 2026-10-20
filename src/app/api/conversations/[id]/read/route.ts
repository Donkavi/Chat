import { authed } from "@/server/http";
import { markConversationRead } from "@/server/services/conversations";

export const POST = authed<{ id: string }>(async ({ user, params }) => markConversationRead(params.id, user._id));
