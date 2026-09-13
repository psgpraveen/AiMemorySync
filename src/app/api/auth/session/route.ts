import { NextRequest } from "next/server";
import { successResponse } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import { UnauthorizedError } from "@/lib/errors";
import { validateSession } from "@/services/auth.service";
import { getSessionTokenFromRequest } from "@/lib/auth/cookies";

/**
 * GET /api/auth/session
 * Returns safe session context for the currently authenticated human user:
 * user details, active tenant context, and all accessible tenant memberships.
 * Never exposes sessionToken, passwordHash, or API keys.
 */
export async function GET(request: NextRequest) {
  try {
    const rawToken = getSessionTokenFromRequest(request);

    if (!rawToken) {
      throw new UnauthorizedError("No active session found");
    }

    const sessionContext = await validateSession(rawToken);

    if (!sessionContext) {
      throw new UnauthorizedError("Session is invalid or has expired");
    }

    return successResponse({
      user: sessionContext.user,
      activeTenant: sessionContext.activeTenant,
      memberships: sessionContext.memberships,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
