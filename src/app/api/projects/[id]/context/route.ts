import { NextRequest } from "next/server";
import { assembleProjectContext } from "@/services/context.service";
import { contextQuerySchema } from "@/validations/context.validation";
import { successResponse } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import { ValidationError } from "@/lib/errors";
import { requireAuth } from "@/lib/api/auth-guard";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/projects/:projectId/context
 * Generates active, token/character-budgeted Markdown AI context for a project.
 * Supports optional ?budget=<int> and ?types=<type1,type2> query parameters.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    await requireAuth(request, { requiredScope: "read" });

    const { id: projectId } = await params;

    const { searchParams } = new URL(request.url);
    const rawBudget = searchParams.get("budget") ?? undefined;
    const rawTypes = searchParams.get("types") ?? undefined;

    const queryValidation = contextQuerySchema.safeParse({
      budget: rawBudget,
      types: rawTypes,
    });

    if (!queryValidation.success) {
      throw new ValidationError(
        "Invalid context query parameters",
        queryValidation.error.flatten()
      );
    }

    const contextResult = await assembleProjectContext(
      projectId,
      queryValidation.data
    );

    return successResponse(contextResult);
  } catch (error) {
    return handleApiError(error);
  }
}

