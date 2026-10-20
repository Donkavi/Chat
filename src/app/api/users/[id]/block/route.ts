import { objectId } from "@/lib/validation";
import { LIMITS, enforce } from "@/lib/rate-limit";
import { authed } from "@/server/http";
import { block, unblock } from "@/server/services/users";

export const POST = authed<{ id: string }>(async ({ user, params }) => {
  enforce(`mut:${user._id}`, LIMITS.mutations);
  await block(user, objectId.parse(params.id));
  return { blocked: true };
});

export const DELETE = authed<{ id: string }>(async ({ user, params }) => {
  enforce(`mut:${user._id}`, LIMITS.mutations);
  await unblock(user, objectId.parse(params.id));
  return { blocked: false };
});
