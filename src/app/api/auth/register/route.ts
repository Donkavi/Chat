import { NextResponse } from "next/server";
import { registerSchema } from "@/lib/validation";
import { LIMITS, enforce } from "@/lib/rate-limit";
import { createSession, sessionCookie } from "@/lib/auth/session";
import { readJson, route, setCookie } from "@/server/http";
import { registerUser } from "@/server/services/auth";
import { toMe } from "@/server/services/mappers";

export const POST = route(async ({ req, ip }) => {
  enforce(`register:${ip}`, LIMITS.register, "Too many sign-ups from this network. Try again later.");
  const input = await readJson(req, registerSchema);
  const user = await registerUser(input);
  const { token, expiresAt } = await createSession(user._id, req.headers.get("user-agent"));
  return setCookie(NextResponse.json({ data: toMe(user) }, { status: 201 }), sessionCookie(token, expiresAt));
});
