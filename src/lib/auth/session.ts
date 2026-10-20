import { Types } from "mongoose";
import { connectDb } from "../db";
import { env } from "../env";
import { Session } from "@/server/models/Session";
import { User, type UserDoc } from "@/server/models/User";
import { generateToken, hashToken } from "./tokens";

export const SESSION_COOKIE = "langa_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60_000;
/** Extend the session (one write) at most this often while it's in use. */
const SESSION_TOUCH_MS = 24 * 60 * 60_000;

export interface CookieSpec {
  name: string;
  value: string;
  options: {
    httpOnly: true;
    secure: boolean;
    sameSite: "lax";
    path: "/";
    expires: Date;
  };
}

export function sessionCookie(token: string, expiresAt: Date): CookieSpec {
  return {
    name: SESSION_COOKIE,
    value: token,
    options: {
      httpOnly: true,
      secure: env().NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: expiresAt,
    },
  };
}

export function clearedSessionCookie(): CookieSpec {
  return sessionCookie("", new Date(0));
}

export async function createSession(userId: Types.ObjectId, userAgent: string | null) {
  await connectDb();
  const token = generateToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
  await Session.create({
    tokenHash: hashToken(token),
    userId,
    expiresAt,
    lastUsedAt: now,
    userAgent: userAgent?.slice(0, 300) ?? null,
  });
  return { token, expiresAt };
}

export interface ResolvedSession {
  sessionId: Types.ObjectId;
  user: UserDoc;
}

/** Look up a session token and its user. Returns null for missing/expired/invalid tokens. */
export async function resolveSession(token: string | undefined | null): Promise<ResolvedSession | null> {
  if (!token || token.length > 128) return null;
  await connectDb();
  const tokenHash = hashToken(token);
  const session = await Session.findOne({ tokenHash }).lean();
  if (!session) return null;
  const now = Date.now();
  if (session.expiresAt.getTime() <= now) {
    await Session.deleteOne({ _id: session._id });
    return null;
  }
  const user = await User.findById(session.userId).lean<UserDoc>();
  if (!user) {
    await Session.deleteOne({ _id: session._id });
    return null;
  }
  if (now - session.lastUsedAt.getTime() > SESSION_TOUCH_MS) {
    await Session.updateOne(
      { _id: session._id },
      { $set: { lastUsedAt: new Date(now), expiresAt: new Date(now + SESSION_TTL_MS) } },
    );
  }
  return { sessionId: session._id, user };
}

export async function destroySession(token: string | undefined | null) {
  if (!token) return;
  await connectDb();
  await Session.deleteOne({ tokenHash: hashToken(token) });
}

export async function destroyAllSessions(userId: Types.ObjectId, exceptSessionId?: Types.ObjectId) {
  await connectDb();
  await Session.deleteMany({ userId, ...(exceptSessionId ? { _id: { $ne: exceptSessionId } } : {}) });
}

/** Minimal cookie-header parser for the Socket.IO handshake. */
export function readCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === name) {
      try {
        return decodeURIComponent(part.slice(idx + 1).trim());
      } catch {
        return null;
      }
    }
  }
  return null;
}
