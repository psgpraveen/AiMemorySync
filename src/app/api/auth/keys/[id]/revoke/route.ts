import { NextRequest } from "next/server";
import { revokeApiKey } from "@/services/auth.service";
import { successResponse } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import { requireAuth } from "@/lib/api/auth-guard";
import { ForbiddenError } from "@/lib/errors";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/auth/keys/[id]/revoke
 * Revokes an active API key strictly within the authenticated tenant. Requires admin scope.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const principal = await requireAuth(request, { requiredScope: "admin" });

    if (principal.projectId) {
      throw new ForbiddenError("Project-scoped API key cannot revoke API keys");
    }

    const { id } = await params;
    const revoked = await revokeApiKey(id, principal.tenantId);

    return successResponse(revoked);
  } catch (error) {
    return handleApiError(error);
  }
}
