import { NextRequest } from "next/server";
import { createProject, listProjects } from "@/services/project.service";
import {
  projectStatusSchema,
  type CreateProjectInput,
} from "@/validations/project.validation";
import { successResponse, createdResponse, parseJsonBody } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import { ValidationError } from "@/lib/errors";
import { requireAuth } from "@/lib/api/auth-guard";

/**
 * GET /api/projects
 * Lists projects. Supports optional ?status=ACTIVE | ARCHIVED query filter.
 */
export async function GET(request: NextRequest) {
  try {
    await requireAuth(request, { requiredScope: "read" });

    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get("status");

    let statusFilter: "ACTIVE" | "ARCHIVED" | undefined = undefined;
    if (statusParam) {
      const statusValidation = projectStatusSchema.safeParse(statusParam);
      if (!statusValidation.success) {
        throw new ValidationError(
          `Invalid status query parameter: '${statusParam}'. Allowed values: ACTIVE, ARCHIVED.`,
          statusValidation.error.flatten()
        );
      }
      statusFilter = statusValidation.data;
    }

    const projects = await listProjects(
      statusFilter ? { status: statusFilter } : undefined
    );

    return successResponse(projects);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/projects
 * Creates a new project with name, optional slug, and optional description.
 */
export async function POST(request: NextRequest) {
  try {
    await requireAuth(request, { requiredScope: "write" });

    const body = await parseJsonBody<CreateProjectInput>(request);
    const project = await createProject(body);

    return createdResponse(project);
  } catch (error) {
    return handleApiError(error);
  }
}

