import { forgotPasswordSchema } from "@/lib/validation";
import { LIMITS, enforce } from "@/lib/rate-limit";
import { readJson, route } from "@/server/http";
import { requestPasswordReset } from "@/server/services/auth";

export const POST = route(async ({ req, ip }) => {
  enforce(`reset-ip:${ip}`, LIMITS.passwordReset, "Too many reset requests. Try again later.");
  const { email } = await readJson(req, forgotPasswordSchema);
  enforce(`reset-acct:${email}`, LIMITS.passwordReset, "Too many reset requests. Try again later.");
  try {
    await requestPasswordReset(email);
  } catch (err) {
    // Don't let delivery failures reveal whether the account exists.
    console.error("[auth] password reset email failed:", err instanceof Error ? err.message : err);
  }
  return { message: "If an account exists for that email, a reset link is on its way." };
});
