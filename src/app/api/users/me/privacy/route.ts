import { privacyUpdateSchema } from "@/lib/validation";
import { LIMITS, enforce } from "@/lib/rate-limit";
import { authed, readJson } from "@/server/http";
import { updatePrivacy } from "@/server/services/users";

export const PATCH = authed(async ({ req, user }) => {
  enforce(`mut:${user._id}`, LIMITS.mutations);
  return updatePrivacy(user._id, await readJson(req, privacyUpdateSchema));
});
