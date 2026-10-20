import { nearbyQuerySchema } from "@/lib/validation";
import { LIMITS, enforce } from "@/lib/rate-limit";
import { authed, readQuery } from "@/server/http";
import { findNearby } from "@/server/services/discovery";

export const GET = authed(async ({ req, user }) => {
  enforce(`nearby:${user._id}`, LIMITS.nearby);
  const { radiusKm, cursor } = readQuery(req, nearbyQuerySchema);
  return findNearby(user, radiusKm, cursor);
});
