import { describe, expect, it } from "vitest";
import { GET as nearbyRoute } from "@/app/api/nearby/route";
import { PATCH as locationRoute, DELETE as deleteLocationRoute } from "@/app/api/location/route";
import { GET as profileRoute } from "@/app/api/users/[id]/route";
import { findNearby } from "@/server/services/discovery";
import { blockUser } from "@/server/services/blocks";
import { User, type UserDoc } from "@/server/models/User";
import { ANY_RADIUS_KM, LOCATION_FRESH_MS } from "@/lib/geo";
import { PRESENCE_STALE_MS } from "@/shared/constants";
import { AppError } from "@/lib/errors";
import { KOLLUPITIYA, COLOMBO_FORT, GALLE, KANDY, NUGEGODA, body, cookieFor, makeUser, noParams, params, req } from "./helpers";

async function reload(u: UserDoc) {
  return (await User.findById(u._id).lean<UserDoc>())!;
}

describe("nearby discovery", () => {
  it("returns online, discoverable people within the radius, nearest first, excluding the viewer", async () => {
    const me = await makeUser({ at: COLOMBO_FORT });
    const near = await makeUser({ at: KOLLUPITIYA, displayName: "Near" });
    const mid = await makeUser({ at: NUGEGODA, displayName: "Mid" });
    await makeUser({ at: KANDY, displayName: "Kandy" });
    await makeUser({ at: GALLE, displayName: "Galle" });

    const r5 = await findNearby(me, 5);
    expect(r5.users.map((u) => u.displayName)).toEqual(["Near"]);

    const r25 = await findNearby(me, 25);
    expect(r25.users.map((u) => u.id)).toEqual([String(near._id), String(mid._id)]);
    expect(r25.users.some((u) => u.id === String(me._id))).toBe(false);

    const r100 = await findNearby(me, 100);
    expect(r100.users.map((u) => u.displayName)).toEqual(["Near", "Mid", "Kandy"]);
    expect(r100.users[0].distanceKm).toBeLessThan(r100.users[1].distanceKm);

    // "Any distance" has no cap, still nearest first.
    const rAny = await findNearby(me, ANY_RADIUS_KM);
    expect(rAny.users.map((u) => u.displayName)).toEqual(["Near", "Mid", "Kandy", "Galle"]);
  });

  it("never exposes coordinates or private fields", async () => {
    const me = await makeUser({ at: COLOMBO_FORT });
    await makeUser({ at: KOLLUPITIYA, email: "secret@test.lk" });
    const cookie = await cookieFor(me);
    const res = await nearbyRoute(req("GET", "/api/nearby?radiusKm=10", { cookie }), noParams);
    const text = await res.text();
    expect(res.status).toBe(200);
    expect(text).not.toMatch(/secret@test\.lk|passwordHash|privacySettings/);
    const { data } = JSON.parse(text);
    const forbiddenKeys = new Set(["location", "coordinates", "lat", "lng", "latitude", "longitude", "email"]);
    const walk = (v: unknown): void => {
      if (Array.isArray(v)) return v.forEach(walk);
      if (v && typeof v === "object") {
        for (const [k, child] of Object.entries(v)) {
          expect(forbiddenKeys.has(k)).toBe(false);
          walk(child);
        }
      } else if (typeof v === "number") {
        // No value that looks like a Sri Lankan latitude/longitude.
        expect(v > 5.5 && v < 10.5 && !Number.isInteger(v * 2)).toBe(false);
        expect(v > 79 && v < 82).toBe(false);
      }
    };
    walk(data);
    expect(Object.keys(data.users[0]).sort()).toEqual(
      ["age", "avatarUrl", "bio", "displayName", "distanceKm", "id", "interests", "isOnline", "lastSeenAt", "username"].sort(),
    );
  });

  it("applies privacy and presence rules", async () => {
    const me = await makeUser({ at: COLOMBO_FORT });
    await makeUser({ at: KOLLUPITIYA, displayName: "Visible" });
    await makeUser({ at: KOLLUPITIYA, displayName: "Hidden", isDiscoverable: false });
    await makeUser({ at: KOLLUPITIYA, displayName: "Offline", isOnline: false });
    await makeUser({ at: KOLLUPITIYA, displayName: "Ghost", isOnline: true, lastSeenAt: new Date(Date.now() - PRESENCE_STALE_MS - 1000) });
    await makeUser({ at: KOLLUPITIYA, displayName: "Stale", locationUpdatedAt: new Date(Date.now() - LOCATION_FRESH_MS - 1000) });
    await makeUser({ at: KOLLUPITIYA, displayName: "Paused", isLocationSharingEnabled: false });
    await makeUser({ displayName: "NoLocation" });
    const statusHidden = await makeUser({ at: KOLLUPITIYA, displayName: "Shy", privacySettings: { showOnlineStatus: false, showAge: false }, age: 30 });

    const res = await findNearby(me, 10);
    expect(res.users.map((u) => u.displayName).sort()).toEqual(["Shy", "Visible"]);
    const shy = res.users.find((u) => u.id === String(statusHidden._id))!;
    expect(shy.isOnline).toBe(false);
    expect(shy.lastSeenAt).toBeNull();
    expect(shy.age).toBeNull();
  });

  it("excludes blocked users in both directions", async () => {
    const me = await makeUser({ at: COLOMBO_FORT });
    const iBlocked = await makeUser({ at: KOLLUPITIYA });
    const blockedMe = await makeUser({ at: KOLLUPITIYA });
    const fine = await makeUser({ at: KOLLUPITIYA });
    await blockUser(me._id, String(iBlocked._id));
    await blockUser(blockedMe._id, String(me._id));

    const ids = (await findNearby(me, 10)).users.map((u) => u.id);
    expect(ids).toEqual([String(fine._id)]);
    // The blocker can still open my profile (to unblock me); I can't open theirs.
    const res =await profileRoute(req("GET", `/api/users/${me._id}`, { cookie: await cookieFor(blockedMe) }), params({ id: String(me._id) }));
    expect(res.status).toBe(200);
    const res2 = await profileRoute(req("GET", `/api/users/${blockedMe._id}`, { cookie: await cookieFor(me) }), params({ id: String(blockedMe._id) }));
    expect(res2.status).toBe(404);
  });

  it("requires the viewer to share a fresh location", async () => {
    const me = await makeUser();
    await expect(findNearby(me, 10)).rejects.toMatchObject({ code: "LOCATION_REQUIRED" } satisfies Partial<AppError>);
    const stale = await makeUser({ at: COLOMBO_FORT, locationUpdatedAt: new Date(Date.now() - LOCATION_FRESH_MS - 1) });
    await expect(findNearby(stale, 10)).rejects.toMatchObject({ code: "LOCATION_REQUIRED" });
  });

  it("paginates with a cursor", async () => {
    const me = await makeUser({ at: COLOMBO_FORT });
    for (let i = 0; i < 22; i++) await makeUser({ at: { lat: COLOMBO_FORT.lat + i * 0.001, lng: COLOMBO_FORT.lng } });
    const first = await findNearby(me, 10);
    expect(first.users).toHaveLength(18);
    expect(first.nextCursor).toBe("18");
    const second = await findNearby(me, 10, first.nextCursor!);
    expect(second.users).toHaveLength(4);
    expect(second.nextCursor).toBeNull();
    const all = new Set([...first.users, ...second.users].map((u) => u.id));
    expect(all.size).toBe(22);
  });

  it("validates the radius and requires auth", async () => {
    const me = await makeUser({ at: COLOMBO_FORT });
    const cookie = await cookieFor(me);
    expect((await nearbyRoute(req("GET", "/api/nearby?radiusKm=7", { cookie }), noParams)).status).toBe(422);
    expect((await nearbyRoute(req("GET", "/api/nearby?radiusKm=10"), noParams)).status).toBe(401);
  });
});

describe("location updates", () => {
  it("stores [lng, lat] rounded, enables sharing, and never echoes coordinates", async () => {
    const me = await makeUser();
    const cookie = await cookieFor(me);
    const res = await locationRoute(req("PATCH", "/api/location", { cookie, body: { lat: 6.93449, lng: 79.84281 } }), noParams);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).not.toMatch(/6\.93|79\.84/);
    const stored = await reload(me);
    expect(stored.location?.coordinates).toEqual([79.843, 6.934]);
    expect(stored.isLocationSharingEnabled).toBe(true);
  });

  it("rejects out-of-range coordinates", async () => {
    const cookie = await cookieFor(await makeUser());
    for (const b of [{ lat: 91, lng: 0 }, { lat: 0, lng: -181 }, { lat: "6.9", lng: 79 }, { lat: null, lng: 79 }]) {
      expect((await locationRoute(req("PATCH", "/api/location", { cookie, body: b }), noParams)).status).toBe(422);
    }
  });

  it("deletes the stored location when sharing is turned off", async () => {
    const me = await makeUser({ at: COLOMBO_FORT });
    const cookie = await cookieFor(me);
    await deleteLocationRoute(req("DELETE", "/api/location", { cookie }), noParams);
    const stored = await reload(me);
    expect(stored.location).toBeUndefined();
    expect(stored.isLocationSharingEnabled).toBe(false);
  });

  it("shows an approximate distance on profiles only when both share", async () => {
    const me = await makeUser({ at: COLOMBO_FORT });
    const other = await makeUser({ at: NUGEGODA });
    const res = await profileRoute(req("GET", `/api/users/${other._id}`, { cookie: await cookieFor(me) }), params({ id: String(other._id) }));
    const { data } = await body<{ data: { distanceKm: number | null } }>(res);
    expect(data.distanceKm).toBeGreaterThan(8);
    expect(data.distanceKm).toBeLessThan(12);

    const noLoc = await makeUser();
    const res2 = await profileRoute(req("GET", `/api/users/${other._id}`, { cookie: await cookieFor(noLoc) }), params({ id: String(other._id) }));
    expect((await body<{ data: { distanceKm: number | null } }>(res2)).data.distanceKm).toBeNull();
  });
});
