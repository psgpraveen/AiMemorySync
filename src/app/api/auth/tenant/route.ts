import { NextRequest } from "next/server";
import { successResponse, parseJsonBody } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import { UnauthorizedError, ValidationError } from "@/lib/errors";
import { validateSession, switchActiveTenant } from "@/services/auth.service";
import { getSessionTokenFromRequest } from "@/lib/auth/cookies";
import { verifyCsrfOrigin } from "@/lib/auth/csrf";
import { z } from "zod";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const tenantSwitchSchema = z.object({
  tenantId: z.string().regex(UUID_REGEX, "Invalid workspace ID format"),
});

/**
 * POST /api/auth/tenant
 * Switches the active tenant context for the current session.
 * Requires the authenticated user to hold an active TenantMember relationship with the requested tenant.
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Verify CSRF origin on state-changing request
    verifyCsrfOrigin(request);

    // 2. Validate current session
    const rawToken = getSessionTokenFromRequest(request);
    if (!rawToken) {
      throw new UnauthorizedError("Authentication required to switch workspace");
    }

    const sessionContext = await validateSession(rawToken);
    if (!sessionContext) {
      throw new UnauthorizedError("Active session has expired");
    }

    // 3. Validate body
    const rawBody = await parseJsonBody<Record<string, unknown>>(request);
    const validation = tenantSwitchSchema.safeParse(rawBody);
    if (!validation.success) {
      throw new ValidationError("Invalid tenant switch payload", validation.error.flatten());
    }

    const { tenantId } = validation.data;

    // 4. Perform secure active tenant switch
    const activeTenant = await switchActiveTenant(
      sessionContext.user.id,
      sessionContext.session.id,
      tenantId
    );

    return successResponse({
      message: `Active workspace switched to '${activeTenant.name}'`,
      activeTenant,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
