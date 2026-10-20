import { createHmac, randomBytes } from "node:crypto";
import { env } from "../env";

/** 256-bit random, URL-safe token for cookies and reset links. */
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Keyed hash stored in the DB, so a leaked database alone can't be used to forge sessions. */
export function hashToken(token: string): string {
  return createHmac("sha256", env().AUTH_SECRET).update(token).digest("hex");
}
