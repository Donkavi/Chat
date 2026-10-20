import { authed } from "@/server/http";
import { getProfileView } from "@/server/services/users";

export const GET = authed<{ id: string }>(async ({ user, params }) => getProfileView(user, params.id));
