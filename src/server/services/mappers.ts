import type { UserDoc } from "../models/User";
import type { MessageDoc } from "../models/Message";
import type { Me, MessageDTO, PublicUser } from "@/shared/types";
import { PRESENCE_STALE_MS } from "@/shared/constants";

/** The fields needed to build a PublicUser. Use with `.select(PUBLIC_USER_FIELDS)`. */
export const PUBLIC_USER_FIELDS =
  "_id username displayName avatarUrl bio interests age isOnline lastSeenAt privacySettings" as const;

export type PublicUserSource = Pick<
  UserDoc,
  "_id" | "username" | "displayName" | "avatarUrl" | "bio" | "interests" | "age" | "isOnline" | "lastSeenAt" | "privacySettings"
>;

/** Live presence: the flag alone isn't trusted — the heartbeat must also be fresh. */
export function isEffectivelyOnline(u: Pick<UserDoc, "isOnline" | "lastSeenAt">, now = Date.now()): boolean {
  return !!u.isOnline && !!u.lastSeenAt && now - new Date(u.lastSeenAt).getTime() < PRESENCE_STALE_MS;
}

export function toPublicUser(u: PublicUserSource, now = Date.now()): PublicUser {
  const showStatus = u.privacySettings?.showOnlineStatus !== false;
  const showAge = u.privacySettings?.showAge !== false;
  return {
    id: String(u._id),
    username: u.username,
    displayName: u.displayName,
    avatarUrl: u.avatarUrl ?? null,
    bio: u.bio ?? "",
    interests: u.interests ?? [],
    age: showAge ? (u.age ?? null) : null,
    isOnline: showStatus && isEffectivelyOnline(u, now),
    lastSeenAt: showStatus && u.lastSeenAt ? new Date(u.lastSeenAt).toISOString() : null,
  };
}

/** Shown when the other participant deleted their account. */
export function deletedUserPlaceholder(id: string): PublicUser {
  return {
    id,
    username: "deleted",
    displayName: "Deleted account",
    avatarUrl: null,
    bio: "",
    interests: [],
    age: null,
    isOnline: false,
    lastSeenAt: null,
  };
}

export function toMe(u: UserDoc): Me {
  return {
    id: String(u._id),
    email: u.email,
    username: u.username,
    displayName: u.displayName,
    avatarUrl: u.avatarUrl ?? null,
    bio: u.bio ?? "",
    interests: u.interests ?? [],
    age: u.age ?? null,
    isDiscoverable: u.isDiscoverable,
    isLocationSharingEnabled: u.isLocationSharingEnabled,
    locationUpdatedAt: u.locationUpdatedAt ? u.locationUpdatedAt.toISOString() : null,
    privacySettings: {
      showOnlineStatus: u.privacySettings?.showOnlineStatus !== false,
      showAge: u.privacySettings?.showAge !== false,
    },
    hasPassword: !!u.passwordHash,
    createdAt: u.createdAt.toISOString(),
  };
}

export function toMessageDTO(m: Pick<MessageDoc, "_id" | "conversationId" | "senderId" | "content" | "clientId" | "createdAt">): MessageDTO {
  return {
    id: String(m._id),
    conversationId: String(m.conversationId),
    senderId: String(m.senderId),
    content: m.content,
    clientId: m.clientId ?? null,
    createdAt: new Date(m.createdAt).toISOString(),
  };
}
