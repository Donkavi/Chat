import { Types } from "mongoose";
import { Conversation, type ConversationDoc } from "../models/Conversation";
import { Message, type MessageDoc } from "../models/Message";
import { AppError } from "@/lib/errors";
import { LIMITS, enforce } from "@/lib/rate-limit";
import type { ConversationDTO, MessageDTO, Paginated } from "@/shared/types";
import { emitToUser } from "../realtime/hub";
import { getBlockState } from "./blocks";
import { getMemberConversation, otherParticipant, toConversationDTO } from "./conversations";
import { toMessageDTO } from "./mappers";

export async function listMessages(
  conversationId: string,
  meId: Types.ObjectId,
  opts: { before?: string; after?: string; limit: number },
): Promise<Paginated<MessageDTO>> {
  const conv = await getMemberConversation(conversationId, meId);

  if (opts.after) {
    // Catch-up after a reconnect: everything newer than the last message the client has.
    const rows = await Message.find({ conversationId: conv._id, _id: { $gt: new Types.ObjectId(opts.after) } })
      .sort({ _id: 1 })
      .limit(opts.limit)
      .lean<MessageDoc[]>();
    return { items: rows.map(toMessageDTO), nextCursor: null };
  }

  const rows = await Message.find({
    conversationId: conv._id,
    ...(opts.before ? { _id: { $lt: new Types.ObjectId(opts.before) } } : {}),
  })
    .sort({ _id: -1 })
    .limit(opts.limit + 1)
    .lean<MessageDoc[]>();
  const page = rows.slice(0, opts.limit);
  return {
    items: page.reverse().map(toMessageDTO),
    nextCursor: rows.length > opts.limit ? String(page[0]._id) : null,
  };
}

export interface SendResult {
  message: MessageDTO;
  conversation: ConversationDTO;
  created: boolean;
}

/**
 * Persist a message, update the conversation, then fan it out to both
 * participants' personal rooms. The sender id always comes from the
 * authenticated session/socket, never from the payload.
 */
export async function sendMessage(
  senderId: Types.ObjectId,
  input: { conversationId: string; content: string; clientId: string },
): Promise<SendResult> {
  enforce(`msg:${senderId}`, LIMITS.messages, "You're sending messages too quickly.");
  const conv = await getMemberConversation(input.conversationId, senderId);
  const recipientId = otherParticipant(conv, senderId);

  const block = await getBlockState(senderId, recipientId);
  if (block.blockedByMe) throw new AppError("BLOCKED", "You blocked this person. Unblock them to send messages.");
  if (block.blockedMe) throw new AppError("BLOCKED", "You can't message this person.");

  // Idempotent retries: the same clientId from the same sender returns the original message.
  const existing = await Message.findOne({ senderId, clientId: input.clientId }).lean<MessageDoc>();
  if (existing) {
    if (!existing.conversationId.equals(conv._id)) throw new AppError("CONFLICT", "Duplicate message id.");
    return { message: toMessageDTO(existing), conversation: await toConversationDTO(conv, senderId), created: false };
  }

  let msg: MessageDoc;
  try {
    msg = (await Message.create({ conversationId: conv._id, senderId, content: input.content, clientId: input.clientId })).toObject();
  } catch (err) {
    if ((err as { code?: number }).code !== 11000) throw err;
    const dup = await Message.findOne({ senderId, clientId: input.clientId }).lean<MessageDoc>();
    if (!dup) throw err;
    return { message: toMessageDTO(dup), conversation: await toConversationDTO(conv, senderId), created: false };
  }

  const updated = await Conversation.findOneAndUpdate(
    { _id: conv._id },
    {
      $set: {
        lastMessage: { messageId: msg._id, senderId, content: msg.content.slice(0, 200), createdAt: msg.createdAt },
        lastMessageAt: msg.createdAt,
        activityAt: msg.createdAt,
        "members.$[me].lastReadAt": msg.createdAt,
        "members.$[me].unreadCount": 0,
      },
      $inc: { "members.$[them].unreadCount": 1 },
    },
    {
      arrayFilters: [{ "me.userId": senderId }, { "them.userId": recipientId }],
      returnDocument: "after",
    },
  ).lean<ConversationDoc>();
  if (!updated) throw new AppError("NOT_FOUND", "Conversation not found.");

  const message = toMessageDTO(msg);
  const [senderView, recipientView] = await Promise.all([
    toConversationDTO(updated, senderId),
    toConversationDTO(updated, recipientId),
  ]);
  emitToUser(String(senderId), "message:new", { message, conversation: senderView });
  emitToUser(String(recipientId), "message:new", { message, conversation: recipientView });

  return { message, conversation: senderView, created: true };
}
