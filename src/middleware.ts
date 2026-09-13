import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE_NAME = "aimem_session";

/**
 * Next.js Edge Middleware for UI Route Protection and Navigation Guards
 *
 * Rules:
 * 1. API routes (/api/*) are skipped: API endpoints authenticate via Bearer token or cookie
 *    and return machine-readable 401/403 JSON payloads instead of HTML redirects.
 * 2. Static assets, fonts, icons, and next internals are skipped.
 * 3. Protected UI routes (/projects, /projects/*, /settings/*) require an active session cookie.
 *    If unauthenticated, redirects to /login?redirect=<path>.
 * 4. Auth routes (/login, /signup) redirect already-authenticated users to /projects
 *    unless they explicitly clicked logout (?loggedOut=true).
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip static assets, favicon, and Next.js internals
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Skip API routes so programmatic agents / MCP / SDK callers get JSON responses
  if (pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const isAuthenticated = Boolean(sessionCookie && sessionCookie.trim().length > 0);

  const isProtected =
    pathname === "/projects" ||
    pathname.startsWith("/projects/") ||
    pathname === "/settings" ||
    pathname.startsWith("/settings/");

  // 1. Redirect unauthenticated visitors attempting to access protected UI routes
  if (isProtected && !isAuthenticated) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 2. Redirect already authenticated visitors away from /login or /signup
  const isAuthPage = pathname === "/login" || pathname === "/signup";
  const justLoggedOut = request.nextUrl.searchParams.get("loggedOut") === "true";

  if (isAuthPage && isAuthenticated && !justLoggedOut) {
    return NextResponse.redirect(new URL("/projects", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
