import { z } from "zod";
import { createConversationSchema } from "@/lib/validation";
import { LIMITS, enforce } from "@/lib/rate-limit";
import { authed, readJson, readQuery } from "@/server/http";
import { getOrCreateConversation, listConversations } from "@/server/services/conversations";

export const GET = authed(async ({ req, user }) => {
  const { cursor } = readQuery(req, z.object({ cursor: z.string().max(64).optional() }));
  return listConversations(user._id, cursor);
});

/** Open the conversation with a user, creating it only if none exists yet. */
export const POST = authed(async ({ req, user }) => {
  enforce(`conv:${user._id}`, LIMITS.conversationsCreate, "You're starting conversations too quickly.");
  const { userId } = await readJson(req, createConversationSchema);
  return getOrCreateConversation(user._id, userId);
});
