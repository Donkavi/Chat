import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "lumos_session";
const PROTECTED = ["/discover", "/chats", "/profile", "/settings"];

/**
 * Fast, optimistic gate: bounce visitors without a session cookie away from
 * app pages before rendering. The real session check happens server-side in
 * the (app) layout and in every API route.
 */
export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const isProtected = PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (isProtected && !req.cookies.has(SESSION_COOKIE)) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/discover/:path*", "/chats/:path*", "/profile/:path*", "/settings/:path*"],
};
