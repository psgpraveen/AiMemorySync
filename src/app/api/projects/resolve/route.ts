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
 *
 * Resolves an incoming identity signal payload (Git remote, monorepo subpath, package manifest,
 * workspace digest, or platform session) to an existing Project or automatically provisions a new one.
 *
 * Returns 200 OK for matched existing projects, or 201 Created for newly provisioned projects.
 */
export async function POST(request: NextRequest) {
  try {
    await requireAuth(request, { requiredScope: "write" });

    const body = await parseJsonBody<ResolveProjectInput>(request);
    const result = await resolveProjectIdentity(body);

    if (result.isNewlyCreated) {
      return createdResponse(result);
    }

    return successResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}

