import { NextRequest } from "next/server";
import {
  getMemoryById,
  updateMemory,
  archiveMemory,
} from "@/services/memory.service";
import type { UpdateMemoryInput } from "@/validations/memory.validation";
import { successResponse, parseJsonBody } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import { requireAuth } from "@/lib/api/auth-guard";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/memories/[id]
 * Retrieves a single memory item by UUID, verifying parent project belongs to caller's tenant.
 * Returns 404 if memory belongs to another tenant to prevent IDOR enumeration.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const principal = await requireAuth(request, { requiredScope: "read" });

    const { id } = await params;
    const memory = await getMemoryById(id, principal.tenantId, principal.projectId);

    return successResponse(memory);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PATCH /api/memories/[id]
 * Updates fields of a memory within the caller's tenant.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const principal = await requireAuth(request, { requiredScope: "write" });

    const { id } = await params;
    const body = await parseJsonBody<UpdateMemoryInput>(request);
    const updated = await updateMemory(id, body, principal.tenantId, principal.projectId);

    return successResponse(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/memories/[id]
 * Soft-archives a memory item. Requires admin scope.
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const principal = await requireAuth(request, { requiredScope: "admin" });

    const { id } = await params;
    const archived = await archiveMemory(id, principal.tenantId, principal.projectId);

    return successResponse(archived);
  } catch (error) {
    return handleApiError(error);
  }
}
