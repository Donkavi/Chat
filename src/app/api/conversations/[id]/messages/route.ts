import { NextResponse } from "next/server";
import { z } from "zod";
import { clientIdSchema, messageContentSchema, messagesQuerySchema } from "@/lib/validation";
import { authed, readJson, readQuery } from "@/server/http";
import { listMessages, sendMessage } from "@/server/services/messages";

export const GET = authed<{ id: string }>(async ({ req, user, params }) => {
  const q = readQuery(req, messagesQuerySchema);
  return listMessages(params.id, user._id, q);
});

/** HTTP fallback for sending; the socket `message:send` event is the primary path. */
export const POST = authed<{ id: string }>(async ({ req, user, params }) => {
  const body = await readJson(req, z.object({ content: messageContentSchema, clientId: clientIdSchema }));
  const res = await sendMessage(user._id, { conversationId: params.id, ...body });
  return NextResponse.json(
    { data: { message: res.message, conversation: res.conversation } },
    { status: res.created ? 201 : 200 },
  );
});
