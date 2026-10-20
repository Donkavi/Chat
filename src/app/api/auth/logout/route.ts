import { NextResponse } from "next/server";
import { SESSION_COOKIE, clearedSessionCookie, destroySession, resolveSession } from "@/lib/auth/session";
import { route, setCookie } from "@/server/http";
import { disconnectSession } from "@/server/realtime/hub";

export const POST = route(async ({ req }) => {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = await resolveSession(token);
  await destroySession(token);
  if (session) await disconnectSession(String(session.user._id), String(session.sessionId));
  return setCookie(NextResponse.json({ data: null }), clearedSessionCookie());
});
