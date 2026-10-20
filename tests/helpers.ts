import { NextRequest } from "next/server";
import { User, type UserDoc } from "@/server/models/User";
import { createSession, SESSION_COOKIE } from "@/lib/auth/session";
import { toGeoPoint, type LatLng } from "@/lib/geo";

let n = 0;

/** Insert a user directly. Defaults to online + discoverable but with no location. */
export async function makeUser(overrides: Partial<UserDoc> & { at?: LatLng } = {}): Promise<UserDoc> {
  n++;
  const { at, ...rest } = overrides;
  const doc = await User.create({
    email: `user${n}@test.lk`,
    username: `user${n}`,
    displayName: `User ${n}`,
    passwordHash: null,
    isOnline: true,
    lastSeenAt: new Date(),
    isDiscoverable: true,
    ...(at ? { location: toGeoPoint(at), locationUpdatedAt: new Date(), isLocationSharingEnabled: true } : {}),
    ...rest,
  });
  return doc.toObject();
}

export async function cookieFor(user: UserDoc): Promise<string> {
  const { token } = await createSession(user._id, "vitest");
  return `${SESSION_COOKIE}=${token}`;
}

export function req(
  method: string,
  path: string,
  opts: { body?: unknown; cookie?: string; headers?: Record<string, string> } = {},
): NextRequest {
  const headers = new Headers(opts.headers);
  if (opts.cookie) headers.set("cookie", opts.cookie);
  if (opts.body !== undefined) headers.set("content-type", "application/json");
  headers.set("x-forwarded-for", `10.0.0.${(n % 250) + 1}`);
  return new NextRequest(`http://localhost:3000${path}`, {
    method,
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
}

export const noParams = { params: Promise.resolve({}) as Promise<Record<string, never>> };
export const params = <P>(p: P) => ({ params: Promise.resolve(p) });

export async function body<T = unknown>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

// Reference points (lat, lng).
export const COLOMBO_FORT = { lat: 6.9344, lng: 79.8428 };
export const KOLLUPITIYA = { lat: 6.9106, lng: 79.8507 }; // ~2.8 km from Fort
export const NUGEGODA = { lat: 6.8649, lng: 79.8997 }; // ~10 km from Fort
export const KANDY = { lat: 7.2906, lng: 80.6337 }; // ~95 km from Fort
export const GALLE = { lat: 6.0535, lng: 80.221 }; // ~105 km from Fort
