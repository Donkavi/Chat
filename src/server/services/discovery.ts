import type { PipelineStage } from "mongoose";
import { User, type UserDoc } from "../models/User";
import { AppError } from "@/lib/errors";
import { ANY_RADIUS_KM, LOCATION_FRESH_MS, approximateDistanceKm, haversineMeters, fromGeoPoint, toGeoPoint, type LatLng } from "@/lib/geo";
import { NEARBY_PAGE_SIZE, PRESENCE_STALE_MS } from "@/shared/constants";
import type { NearbyResponse, NearbyUser } from "@/shared/types";
import { getBlockedIdsEitherWay } from "./blocks";
import { toPublicUser, type PublicUserSource } from "./mappers";

const MAX_OFFSET = 1000;

type LocatedUser = Pick<UserDoc, "isLocationSharingEnabled" | "location" | "locationUpdatedAt">;

export function hasFreshLocation(u: LocatedUser, now = Date.now()): boolean {
  return (
    u.isLocationSharingEnabled &&
    !!u.location &&
    !!u.locationUpdatedAt &&
    now - new Date(u.locationUpdatedAt).getTime() < LOCATION_FRESH_MS
  );
}

/** Save the caller's position (rounded to ~110 m) and turn location sharing on. */
export async function updateLocation(userId: UserDoc["_id"], pos: LatLng) {
  const now = new Date();
  await User.updateOne(
    { _id: userId },
    { $set: { location: toGeoPoint(pos), locationUpdatedAt: now, isLocationSharingEnabled: true } },
  );
  return { locationUpdatedAt: now.toISOString() };
}

/** Turn sharing off and delete the stored position entirely. */
export async function disableLocation(userId: UserDoc["_id"]) {
  await User.updateOne(
    { _id: userId },
    { $set: { isLocationSharingEnabled: false, locationUpdatedAt: null }, $unset: { location: 1 } },
  );
}

/**
 * People who are online, discoverable, sharing a fresh location and within
 * `radiusKm` of the viewer — nearest first. MongoDB does the geo work via the
 * 2dsphere index; coordinates never leave this function.
 */
export async function findNearby(viewer: UserDoc, radiusKm: number, cursor?: string): Promise<NearbyResponse> {
  const now = Date.now();
  if (!hasFreshLocation(viewer, now) || !viewer.location) {
    throw new AppError("LOCATION_REQUIRED", "Share your location to discover people nearby.");
  }
  const offset = Math.min(cursor ? Number.parseInt(cursor, 10) || 0 : 0, MAX_OFFSET);
  const excluded = [viewer._id, ...(await getBlockedIdsEitherWay(viewer._id))];

  const pipeline: PipelineStage[] = [
    {
      $geoNear: {
        near: viewer.location,
        key: "location",
        distanceField: "distanceMeters",
        // "Any distance" drops the cap; results are still nearest first.
        ...(radiusKm < ANY_RADIUS_KM && { maxDistance: radiusKm * 1000 }),
        spherical: true,
        query: {
          _id: { $nin: excluded },
          isDiscoverable: true,
          isLocationSharingEnabled: true,
          locationUpdatedAt: { $gte: new Date(now - LOCATION_FRESH_MS) },
          isOnline: true,
          lastSeenAt: { $gte: new Date(now - PRESENCE_STALE_MS) },
        },
      },
    },
    { $skip: offset },
    { $limit: NEARBY_PAGE_SIZE + 1 },
    // Whitelist projection: `location` is deliberately not included.
    {
      $project: {
        username: 1,
        displayName: 1,
        avatarUrl: 1,
        bio: 1,
        interests: 1,
        age: 1,
        isOnline: 1,
        lastSeenAt: 1,
        privacySettings: 1,
        distanceMeters: 1,
      },
    },
  ];

  const rows = await User.aggregate<PublicUserSource & { distanceMeters: number }>(pipeline);
  const page = rows.slice(0, NEARBY_PAGE_SIZE);
  const users: NearbyUser[] = page.map((r) => ({
    ...toPublicUser(r, now),
    distanceKm: approximateDistanceKm(r.distanceMeters),
  }));
  return {
    users,
    radiusKm,
    nextCursor: rows.length > NEARBY_PAGE_SIZE && offset + NEARBY_PAGE_SIZE < MAX_OFFSET ? String(offset + NEARBY_PAGE_SIZE) : null,
  };
}

/**
 * Approximate distance between two users for a profile view — only when both
 * are sharing a fresh location and the target is discoverable.
 */
export function approximateDistanceBetween(
  viewer: LocatedUser,
  target: LocatedUser & Pick<UserDoc, "isDiscoverable">,
): number | null {
  if (!target.isDiscoverable || !hasFreshLocation(viewer) || !hasFreshLocation(target)) return null;
  return approximateDistanceKm(haversineMeters(fromGeoPoint(viewer.location!), fromGeoPoint(target.location!)));
}
