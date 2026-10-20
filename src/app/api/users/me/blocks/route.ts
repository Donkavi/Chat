import { authed } from "@/server/http";
import { listBlockedUsers } from "@/server/services/blocks";

export const GET = authed(async ({ user }) => listBlockedUsers(user._id));
