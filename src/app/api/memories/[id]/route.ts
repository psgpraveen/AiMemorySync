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
 * Retrieves a single memory item by its UUID.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    await requireAuth(request, { requiredScope: "read" });

    const { id } = await params;
    const memory = await getMemoryById(id);

    return successResponse(memory);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PATCH /api/memories/[id]
 * Updates fields of a memory. Recalculates SHA-256 hash if content/title/type changed.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    await requireAuth(request, { requiredScope: "write" });

    const { id } = await params;
    const body = await parseJsonBody<UpdateMemoryInput>(request);
    const updated = await updateMemory(id, body);

    return successResponse(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/memories/[id]
 * Soft-archives a memory item by setting status = ARCHIVED.
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    await requireAuth(request, { requiredScope: "admin" });

    const { id } = await params;
    const archived = await archiveMemory(id);

    return successResponse(archived);
  } catch (error) {
    return handleApiError(error);
  }
}

