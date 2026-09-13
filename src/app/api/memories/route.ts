import { NextRequest } from "next/server";
import { createMemory, listMemories } from "@/services/memory.service";
import {
  createMemorySchema,
  listMemoriesFilterSchema,
  type CreateMemoryInput,
} from "@/validations/memory.validation";
import { successResponse, createdResponse, parseJsonBody } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import { ValidationError } from "@/lib/errors";
import { requireAuth } from "@/lib/api/auth-guard";

/**
 * GET /api/memories
 * Lists memories across tenant scopes:
 * - ?scope=tenant: tenant-level memories only (projectId = null)
 * - ?projectId=<UUID>: project-scoped memories
 * - ?scope=all: all memories accessible to the caller within the tenant
 * - Filters: ?status=..., ?type=..., ?priority=...
 */
export async function GET(request: NextRequest) {
  try {
    const principal = await requireAuth(request, { requiredScope: "read" });

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId") || undefined;
    const scope = searchParams.get("scope") || undefined;
    const status = searchParams.get("status") || undefined;
    const type = searchParams.get("type") || undefined;
    const priority = searchParams.get("priority") || undefined;

    const filterValidation = listMemoriesFilterSchema.safeParse({
      projectId,
      scope,
      status,
      type,
      priority,
    });

    if (!filterValidation.success) {
      throw new ValidationError(
        "Invalid memory filter criteria",
        filterValidation.error.flatten()
      );
    }

    const memories = await listMemories(
      filterValidation.data,
      principal.tenantId,
      principal.projectId
    );

    return successResponse(memories);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/memories
 * Creates a memory item:
 * - If projectId is omitted or null: creates tenant-level memory (projectId = null)
 * - If projectId is provided: creates project-scoped memory
 * Enforces tenant ownership and machine key scoping.
 */
export async function POST(request: NextRequest) {
  try {
    const principal = await requireAuth(request, { requiredScope: "write" });

    const rawBody = await parseJsonBody<CreateMemoryInput>(request);

    const schemaValidation = createMemorySchema.safeParse(rawBody);
    if (!schemaValidation.success) {
      throw new ValidationError(
        "Invalid memory creation payload",
        schemaValidation.error.flatten()
      );
    }

    const memory = await createMemory(
      schemaValidation.data,
      principal.tenantId,
      principal.projectId
    );

    return createdResponse(memory);
  } catch (error) {
    return handleApiError(error);
  }
}
