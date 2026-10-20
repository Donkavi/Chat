import { NextResponse, type NextRequest } from "next/server";
import { ZodError, type ZodType } from "zod";
import type { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { SESSION_COOKIE, resolveSession, type CookieSpec } from "@/lib/auth/session";
import type { UserDoc } from "./models/User";
import type { ApiErrorBody } from "@/shared/types";

/**
 * Every API route goes through `route()` / `authed()`:
 *  - same-origin check on state-changing requests (CSRF defence on top of SameSite cookies)
 *  - DB connection
 *  - identity from the session cookie only (never from the request body)
 *  - Zod validation errors → 422 with per-field messages
 *  - consistent `{ data }` / `{ error }` envelopes; internals never leak
 */

type RouteContext<P> = { params: Promise<P> };

export interface Ctx<P> {
  req: NextRequest;
  params: P;
  ip: string;
}

export interface AuthedCtx<P> extends Ctx<P> {
  user: UserDoc;
  sessionId: Types.ObjectId;
}

const MAX_JSON_BYTES = 64 * 1024;
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function clientIp(req: NextRequest): string {
  // Assumes a trusted reverse proxy sets X-Forwarded-For in production.
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local").slice(0, 64);
}

function assertSameOrigin(req: NextRequest) {
  if (SAFE_METHODS.has(req.method)) return;
  if (req.headers.get("sec-fetch-site") === "cross-site") throw new AppError("FORBIDDEN", "Cross-site request blocked.");
  const origin = req.headers.get("origin");
  if (!origin) return; // Non-browser clients can't ride a victim's cookies.
  const allowed = new Set<string>([new URL(env().APP_URL).origin]);
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (host) {
    const proto = req.headers.get("x-forwarded-proto") ?? new URL(req.url).protocol.replace(":", "");
    allowed.add(`${proto}://${host}`);
  }
  if (!allowed.has(origin)) throw new AppError("FORBIDDEN", "Cross-site request blocked.");
}

export function errorResponse(err: unknown): NextResponse<ApiErrorBody> {
  if (err instanceof ZodError) {
    const fields: Record<string, string> = {};
    for (const issue of err.issues) {
      const key = issue.path.join(".") || "_";
      fields[key] ??= issue.message;
    }
    return NextResponse.json(
      { error: { code: "VALIDATION_FAILED", message: err.issues[0]?.message ?? "Invalid input.", fields } },
      { status: 422 },
    );
  }
  if (err instanceof AppError) {
    const res = NextResponse.json(
      { error: { code: err.code, message: err.message, fields: err.fields, retryAfterSec: err.retryAfterSec } },
      { status: err.status },
    );
    if (err.retryAfterSec) res.headers.set("Retry-After", String(err.retryAfterSec));
    return res;
  }
  // Log the message only — never request bodies, which may hold passwords or coordinates.
  console.error("[api] unhandled error:", err instanceof Error ? `${err.name}: ${err.message}` : String(err));
  return NextResponse.json({ error: { code: "INTERNAL", message: "Something went wrong. Please try again." } }, { status: 500 });
}

async function run(req: NextRequest, fn: () => Promise<unknown>): Promise<Response> {
  try {
    assertSameOrigin(req);
    await connectDb();
    const out = await fn();
    if (out instanceof Response) return out;
    const res = NextResponse.json({ data: out ?? null });
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch (err) {
    return errorResponse(err);
  }
}

export function route<P = Record<string, never>>(fn: (ctx: Ctx<P>) => Promise<unknown>) {
  return (req: NextRequest, rc: RouteContext<P>) =>
    run(req, async () => fn({ req, params: (await rc?.params) as P, ip: clientIp(req) }));
}

export function authed<P = Record<string, never>>(fn: (ctx: AuthedCtx<P>) => Promise<unknown>) {
  return (req: NextRequest, rc: RouteContext<P>) =>
    run(req, async () => {
      const session = await resolveSession(req.cookies.get(SESSION_COOKIE)?.value);
      if (!session) throw new AppError("UNAUTHENTICATED", "Please sign in to continue.");
      return fn({
        req,
        params: (await rc?.params) as P,
        ip: clientIp(req),
        user: session.user,
        sessionId: session.sessionId,
      });
    });
}

export async function readJson<T>(req: NextRequest, schema: ZodType<T>): Promise<T> {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > MAX_JSON_BYTES) throw new AppError("PAYLOAD_TOO_LARGE", "Request body is too large.");
  const text = await req.text();
  if (text.length > MAX_JSON_BYTES) throw new AppError("PAYLOAD_TOO_LARGE", "Request body is too large.");
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    throw new AppError("BAD_REQUEST", "Request body must be valid JSON.");
  }
  return schema.parse(body);
}

export function readQuery<T>(req: NextRequest, schema: ZodType<T>): T {
  return schema.parse(Object.fromEntries(req.nextUrl.searchParams.entries()));
}

export function json(data: unknown, init?: ResponseInit) {
  const res = NextResponse.json({ data }, init);
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export function setCookie(res: NextResponse, c: CookieSpec) {
  res.cookies.set(c.name, c.value, c.options);
  return res;
}
