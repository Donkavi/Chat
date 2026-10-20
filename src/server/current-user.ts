import { cache } from "react";
import { cookies } from "next/headers";
import { SESSION_COOKIE, resolveSession } from "@/lib/auth/session";
import type { UserDoc } from "./models/User";

/** The signed-in user for server components, resolved once per request. */
export const getCurrentUser = cache(async (): Promise<UserDoc | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    return (await resolveSession(token))?.user ?? null;
  } catch (err) {
    console.error("[auth] session lookup failed:", err instanceof Error ? err.message : err);
    return null;
  }
});
