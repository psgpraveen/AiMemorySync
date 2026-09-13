import crypto from "crypto";
import { NextRequest } from "next/server";

export const SESSION_COOKIE_NAME = "aimem_session";
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days
export const SLIDING_RENEWAL_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface CookieOptions {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax" | "strict" | "none";
  path: string;
  maxAge: number;
}

/**
 * Determines whether the connection is secure (HTTPS).
 *
 * Checks:
 * 1. Explicit environment variable `COOKIE_SECURE` ("true" | "false")
 * 2. Proxy forwarding headers (x-forwarded-proto, cf-visitor, etc.)
 * 3. Incoming request URL protocol (request.nextUrl.protocol === "https:")
 * 4. NEXT_PUBLIC_APP_URL / APP_URL protocol
 *
 * If the connection is plain HTTP (e.g. AWS EC2 IP address or internal staging),
 * `secure` MUST be false. Browsers strictly reject Set-Cookie headers with `Secure`
 * over non-localhost HTTP connections.
 */
export function isConnectionSecure(request?: NextRequest | Headers | null): boolean {
  if (process.env.COOKIE_SECURE === "true") return true;
  if (process.env.COOKIE_SECURE === "false") return false;

  if (request) {
    const headers = "headers" in request ? request.headers : request;
    const proto =
      headers?.get("x-forwarded-proto") ||
      headers?.get("x-forwarded-protocol") ||
      headers?.get("x-url-scheme");
    if (proto) {
      const primaryProto = proto.split(",")[0].trim().toLowerCase();
      if (primaryProto === "https") return true;
      if (primaryProto === "http") return false;
    }

    const cfVisitor = headers?.get("cf-visitor");
    if (cfVisitor) {
      try {
        const parsed = JSON.parse(cfVisitor);
        if (parsed.scheme === "https") return true;
        if (parsed.scheme === "http") return false;
      } catch {}
    }

    if ("nextUrl" in request && request.nextUrl?.protocol) {
      if (request.nextUrl.protocol === "https:") return true;
      if (request.nextUrl.protocol === "http:") return false;
    }

    return false;
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
  if (appUrl) {
    try {
      return new URL(appUrl).protocol === "https:";
    } catch {}
  }

  return false;
}

/**
 * Returns standard centralized session cookie options.
 * Dynamically resolves `secure` based on whether the request is transmitted over HTTPS.
 */
export function getSessionCookieOptions(maxAge?: number): CookieOptions;
export function getSessionCookieOptions(
  request?: NextRequest | Headers | null,
  maxAge?: number
): CookieOptions;
export function getSessionCookieOptions(
  requestOrMaxAge?: NextRequest | Headers | number | null,
  optionalMaxAge?: number
): CookieOptions {
  let request: NextRequest | Headers | null = null;
  let maxAge: number = SESSION_MAX_AGE_SECONDS;

  if (typeof requestOrMaxAge === "number") {
    maxAge = requestOrMaxAge;
  } else if (requestOrMaxAge !== undefined && requestOrMaxAge !== null) {
    request = requestOrMaxAge;
    if (typeof optionalMaxAge === "number") {
      maxAge = optionalMaxAge;
    }
  } else if (typeof optionalMaxAge === "number") {
    maxAge = optionalMaxAge;
  }

  return {
    httpOnly: true,
    secure: isConnectionSecure(request),
    sameSite: "lax",
    path: "/",
    maxAge,
  };
}

/**
 * Computes a deterministic SHA-256 hash of a raw session token.
 * Raw tokens are never stored in the database.
 */
export function hashSessionToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken.trim()).digest("hex");
}

/**
 * Generates a cryptographically secure random session token.
 * 32 bytes entropy -> 64 hex characters.
 */
export function generateRawSessionToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Extracts raw session token from an incoming NextRequest's cookies.
 */
export function getSessionTokenFromRequest(request: NextRequest): string | null {
  const cookie = request.cookies.get(SESSION_COOKIE_NAME);
  return cookie?.value ? cookie.value.trim() : null;
}
