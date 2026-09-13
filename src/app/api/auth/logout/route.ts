import { NextRequest } from "next/server";
import { successResponse } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import { deleteSession } from "@/services/auth.service";
import {
  SESSION_COOKIE_NAME,
  getSessionTokenFromRequest,
  getSessionCookieOptions,
} from "@/lib/auth/cookies";

/**
 * POST /api/auth/logout
 * Invalidates the active human session and clears the session cookie.
 * Always succeeds even if the session is missing or already expired.
 */
export async function POST(request: NextRequest) {
  try {
    const rawToken = getSessionTokenFromRequest(request);

    if (rawToken) {
      await deleteSession(rawToken).catch(() => {});
    }

    const response = successResponse({
      message: "Signed out successfully",
    });

    // Clear session cookie immediately
    const expiredOptions = {
      ...getSessionCookieOptions(),
      maxAge: 0,
      expires: new Date(0),
    };

    response.cookies.set(SESSION_COOKIE_NAME, "", expiredOptions);

    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
