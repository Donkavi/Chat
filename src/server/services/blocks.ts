import { Types } from "mongoose";
import { Block } from "../models/Block";
import { User } from "../models/User";
import { AppError, notFound } from "@/lib/errors";
import { PUBLIC_USER_FIELDS, toPublicUser, type PublicUserSource } from "./mappers";
import type { PublicUser } from "@/shared/types";

const oid = (id: string | Types.ObjectId) => (typeof id === "string" ? new Types.ObjectId(id) : id);

/** Everyone this user has blocked or been blocked by. Used to filter discovery, chat and presence. */
export async function getBlockedIdsEitherWay(userId: string | Types.ObjectId): Promise<Types.ObjectId[]> {
  const me = oid(userId);
  const rows = await Block.find({ $or: [{ blockerId: me }, { blockedUserId: me }] })
    .select("blockerId blockedUserId")
    .lean();
  return rows.map((r) => (r.blockerId.equals(me) ? r.blockedUserId : r.blockerId));
}

export async function getBlockState(meId: string | Types.ObjectId, otherId: string | Types.ObjectId) {
  const me = oid(meId);
  const other = oid(otherId);
  const rows = await Block.find({
    $or: [
      { blockerId: me, blockedUserId: other },
      { blockerId: other, blockedUserId: me },
    ],
  })
    .select("blockerId")
    .lean();
  return {
    blockedByMe: rows.some((r) => r.blockerId.equals(me)),
    blockedMe: rows.some((r) => r.blockerId.equals(other)),
  };
}

export async function isBlockedEitherWay(a: string | Types.ObjectId, b: string | Types.ObjectId): Promise<boolean> {
  const s = await getBlockState(a, b);
  return s.blockedByMe || s.blockedMe;
}

export async function blockUser(meId: Types.ObjectId, targetId: string) {
  if (meId.equals(targetId)) throw new AppError("BAD_REQUEST", "You can't block yourself.");
  const exists = await User.exists({ _id: targetId });
  if (!exists) throw notFound("User not found.");
  // Upsert makes this idempotent and race-safe with the unique index.
  await Block.updateOne(
    { blockerId: meId, blockedUserId: oid(targetId) },
    { $setOnInsert: { blockerId: meId, blockedUserId: oid(targetId) } },
    { upsert: true },
  );
}

export async function unblockUser(meId: Types.ObjectId, targetId: string) {
  await Block.deleteOne({ blockerId: meId, blockedUserId: oid(targetId) });
}

export async function listBlockedUsers(meId: Types.ObjectId): Promise<PublicUser[]> {
  const rows = await Block.find({ blockerId: meId }).sort({ createdAt: -1 }).limit(500).lean();
  const users = await User.find({ _id: { $in: rows.map((r) => r.blockedUserId) } })
    .select(PUBLIC_USER_FIELDS)
    .lean<PublicUserSource[]>();
  const byId = new Map(users.map((u) => [String(u._id), u]));
  return rows
    .map((r) => byId.get(String(r.blockedUserId)))
    .filter((u): u is PublicUserSource => !!u)
    // Blocked people never see each other's presence.
    .map((u) => ({ ...toPublicUser(u), isOnline: false, lastSeenAt: null }));
}
