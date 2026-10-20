import { z } from "zod";
import { usernameSchema } from "@/lib/validation";
import { LIMITS, enforce } from "@/lib/rate-limit";
import { readQuery, route } from "@/server/http";
import { User } from "@/server/models/User";

/** Live "is this username free?" check for the sign-up and profile forms. */
export const GET = route(async ({ req, ip }) => {
  enforce(`username:${ip}`, LIMITS.mutations);
  const { u } = readQuery(req, z.object({ u: usernameSchema }));
  return { username: u, available: !(await User.exists({ username: u })) };
});
