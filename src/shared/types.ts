/**
 * DTOs that cross the network. These are the ONLY user shapes the API and
 * socket server send — never raw database documents, never coordinates.
 */

export interface PublicUser {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string;
  interests: string[];
  /** Null when the user hid their age or never set it. */
  age: number | null;
  /** Always false when the user hides their online status. */
  isOnline: boolean;
  /** Null when the user hides their online status. */
  lastSeenAt: string | null;
}

export interface NearbyUser extends PublicUser {
  /** Coarsened distance in km (see approximateDistanceKm). */
  distanceKm: number;
}

export interface ProfileView extends PublicUser {
  distanceKm: number | null;
  sharedInterests: string[];
  isBlockedByMe: boolean;
  conversationId: string | null;
  joinedAt: string;
}

export interface PrivacySettingsDTO {
  showOnlineStatus: boolean;
  showAge: boolean;
}

export interface Me {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string;
  interests: string[];
  age: number | null;
  isDiscoverable: boolean;
  isLocationSharingEnabled: boolean;
  /** When the server last received a location. Coordinates are never sent back. */
  locationUpdatedAt: string | null;
  privacySettings: PrivacySettingsDTO;
  hasPassword: boolean;
  createdAt: string;
}

export interface MessageDTO {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  clientId: string | null;
  createdAt: string;
}

export interface ConversationDTO {
  id: string;
  otherUser: PublicUser;
  lastMessage: { content: string; senderId: string; createdAt: string } | null;
  activityAt: string;
  unreadCount: number;
  /** When the other participant last read this conversation (for "Seen"). */
  otherLastReadAt: string | null;
  blockedByMe: boolean;
  blockedMe: boolean;
}

export interface NearbyResponse {
  users: NearbyUser[];
  nextCursor: string | null;
  radiusKm: number;
}

export interface Paginated<T> {
  items: T[];
  nextCursor: string | null;
}

export interface ApiErrorBody {
  error: { code: string; message: string; fields?: Record<string, string>; retryAfterSec?: number };
}
