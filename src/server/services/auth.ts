import { Types } from "mongoose";
import { User, type UserDoc } from "../models/User";
import { PasswordResetToken } from "../models/PasswordResetToken";
import { AppError } from "@/lib/errors";
import { env } from "@/lib/env";
import { hashPassword, verifyAgainstDummy, verifyPassword } from "@/lib/auth/password";
import { generateToken, hashToken } from "@/lib/auth/tokens";
import { destroyAllSessions } from "@/lib/auth/session";
import type { RegisterInput } from "@/lib/validation";
import { sendMail } from "../email";
import { disconnectUser } from "../realtime/hub";

const RESET_TTL_MS = 60 * 60_000;

function isDuplicateKey(err: unknown): err is { code: number; keyPattern?: Record<string, unknown> } {
  return typeof err === "object" && err !== null && (err as { code?: number }).code === 11000;
}

export async function registerUser(input: RegisterInput): Promise<UserDoc> {
  const [emailTaken, usernameTaken] = await Promise.all([
    User.exists({ email: input.email }),
    User.exists({ username: input.username }),
  ]);
  if (emailTaken || usernameTaken) {
    throw new AppError("CONFLICT", "Some details are already in use.", {
      ...(emailTaken ? { email: "An account with this email already exists." } : {}),
      ...(usernameTaken ? { username: "That username is taken." } : {}),
    });
  }
  try {
    const user = await User.create({
      email: input.email,
      username: input.username,
      displayName: input.displayName,
      passwordHash: await hashPassword(input.password),
    });
    return user.toObject();
  } catch (err) {
    // Lost a race with a concurrent signup — report it like the pre-check would.
    if (isDuplicateKey(err)) {
      const field = err.keyPattern && "username" in err.keyPattern ? "username" : "email";
      throw new AppError("CONFLICT", "Some details are already in use.", {
        [field]: field === "username" ? "That username is taken." : "An account with this email already exists.",
      });
    }
    throw err;
  }
}

/** Returns the user on success, null on any failure (without revealing which part was wrong). */
export async function authenticate(identifier: string, password: string): Promise<UserDoc | null> {
  const query = identifier.includes("@") ? { email: identifier } : { username: identifier };
  const user = await User.findOne(query).lean<UserDoc>();
  if (!user?.passwordHash) {
    await verifyAgainstDummy(password);
    return null;
  }
  return (await verifyPassword(user.passwordHash, password)) ? user : null;
}

/**
 * Always resolves the same way whether or not the email exists, so this
 * endpoint can't be used to enumerate accounts.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const user = await User.findOne({ email }).select("_id email displayName").lean();
  if (!user) return;
  // Only the newest link is valid.
  await PasswordResetToken.deleteMany({ userId: user._id });
  const token = generateToken();
  await PasswordResetToken.create({
    tokenHash: hashToken(token),
    userId: user._id,
    expiresAt: new Date(Date.now() + RESET_TTL_MS),
  });
  const link = `${env().APP_URL.replace(/\/$/, "")}/reset-password?token=${encodeURIComponent(token)}`;
  await sendMail({
    to: user.email,
    subject: "Reset your Lumos password",
    text: `Hi ${user.displayName},\n\nSomeone (hopefully you) asked to reset your Lumos password. This link works for 1 hour:\n\n${link}\n\nIf you didn't ask for this, you can ignore this email.`,
    html: `<p>Hi ${escapeHtml(user.displayName)},</p><p>Someone (hopefully you) asked to reset your Lumos password. This link works for 1 hour:</p><p><a href="${link}">Reset my password</a></p><p>If you didn't ask for this, you can ignore this email.</p>`,
  });
}

export async function resetPassword(token: string, newPassword: string): Promise<Types.ObjectId> {
  const record = await PasswordResetToken.findOneAndUpdate(
    { tokenHash: hashToken(token), usedAt: null, expiresAt: { $gt: new Date() } },
    { $set: { usedAt: new Date() } },
  ).lean();
  if (!record) throw new AppError("BAD_REQUEST", "This reset link is invalid or has expired. Request a new one.");
  await User.updateOne({ _id: record.userId }, { $set: { passwordHash: await hashPassword(newPassword) } });
  // Sign out everywhere: whoever had access before the reset shouldn't keep it.
  await destroyAllSessions(record.userId);
  disconnectUser(String(record.userId));
  return record.userId;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
