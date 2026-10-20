import { Types } from "mongoose";
import { User, type UserDoc } from "../models/User";
import { Conversation, participantsKeyFor } from "../models/Conversation";
import { Message } from "../models/Message";
import { Block } from "../models/Block";
import { Report } from "../models/Report";
import { Session } from "../models/Session";
import { PasswordResetToken } from "../models/PasswordResetToken";
import { AppError, notFound } from "@/lib/errors";
import { verifyPassword } from "@/lib/auth/password";
import type { PrivacyUpdateInput, ProfileUpdateInput } from "@/lib/validation";
import type { Me, ProfileView } from "@/shared/types";
import type { ReportReason } from "@/shared/report-reasons";
import { deleteStoredFile, processAvatar, storeAvatar } from "../storage";
import { disconnectUser, emitToUser } from "../realtime/hub";
import { broadcastPresence, severPresence } from "../realtime/presence-notify";
import { approximateDistanceBetween } from "./discovery";
import { blockUser, getBlockState, unblockUser } from "./blocks";
import { pushConversationUpdate } from "./conversations";
import { toMe, toPublicUser } from "./mappers";

async function loadMe(userId: Types.ObjectId): Promise<Me> {
  const u = await User.findById(userId).lean<UserDoc>();
  if (!u) throw notFound("Account not found.");
  return toMe(u);
}

export async function updateProfile(userId: Types.ObjectId, patch: ProfileUpdateInput): Promise<Me> {
  if (patch.username) {
    const taken = await User.exists({ username: patch.username, _id: { $ne: userId } });
    if (taken) throw new AppError("CONFLICT", "That username is taken.", { username: "That username is taken." });
  }
  try {
    await User.updateOne({ _id: userId }, { $set: patch }, { runValidators: true });
  } catch (err) {
    if ((err as { code?: number }).code === 11000) {
      throw new AppError("CONFLICT", "That username is taken.", { username: "That username is taken." });
    }
    throw err;
  }
  return loadMe(userId);
}

export async function updatePrivacy(userId: Types.ObjectId, patch: PrivacyUpdateInput): Promise<Me> {
  const $set: Record<string, boolean> = {};
  if (patch.isDiscoverable !== undefined) $set.isDiscoverable = patch.isDiscoverable;
  if (patch.showOnlineStatus !== undefined) $set["privacySettings.showOnlineStatus"] = patch.showOnlineStatus;
  if (patch.showAge !== undefined) $set["privacySettings.showAge"] = patch.showAge;
  await User.updateOne({ _id: userId }, { $set });
  if (patch.showOnlineStatus !== undefined) await broadcastPresence(String(userId));
  return loadMe(userId);
}

export async function setAvatar(user: UserDoc, upload: Buffer): Promise<Me> {
  const webp = await processAvatar(upload);
  const stored = await storeAvatar(webp);
  await User.updateOne({ _id: user._id }, { $set: { avatarUrl: stored.url, avatarKey: stored.key } });
  await deleteStoredFile(user.avatarKey);
  return loadMe(user._id);
}

export async function removeAvatar(user: UserDoc): Promise<Me> {
  await User.updateOne({ _id: user._id }, { $set: { avatarUrl: null, avatarKey: null } });
  await deleteStoredFile(user.avatarKey);
  return loadMe(user._id);
}

export async function getProfileView(viewer: UserDoc, targetId: string): Promise<ProfileView> {
  if (!Types.ObjectId.isValid(targetId)) throw notFound("User not found.");
  const target = await User.findById(targetId).lean<UserDoc>();
  if (!target) throw notFound("User not found.");
  const block = await getBlockState(viewer._id, target._id);
  // If they blocked you, they simply don't exist from your point of view.
  if (block.blockedMe) throw notFound("User not found.");

  const pub = toPublicUser(target);
  const conv = await Conversation.findOne({ participantsKey: participantsKeyFor(viewer._id, target._id) })
    .select("_id")
    .lean();
  const mine = new Set(viewer.interests.map((i) => i.toLowerCase()));
  const isSelf = viewer._id.equals(target._id);
  return {
    ...pub,
    ...(block.blockedByMe ? { isOnline: false, lastSeenAt: null } : {}),
    distanceKm: block.blockedByMe || isSelf ? null : approximateDistanceBetween(viewer, target),
    sharedInterests: isSelf ? [] : target.interests.filter((i) => mine.has(i.toLowerCase())),
    isBlockedByMe: block.blockedByMe,
    conversationId: conv ? String(conv._id) : null,
    joinedAt: target.createdAt.toISOString(),
  };
}

export async function block(me: UserDoc, targetId: string) {
  await blockUser(me._id, targetId);
  const other = new Types.ObjectId(targetId);
  severPresence(String(me._id), targetId);
  await pushConversationUpdate(me._id, other);
}

export async function unblock(me: UserDoc, targetId: string) {
  if (!Types.ObjectId.isValid(targetId)) throw notFound("User not found.");
  await unblockUser(me._id, targetId);
  await pushConversationUpdate(me._id, new Types.ObjectId(targetId));
}

export async function createReport(
  reporter: UserDoc,
  input: { userId: string; reason: ReportReason; details?: string; alsoBlock: boolean },
) {
  if (reporter._id.equals(input.userId)) throw new AppError("BAD_REQUEST", "You can't report yourself.");
  const target = await User.exists({ _id: input.userId });
  if (!target) throw notFound("User not found.");
  // Collapse repeat reports from the same person within a day into one record.
  const since = new Date(Date.now() - 24 * 60 * 60_000);
  await Report.findOneAndUpdate(
    { reporterId: reporter._id, reportedUserId: input.userId, status: "open", createdAt: { $gte: since } },
    {
      $set: { reason: input.reason, details: input.details || null },
      $setOnInsert: { reporterId: reporter._id, reportedUserId: input.userId, status: "open" },
    },
    { upsert: true },
  );
  if (input.alsoBlock) await block(reporter, input.userId);
}

/** Permanently delete an account and everything that only makes sense with it. */
export async function deleteAccount(user: UserDoc, password: string | undefined) {
  if (user.passwordHash && !(password && (await verifyPassword(user.passwordHash, password)))) {
    throw new AppError("VALIDATION_FAILED", "Incorrect password.", { password: "Incorrect password." });
  }
  const convs = await Conversation.find({ participants: user._id }).select("_id participants").lean();
  const convIds = convs.map((c) => c._id);

  await Message.deleteMany({ conversationId: { $in: convIds } });
  await Conversation.deleteMany({ _id: { $in: convIds } });
  await Block.deleteMany({ $or: [{ blockerId: user._id }, { blockedUserId: user._id }] });
  await Report.deleteMany({ reporterId: user._id });
  await PasswordResetToken.deleteMany({ userId: user._id });
  await Session.deleteMany({ userId: user._id });
  await User.deleteOne({ _id: user._id });
  await deleteStoredFile(user.avatarKey);

  for (const c of convs) {
    const other = c.participants.find((p) => !p.equals(user._id));
    if (other) emitToUser(String(other), "conversation:removed", { conversationId: String(c._id) });
  }
  emitToUser(String(user._id), "session:revoked");
  disconnectUser(String(user._id));
}

export { getBlockState };
