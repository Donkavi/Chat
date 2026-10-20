import { locationUpdateSchema } from "@/lib/validation";
import { LIMITS, enforce } from "@/lib/rate-limit";
import { authed, readJson } from "@/server/http";
import { disableLocation, updateLocation } from "@/server/services/discovery";

/** Share (or refresh) the caller's location. Coordinates are rounded and never returned. */
export const PATCH = authed(async ({ req, user }) => {
  enforce(`loc:${user._id}`, LIMITS.location, "Location is updating too often.");
  const { lat, lng } = await readJson(req, locationUpdateSchema);
  const res = await updateLocation(user._id, { lat, lng });
  return { isLocationSharingEnabled: true, locationUpdatedAt: res.locationUpdatedAt };
});

/** Stop sharing and erase the stored location. */
export const DELETE = authed(async ({ user }) => {
  await disableLocation(user._id);
  return { isLocationSharingEnabled: false, locationUpdatedAt: null };
});
