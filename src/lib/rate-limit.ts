import { AppError } from "./errors";

/**
 * Fixed-window in-memory rate limiter.
 *
 * Limitation: state lives in this process only. With more than one server
 * instance, swap this for a shared store (e.g. Redis INCR + EXPIRE) behind the
 * same `consume` signature.
 */
type Bucket = { count: number; resetAt: number };

const g = globalThis as unknown as { __langaRateLimit?: Map<string, Bucket> };
const buckets: Map<string, Bucket> = (g.__langaRateLimit ??= new Map());

let lastSweep = Date.now();
function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
}

export interface LimitRule {
  /** Maximum hits per window. */
  limit: number;
  windowMs: number;
}

export function consume(key: string, rule: LimitRule): { ok: boolean; retryAfterSec: number } {
  const now = Date.now();
  sweep(now);
  let b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    b = { count: 0, resetAt: now + rule.windowMs };
    buckets.set(key, b);
  }
  b.count++;
  return { ok: b.count <= rule.limit, retryAfterSec: Math.max(1, Math.ceil((b.resetAt - now) / 1000)) };
}

export function enforce(key: string, rule: LimitRule, message = "Too many requests. Please slow down.") {
  const r = consume(key, rule);
  if (!r.ok) throw new AppError("RATE_LIMITED", message, undefined, r.retryAfterSec);
}

export function resetLimit(key: string) {
  buckets.delete(key);
}

export const LIMITS = {
  loginPerIp: { limit: 30, windowMs: 15 * 60_000 },
  loginPerAccount: { limit: 6, windowMs: 15 * 60_000 },
  register: { limit: 10, windowMs: 60 * 60_000 },
  passwordReset: { limit: 5, windowMs: 60 * 60_000 },
  nearby: { limit: 40, windowMs: 60_000 },
  location: { limit: 8, windowMs: 60_000 },
  messages: { limit: 15, windowMs: 10_000 },
  conversationsCreate: { limit: 40, windowMs: 60 * 60_000 },
  typing: { limit: 40, windowMs: 10_000 },
  reports: { limit: 10, windowMs: 60 * 60_000 },
  uploads: { limit: 10, windowMs: 10 * 60_000 },
  mutations: { limit: 60, windowMs: 60_000 },
} satisfies Record<string, LimitRule>;
