import { NextRequest } from "next/server";
import {
  getProjectById,
  updateProject,
  archiveProject,
} from "@/services/project.service";
import type { UpdateProjectInput } from "@/validations/project.validation";
import { successResponse, parseJsonBody } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import { requireAuth } from "@/lib/api/auth-guard";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/projects/[id]
 * Retrieves a single project by UUID, enforcing tenant boundary and project scoping.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const principal = await requireAuth(request, { requiredScope: "read" });

    const { id } = await params;
    const project = await getProjectById(id, principal.tenantId, principal.projectId);

    return successResponse(project);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PATCH /api/projects/[id]
 * Updates fields of a project strictly within the caller's tenant.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const principal = await requireAuth(request, { requiredScope: "write" });

    const { id } = await params;
    const body = await parseJsonBody<UpdateProjectInput>(request);
    const updated = await updateProject(id, body, principal.tenantId, principal.projectId);

    return successResponse(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/projects/[id]
 * Soft-archives a project within the caller's tenant. Requires admin scope.
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const principal = await requireAuth(request, { requiredScope: "admin" });

    const { id } = await params;
    const archived = await archiveProject(id, principal.tenantId, principal.projectId);

    return successResponse(archived);
  } catch (error) {
    return handleApiError(error);
  }
}
