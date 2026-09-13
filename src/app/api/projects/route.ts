import { NextRequest } from "next/server";
import { createProject, listProjects } from "@/services/project.service";
import {
  projectStatusSchema,
  type CreateProjectInput,
} from "@/validations/project.validation";
import { successResponse, createdResponse, parseJsonBody } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import { ValidationError, ForbiddenError } from "@/lib/errors";
import { requireAuth } from "@/lib/api/auth-guard";

/**
 * GET /api/projects
 * Lists projects scoped strictly to the authenticated tenant.
 * If principal is a project-scoped machine key, returns only its assigned project.
 */
export async function GET(request: NextRequest) {
  try {
    const principal = await requireAuth(request, { requiredScope: "read" });

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

    const projects = await listProjects({
      status: statusFilter,
      tenantId: principal.tenantId,
      projectId: principal.projectId,
    });

    return successResponse(projects);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/projects
 * Creates a new project strictly scoped to the authenticated tenant.
 * Project-scoped machine keys are prohibited from provisioning new projects (403).
 */
export async function POST(request: NextRequest) {
  try {
    const principal = await requireAuth(request, { requiredScope: "write" });

    if (principal.projectId) {
      throw new ForbiddenError(
        "Project-scoped API key cannot create new projects"
      );
    }

    const body = await parseJsonBody<CreateProjectInput>(request);
    const project = await createProject(body, principal.tenantId);

    return createdResponse(project);
  } catch (error) {
    return handleApiError(error);
  }
}
