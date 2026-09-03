import { NextRequest } from "next/server";
import { validateApiKey } from "@/services/auth.service";
import { checkRateLimit } from "@/lib/api/rate-limiter";
import { UnauthorizedError, RateLimitError } from "@/lib/errors";

export interface AuthPrincipal {
  keyId: string;
  name: string;
  scopes: string[];
}

export interface AuthGuardOptions {
  requiredScope?: "read" | "write" | "admin";
  rateLimit?: number; // requests per minute
}

/**
 * Enforces API Key authentication and scope authorization on Next.js route handlers.
 *
 * @param request The incoming NextRequest
 * @param options Optional required scope and rate limit overrides
 * @returns Authenticated principal details
 * @throws UnauthorizedError If token is missing, invalid, expired, or revoked
 * @throws ForbiddenError If key lacks required scope
 * @throws RateLimitError If request frequency exceeds rate limit window
 */
export async function requireAuth(
  request: NextRequest,
  options?: AuthGuardOptions
): Promise<AuthPrincipal> {
  const authHeader =
    request.headers.get("authorization") || request.headers.get("x-api-key");

  // 1. Development-only anonymous bypass (strictly disabled in production)
  if (!authHeader) {
    if (
      process.env.NODE_ENV === "development" &&
      process.env.ALLOW_DEV_ANONYMOUS_AUTH === "true"
    ) {
      return {
        keyId: "dev-anonymous-key",
        name: "Development Anonymous Principal",
        scopes: ["read", "write", "admin"],
      };
    }

    throw new UnauthorizedError(
      "Authentication required. Provide 'Authorization: Bearer <api_key>'"
    );
  }

  // 2. Extract raw token
  const rawToken = authHeader.startsWith("Bearer ")
    ? authHeader.substring(7).trim()
    : authHeader.trim();

  // 3. Validate key against database & verify scopes
  const apiKey = await validateApiKey(rawToken, options?.requiredScope);

  // 4. Rate limit check per API key ID
  const limit = options?.rateLimit ?? (options?.requiredScope === "write" ? 60 : 120);
  const rateLimitResult = checkRateLimit(apiKey.id, limit, 60000);

  if (!rateLimitResult.isAllowed) {
    const retrySecs = Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000);
    throw new RateLimitError(
      `Rate limit exceeded. Maximum ${limit} requests per minute. Retry in ${retrySecs}s.`
    );
  }

  return {
    keyId: apiKey.id,
    name: apiKey.name,
    scopes: apiKey.scopes,
  };
}
