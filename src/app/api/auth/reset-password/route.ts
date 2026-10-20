import { resetPasswordSchema } from "@/lib/validation";
import { LIMITS, enforce } from "@/lib/rate-limit";
import { readJson, route } from "@/server/http";
import { resetPassword } from "@/server/services/auth";

export const POST = route(async ({ req, ip }) => {
  enforce(`reset-submit:${ip}`, LIMITS.loginPerIp, "Too many attempts. Try again later.");
  const { token, password } = await readJson(req, resetPasswordSchema);
  await resetPassword(token, password);
  return { message: "Your password has been updated. Please sign in." };
});
