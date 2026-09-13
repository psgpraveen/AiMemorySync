import { NextRequest } from "next/server";
import { ForbiddenError } from "@/lib/errors";

/**
 * Validates Origin / Referer headers on state-changing requests to prevent CSRF attacks.
 * Applied to cookie-authenticated browser requests.
 *
 * @param request The incoming NextRequest
 * @throws ForbiddenError if cross-origin CSRF is detected
 */
export function verifyCsrfOrigin(request: NextRequest): void {
  const method = request.method.toUpperCase();
  // Safe methods do not mutate state
  if (["GET", "HEAD", "OPTIONS"].includes(method)) {
    return;
  }

  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");

  if (!host) {
    return;
  }

  // Normalize host (remove port if needed for comparison)
  const hostName = host.split(":")[0].toLowerCase();

  if (origin) {
    try {
      const originUrl = new URL(origin);
      const originHost = originUrl.hostname.toLowerCase();
      if (originHost !== hostName && originHost !== "localhost" && originHost !== "127.0.0.1") {
        throw new ForbiddenError("Cross-origin request blocked: CSRF protection triggered");
      }
      return;
    } catch (err) {
      if (err instanceof ForbiddenError) throw err;
      throw new ForbiddenError("Malformed Origin header");
    }
  }

  if (referer) {
    try {
      const refererUrl = new URL(referer);
      const refererHost = refererUrl.hostname.toLowerCase();
      if (refererHost !== hostName && refererHost !== "localhost" && refererHost !== "127.0.0.1") {
        throw new ForbiddenError("Cross-origin request blocked: CSRF protection triggered");
      }
      return;
    } catch (err) {
      if (err instanceof ForbiddenError) throw err;
      throw new ForbiddenError("Malformed Referer header");
    }
  }
}
