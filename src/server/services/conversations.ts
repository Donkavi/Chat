import { Types } from "mongoose";
import { Conversation, participantsKeyFor, type ConversationDoc } from "../models/Conversation";
import { User } from "../models/User";
import { Block } from "../models/Block";
import { AppError, notFound } from "@/lib/errors";
import type { ConversationDTO, Paginated } from "@/shared/types";
import { PUBLIC_USER_FIELDS, deletedUserPlaceholder, toPublicUser, type PublicUserSource } from "./mappers";
import { getBlockState } from "./blocks";
import { emitToUser } from "../realtime/hub";

const PAGE_SIZE = 30;

export function otherParticipant(conv: Pick<ConversationDoc, "participants">, meId: Types.ObjectId | string): Types.ObjectId {
  const other = conv.participants.find((p) => !p.equals(meId));
  if (!other) throw new AppError("BAD_REQUEST", "Invalid conversation.");
  return other;
}

/**
 * Load a conversation only if `meId` is a participant. Non-members get the
 * same 404 as a missing id so conversation ids can't be probed.
 */
export async function getMemberConversation(conversationId: string, meId: Types.ObjectId | string) {
  if (!Types.ObjectId.isValid(conversationId)) throw notFound("Conversation not found.");
  const conv = await Conversation.findOne({ _id: conversationId, participants: meId }).lean<ConversationDoc>();
  if (!conv) throw notFound("Conversation not found.");
  return conv;
}

/** Build per-viewer DTOs in bulk (one users query + one blocks query). */
export async function toConversationDTOs(convs: ConversationDoc[], meId: Types.ObjectId): Promise<ConversationDTO[]> {
  if (convs.length === 0) return [];
  const otherIds = convs.map((c) => otherParticipant(c, meId));
  const [users, blocks] = await Promise.all([
    User.find({ _id: { $in: otherIds } }).select(PUBLIC_USER_FIELDS).lean<PublicUserSource[]>(),
    Block.find({
      $or: [
        { blockerId: meId, blockedUserId: { $in: otherIds } },
        { blockerId: { $in: otherIds }, blockedUserId: meId },
      ],
    })
      .select("blockerId blockedUserId")
      .lean(),
  ]);
  const usersById = new Map(users.map((u) => [String(u._id), u]));
  const now = Date.now();

  return convs.map((c, i) => {
    const otherId = String(otherIds[i]);
    const blockedByMe = blocks.some((b) => b.blockerId.equals(meId) && String(b.blockedUserId) === otherId);
    const blockedMe = blocks.some((b) => String(b.blockerId) === otherId);
    const src = usersById.get(otherId);
    let otherUser = src ? toPublicUser(src, now) : deletedUserPlaceholder(otherId);
    if (blockedByMe || blockedMe) otherUser = { ...otherUser, isOnline: false, lastSeenAt: null };
    const mine = c.members.find((m) => m.userId.equals(meId));
    const theirs = c.members.find((m) => String(m.userId) === otherId);
    return {
      id: String(c._id),
      otherUser,
      lastMessage: c.lastMessage
        ? {
            content: c.lastMessage.content,
            senderId: String(c.lastMessage.senderId),
            createdAt: new Date(c.lastMessage.createdAt).toISOString(),
          }
        : null,
      activityAt: new Date(c.activityAt).toISOString(),
      unreadCount: mine?.unreadCount ?? 0,
      otherLastReadAt: theirs?.lastReadAt ? new Date(theirs.lastReadAt).toISOString() : null,
      blockedByMe,
      blockedMe,
    };
  });
}

export async function toConversationDTO(conv: ConversationDoc, meId: Types.ObjectId) {
  return (await toConversationDTOs([conv], meId))[0];
}

/** Open the existing 1:1 conversation with `otherId`, or create it. Never creates duplicates. */
export async function getOrCreateConversation(meId: Types.ObjectId, otherId: string) {
  if (meId.equals(otherId)) throw new AppError("BAD_REQUEST", "You can't start a conversation with yourself.");
  const other = await User.exists({ _id: otherId });
  if (!other) throw notFound("User not found.");
  const block = await getBlockState(meId, otherId);
  if (block.blockedByMe) throw new AppError("BLOCKED", "Unblock this person to message them.");
  if (block.blockedMe) throw notFound("User not found.");

  const otherOid = new Types.ObjectId(otherId);
  const key = participantsKeyFor(meId, otherOid);
  const now = new Date();
  let conv: ConversationDoc | null;
  try {
    conv = await Conversation.findOneAndUpdate(
      { participantsKey: key },
      {
        $setOnInsert: {
          participants: [meId, otherOid],
          participantsKey: key,
          members: [
            { userId: meId, unreadCount: 0, lastReadAt: now },
            { userId: otherOid, unreadCount: 0, lastReadAt: null },
          ],
          createdBy: meId,
          lastMessage: null,
          lastMessageAt: null,
          activityAt: now,
        },
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: false },
    ).lean<ConversationDoc>();
  } catch (err) {
    // Two concurrent upserts can race on the unique key; the loser just reads the winner's doc.
    if ((err as { code?: number }).code !== 11000) throw err;
    conv = await Conversation.findOne({ participantsKey: key }).lean<ConversationDoc>();
  }
  if (!conv) throw new AppError("INTERNAL", "Could not open the conversation.");
  return toConversationDTO(conv, meId);
}

function encodeCursor(c: Pick<ConversationDoc, "_id" | "activityAt">) {
  return `${new Date(c.activityAt).getTime()}_${String(c._id)}`;
}

function decodeCursor(cursor: string | undefined) {
  if (!cursor) return null;
  const m = /^(\d{1,15})_([a-f0-9]{24})$/.exec(cursor);
  if (!m) throw new AppError("BAD_REQUEST", "Invalid cursor.");
  return { at: new Date(Number(m[1])), id: new Types.ObjectId(m[2]) };
}

export async function listConversations(
  meId: Types.ObjectId,
  cursor?: string,
): Promise<Paginated<ConversationDTO> & { unreadTotal: number }> {
  const after = decodeCursor(cursor);
  const and: Record<string, unknown>[] = [
    { participants: meId },
    // Don't surface a conversation to the other person until a message is actually sent.
    { $or: [{ lastMessageAt: { $ne: null } }, { createdBy: meId }] },
  ];
  if (after) {
    and.push({ $or: [{ activityAt: { $lt: after.at } }, { activityAt: after.at, _id: { $lt: after.id } }] });
  }
  const [rows, unread] = await Promise.all([
    Conversation.find({ $and: and })
      .sort({ activityAt: -1, _id: -1 })
      .limit(PAGE_SIZE + 1)
      .lean<ConversationDoc[]>(),
    unreadTotal(meId),
  ]);
  const page = rows.slice(0, PAGE_SIZE);
  return {
    items: await toConversationDTOs(page, meId),
    nextCursor: rows.length > PAGE_SIZE ? encodeCursor(page[page.length - 1]) : null,
    unreadTotal: unread,
  };
}

export async function unreadTotal(meId: Types.ObjectId): Promise<number> {
  const [res] = await Conversation.aggregate<{ total: number }>([
    { $match: { participants: meId } },
    { $unwind: "$members" },
    { $match: { "members.userId": meId, "members.unreadCount": { $gt: 0 } } },
    { $group: { _id: null, total: { $sum: "$members.unreadCount" } } },
  ]);
  return res?.total ?? 0;
}

/** Mark everything in a conversation as read by `meId` and tell the other side (read receipts). */
export async function markConversationRead(conversationId: string, meId: Types.ObjectId) {
  const conv = await getMemberConversation(conversationId, meId);
  const now = new Date();
  await Conversation.updateOne(
    { _id: conv._id, "members.userId": meId },
    { $set: { "members.$.unreadCount": 0, "members.$.lastReadAt": now } },
  );
  const payload = { conversationId: String(conv._id), userId: String(meId), lastReadAt: now.toISOString() };
  const other = otherParticipant(conv, meId);
  emitToUser(String(meId), "conversation:read", payload);
  // Don't leak read activity across a block.
  const block = await getBlockState(meId, other);
  if (!block.blockedByMe && !block.blockedMe) emitToUser(String(other), "conversation:read", payload);
  return payload;
}

/** Re-send fresh DTOs to both participants (e.g. after block/unblock). */
export async function pushConversationUpdate(meId: Types.ObjectId, otherId: Types.ObjectId) {
  const conv = await Conversation.findOne({ participantsKey: participantsKeyFor(meId, otherId) }).lean<ConversationDoc>();
  if (!conv) return;
  const [mine, theirs] = await Promise.all([toConversationDTO(conv, meId), toConversationDTO(conv, otherId)]);
  emitToUser(String(meId), "conversation:updated", { conversation: mine });
  if (conv.lastMessageAt) emitToUser(String(otherId), "conversation:updated", { conversation: theirs });
}
