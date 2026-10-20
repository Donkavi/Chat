import { NextResponse } from "next/server";
import { loginSchema } from "@/lib/validation";
import { AppError } from "@/lib/errors";
import { LIMITS, enforce, resetLimit } from "@/lib/rate-limit";
import { createSession, sessionCookie } from "@/lib/auth/session";
import { readJson, route, setCookie } from "@/server/http";
import { authenticate } from "@/server/services/auth";
import { toMe } from "@/server/services/mappers";

const TOO_MANY = "Too many sign-in attempts. Please wait a few minutes and try again.";

export const POST = route(async ({ req, ip }) => {
  const { identifier, password } = await readJson(req, loginSchema);
  enforce(`login-ip:${ip}`, LIMITS.loginPerIp, TOO_MANY);
  // Per-account limit slows down password guessing against one person from many IPs.
  const accountKey = `login-acct:${identifier}`;
  enforce(accountKey, LIMITS.loginPerAccount, TOO_MANY);

  const user = await authenticate(identifier, password);
  if (!user) {
    throw new AppError("UNAUTHENTICATED", "That email/username and password don't match.");
  }
  resetLimit(accountKey);
  const { token, expiresAt } = await createSession(user._id, req.headers.get("user-agent"));
  return setCookie(NextResponse.json({ data: toMe(user) }), sessionCookie(token, expiresAt));
});
