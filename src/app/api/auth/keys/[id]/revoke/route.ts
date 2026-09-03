import { NextRequest } from "next/server";
import { revokeApiKey } from "@/services/auth.service";
import { successResponse } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import { requireAuth } from "@/lib/api/auth-guard";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/auth/keys/[id]/revoke
 * Revokes an active API key immediately. Requires admin scope.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    await requireAuth(request, { requiredScope: "admin" });

    const { id } = await params;
    const revoked = await revokeApiKey(id);

    return successResponse(revoked);
  } catch (error) {
    return handleApiError(error);
  }
}
