import { prisma } from "@/lib/prisma";
import { normalizeSlug } from "@/lib/hash";
import { NotFoundError, ConflictError, ValidationError, ForbiddenError } from "@/lib/errors";
import { DEFAULT_LEGACY_TENANT_ID } from "@/config/tenant";
import {
  createProjectSchema,
  updateProjectSchema,
  projectIdSchema,
  projectSlugSchema,
  type CreateProjectInput,
  type UpdateProjectInput,
} from "@/validations/project.validation";
import type { Project, ProjectStatus } from "@prisma/client";

/**
 * Creates a new Project within the specified tenant after validating input and verifying tenant-scoped slug uniqueness.
 */
export async function createProject(
  rawInput: CreateProjectInput,
  tenantId: string = DEFAULT_LEGACY_TENANT_ID
): Promise<Project> {
  const parseResult = createProjectSchema.safeParse(rawInput);
  if (!parseResult.success) {
    throw new ValidationError(
      "Invalid project input data",
      parseResult.error.flatten()
    );
  }

  const { name, description, status } = parseResult.data;
  const rawSlug = parseResult.data.slug || name;
  const normalizedSlug = normalizeSlug(rawSlug);

  const slugValidation = projectSlugSchema.safeParse(normalizedSlug);
  if (!slugValidation.success) {
    throw new ValidationError(
      "Normalized slug is invalid",
      slugValidation.error.flatten()
    );
  }

  // Enforce slug uniqueness within the target tenant
  const existing = await prisma.project.findFirst({
    where: { slug: normalizedSlug, tenantId },
  });

  if (existing) {
    throw new ConflictError(
      `Project with slug '${normalizedSlug}' already exists in this workspace`,
      "PROJECT_SLUG_CONFLICT",
      { slug: normalizedSlug, tenantId }
    );
  }

  return prisma.project.create({
    data: {
      tenantId,
      name,
      slug: normalizedSlug,
      description: description ?? null,
      status: status ?? "ACTIVE",
    },
  });
}

/**
 * Retrieves a Project by its UUID, enforcing tenant boundary and optional machine key project scope.
 */
export async function getProjectById(
  id: string,
  tenantId?: string,
  allowedProjectId?: string
): Promise<Project> {
  const parseResult = projectIdSchema.safeParse(id);
  if (!parseResult.success) {
    throw new ValidationError(
      "Invalid project ID format",
      parseResult.error.flatten()
    );
  }

  if (allowedProjectId && id !== allowedProjectId) {
    throw new ForbiddenError(
      `API key is scoped exclusively to project '${allowedProjectId}' and cannot access '${id}'`
    );
  }

  const project = await prisma.project.findFirst({
    where: {
      id,
      ...(tenantId && { tenantId }),
    },
  });

  if (!project) {
    throw new NotFoundError(
      `Project with ID '${id}' not found`,
      "PROJECT_NOT_FOUND",
      { id }
    );
  }

  return project;
}

/**
 * Retrieves a Project by its slug within the specified tenant.
 */
export async function getProjectBySlug(
  slug: string,
  tenantId: string = DEFAULT_LEGACY_TENANT_ID
): Promise<Project> {
  const normalized = normalizeSlug(slug);
  const parseResult = projectSlugSchema.safeParse(normalized);
  if (!parseResult.success) {
    throw new ValidationError(
      "Invalid project slug format",
      parseResult.error.flatten()
    );
  }

  const project = await prisma.project.findFirst({
    where: { slug: normalized, tenantId },
  });

  if (!project) {
    throw new NotFoundError(
      `Project with slug '${normalized}' not found`,
      "PROJECT_NOT_FOUND",
      { slug: normalized, tenantId }
    );
  }

  return project;
}

/**
 * Lists projects within the specified tenant, optionally filtered by status and project scope.
 */
export async function listProjects(filter?: {
  status?: ProjectStatus;
  tenantId?: string;
  projectId?: string;
}): Promise<Project[]> {
  const status = filter?.status ?? "ACTIVE";

  return prisma.project.findMany({
    where: {
      status,
      ...(filter?.tenantId && { tenantId: filter.tenantId }),
      ...(filter?.projectId && { id: filter.projectId }),
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Updates an existing project's fields, strictly scoped to the tenant.
 */
export async function updateProject(
  id: string,
  rawInput: UpdateProjectInput,
  tenantId?: string,
  allowedProjectId?: string
): Promise<Project> {
  const idResult = projectIdSchema.safeParse(id);
  if (!idResult.success) {
    throw new ValidationError(
      "Invalid project ID format",
      idResult.error.flatten()
    );
  }

  const parseResult = updateProjectSchema.safeParse(rawInput);
  if (!parseResult.success) {
    throw new ValidationError(
      "Invalid project update data",
      parseResult.error.flatten()
    );
  }

  // Verify project exists within tenant and matches project scope
  await getProjectById(id, tenantId, allowedProjectId);

  let newSlug: string | undefined = undefined;
  if (parseResult.data.slug !== undefined) {
    newSlug = normalizeSlug(parseResult.data.slug);
    const slugResult = projectSlugSchema.safeParse(newSlug);
    if (!slugResult.success) {
      throw new ValidationError(
        "Invalid updated slug format",
        slugResult.error.flatten()
      );
    }

    const slugConflict = await prisma.project.findFirst({
      where: {
        slug: newSlug,
        ...(tenantId && { tenantId }),
        NOT: { id },
      },
    });

    if (slugConflict) {
      throw new ConflictError(
        `Project with slug '${newSlug}' already exists in this workspace`,
        "PROJECT_SLUG_CONFLICT",
        { slug: newSlug }
      );
    }
  }

  return prisma.project.update({
    where: { id },
    data: {
      ...(parseResult.data.name !== undefined && { name: parseResult.data.name }),
      ...(newSlug !== undefined && { slug: newSlug }),
      ...(parseResult.data.description !== undefined && {
        description: parseResult.data.description,
      }),
      ...(parseResult.data.status !== undefined && {
        status: parseResult.data.status,
      }),
    },
  });
}

/**
 * Soft-archives a project by setting its status to ARCHIVED within the tenant.
 */
export async function archiveProject(
  id: string,
  tenantId?: string,
  allowedProjectId?: string
): Promise<Project> {
  await getProjectById(id, tenantId, allowedProjectId);

  return prisma.project.update({
    where: { id },
    data: { status: "ARCHIVED" },
  });
}
