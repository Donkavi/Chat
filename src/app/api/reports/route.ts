import { reportSchema } from "@/lib/validation";
import { LIMITS, enforce } from "@/lib/rate-limit";
import { authed, readJson } from "@/server/http";
import { createReport } from "@/server/services/users";

export const POST = authed(async ({ req, user }) => {
  enforce(`report:${user._id}`, LIMITS.reports, "You've sent a lot of reports. Try again later.");
  const input = await readJson(req, reportSchema);
  await createReport(user, input);
  return { received: true, blocked: input.alsoBlock };
});
