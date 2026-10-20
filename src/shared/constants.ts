/** Values shared by the browser, the API and the realtime server. */

/** Client sends `presence:heartbeat` this often while connected. */
export const HEARTBEAT_INTERVAL_MS = 25_000;
/** A user whose last heartbeat is older than this is treated as offline everywhere. */
export const PRESENCE_STALE_MS = 120_000;
/** Sockets that miss heartbeats for this long are disconnected by the sweeper. */
export const SOCKET_IDLE_TIMEOUT_MS = 60_000;
/** Grace period before a fully-disconnected user is marked offline (covers reloads). */
export const OFFLINE_GRACE_MS = 5_000;

/** How often the browser refreshes its shared location while the app is open. */
export const LOCATION_REFRESH_MS = 5 * 60_000;

export const MESSAGE_MAX_LENGTH = 2000;
export const BIO_MAX_LENGTH = 280;
export const MAX_INTERESTS = 8;
export const MESSAGES_PAGE_SIZE = 30;
export const NEARBY_PAGE_SIZE = 18;
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
export const AVATAR_ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export const INTEREST_SUGGESTIONS = [
  "Cricket",
  "Photography",
  "Hiking",
  "Surfing",
  "Coffee",
  "Live music",
  "Cooking",
  "Street food",
  "Tech",
  "Startups",
  "Reading",
  "Travel",
  "Gaming",
  "Yoga",
  "Art",
  "Movies",
  "Football",
  "Rugby",
  "Beach days",
  "Running",
  "Cycling",
  "Fitness",
  "Design",
  "Anime",
  "Dancing",
  "Board games",
  "Volunteering",
  "Languages",
  "Poetry",
  "Wildlife",
  "Tea",
  "Podcasts",
] as const;
