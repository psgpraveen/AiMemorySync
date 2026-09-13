import { NextRequest } from "next/server";
import { assembleContext } from "@/services/context.service";
import { contextQuerySchema } from "@/validations/context.validation";
import { successResponse } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import { ValidationError } from "@/lib/errors";
import { requireAuth } from "@/lib/api/auth-guard";

/**
 * GET /api/context
 * Assembles unified context for agents across platforms:
 * - If ?projectId=<UUID> is specified: combines project memories with tenant memories
 * - If no projectId is specified: assembles workspace / tenant-level memories (projectId = null)
 * Enforces tenant boundary, character budget, and machine key scoping (project-scoped keys cannot assemble tenant context).
 */
export async function GET(request: NextRequest) {
  try {
    const principal = await requireAuth(request, { requiredScope: "read" });

    const { searchParams } = new URL(request.url);
    const rawProjectId = searchParams.get("projectId") ?? undefined;
    const rawBudget = searchParams.get("budget") ?? undefined;
    const rawTypes = searchParams.get("types") ?? undefined;

    const queryValidation = contextQuerySchema.safeParse({
      projectId: rawProjectId,
      budget: rawBudget,
      types: rawTypes,
    });

    if (!queryValidation.success) {
      throw new ValidationError(
        "Invalid context query parameters",
        queryValidation.error.flatten()
      );
    }

    const contextResult = await assembleContext(
      queryValidation.data,
      principal.tenantId,
      principal.projectId
    );

    return successResponse(contextResult);
  } catch (error) {
    return handleApiError(error);
  }
}
