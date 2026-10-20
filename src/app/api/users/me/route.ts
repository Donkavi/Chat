import { NextResponse } from "next/server";
import { deleteAccountSchema, profileUpdateSchema } from "@/lib/validation";
import { LIMITS, enforce } from "@/lib/rate-limit";
import { clearedSessionCookie } from "@/lib/auth/session";
import { authed, readJson, setCookie } from "@/server/http";
import { toMe } from "@/server/services/mappers";
import { deleteAccount, updateProfile } from "@/server/services/users";

export const GET = authed(async ({ user }) => toMe(user));

export const PATCH = authed(async ({ req, user }) => {
  enforce(`mut:${user._id}`, LIMITS.mutations);
  const patch = await readJson(req, profileUpdateSchema);
  return updateProfile(user._id, patch);
});

export const DELETE = authed(async ({ req, user }) => {
  enforce(`delete:${user._id}`, LIMITS.loginPerAccount, "Too many attempts. Try again later.");
  const { password } = await readJson(req, deleteAccountSchema);
  await deleteAccount(user, password);
  return setCookie(NextResponse.json({ data: null }), clearedSessionCookie());
});
