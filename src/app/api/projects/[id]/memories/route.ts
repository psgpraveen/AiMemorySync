import { NextRequest } from "next/server";
import {
  createMemory,
  listMemoriesByProject,
} from "@/services/memory.service";
import {
  listMemoriesFilterSchema,
  createMemorySchema,
  type CreateMemoryInput,
} from "@/validations/memory.validation";
import { projectIdSchema } from "@/validations/project.validation";
import { successResponse, createdResponse, parseJsonBody } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import { ValidationError } from "@/lib/errors";
import { requireAuth } from "@/lib/api/auth-guard";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/projects/:projectId/memories
 * Lists memories strictly scoped to the specified project.
 * Supports optional ?status, ?type, ?priority filters.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    await requireAuth(request, { requiredScope: "read" });

    const { id: projectId } = await params;

    // Validate project ID format from URL
    const idValidation = projectIdSchema.safeParse(projectId);
    if (!idValidation.success) {
      throw new ValidationError(
        "Invalid project ID format in route path",
        idValidation.error.flatten()
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || undefined;
    const type = searchParams.get("type") || undefined;
    const priority = searchParams.get("priority") || undefined;

    const filterValidation = listMemoriesFilterSchema.safeParse({
      projectId,
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

    const memories = await listMemoriesByProject(filterValidation.data);

    return successResponse(memories);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/projects/:projectId/memories
 * Creates a new memory strictly scoped to the project identified in the URL path.
 * The request body cannot override or conflict with the route's projectId.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    await requireAuth(request, { requiredScope: "write" });

    const { id: projectId } = await params;

    // Validate project ID format from URL
    const idValidation = projectIdSchema.safeParse(projectId);
    if (!idValidation.success) {
      throw new ValidationError(
        "Invalid project ID format in route path",
        idValidation.error.flatten()
      );
    }

    const rawBody = await parseJsonBody<Record<string, unknown>>(request);

    // Security check: reject conflicting projectId if passed in body
    if (rawBody.projectId !== undefined && rawBody.projectId !== projectId) {
      throw new ValidationError(
        "Conflicting projectId: request body projectId does not match route path parameter",
        { routeProjectId: projectId, bodyProjectId: rawBody.projectId }
      );
    }

    // Bind URL path projectId to creation payload
    const memoryPayload: CreateMemoryInput = {
      ...(rawBody as unknown as Omit<CreateMemoryInput, "projectId">),
      projectId,
    };

    // Pre-validate with createMemorySchema before delegating to service
    const schemaValidation = createMemorySchema.safeParse(memoryPayload);
    if (!schemaValidation.success) {
      throw new ValidationError(
        "Invalid memory creation payload",
        schemaValidation.error.flatten()
      );
    }

    const memory = await createMemory(schemaValidation.data);

    return createdResponse(memory);
  } catch (error) {
    return handleApiError(error);
  }
}

