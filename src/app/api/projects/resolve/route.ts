import { NextRequest } from "next/server";
import { resolveProjectIdentity } from "@/services/identity.service";
import type { ResolveProjectInput } from "@/validations/discovery.validation";
import {
  successResponse,
  createdResponse,
  parseJsonBody,
} from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import { requireAuth } from "@/lib/api/auth-guard";

/**
 * POST /api/projects/resolve
 * Resolves an incoming identity signal payload to an existing Project within the caller's tenant,
 * or provisions a new one scoped strictly to the tenant.
 *
 * Project-scoped keys are restricted exclusively to resolving their assigned project.
 */
export async function POST(request: NextRequest) {
  try {
    const principal = await requireAuth(request, { requiredScope: "write" });

    const body = await parseJsonBody<ResolveProjectInput>(request);
    const result = await resolveProjectIdentity(
      body,
      principal.tenantId,
      principal.projectId
    );

    if (result.isNewlyCreated) {
      return createdResponse(result);
    }

    return successResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}
