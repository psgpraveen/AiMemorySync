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
 * Returns standard centralized session cookie options.
 */
export function getSessionCookieOptions(maxAge: number = SESSION_MAX_AGE_SECONDS): CookieOptions {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
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
