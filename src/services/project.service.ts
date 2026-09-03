import { prisma } from "@/lib/prisma";
import { normalizeSlug } from "@/lib/hash";
import { NotFoundError, ConflictError, ValidationError } from "@/lib/errors";
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
 * Creates a new Project after validating input and verifying slug uniqueness.
 */
export async function createProject(
  rawInput: CreateProjectInput
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

  const existing = await prisma.project.findUnique({
    where: { slug: normalizedSlug },
  });

  if (existing) {
    throw new ConflictError(
      `Project with slug '${normalizedSlug}' already exists`,
      "PROJECT_SLUG_CONFLICT",
      { slug: normalizedSlug }
    );
  }

  return prisma.project.create({
    data: {
      name,
      slug: normalizedSlug,
      description: description ?? null,
      status: status ?? "ACTIVE",
    },
  });
}

/**
 * Retrieves a Project by its UUID.
 */
export async function getProjectById(id: string): Promise<Project> {
  const parseResult = projectIdSchema.safeParse(id);
  if (!parseResult.success) {
    throw new ValidationError(
      "Invalid project ID format",
      parseResult.error.flatten()
    );
  }

  const project = await prisma.project.findUnique({
    where: { id },
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
 * Retrieves a Project by its unique slug.
 */
export async function getProjectBySlug(slug: string): Promise<Project> {
  const normalized = normalizeSlug(slug);
  const parseResult = projectSlugSchema.safeParse(normalized);
  if (!parseResult.success) {
    throw new ValidationError(
      "Invalid project slug format",
      parseResult.error.flatten()
    );
  }

  const project = await prisma.project.findUnique({
    where: { slug: normalized },
  });

  if (!project) {
    throw new NotFoundError(
      `Project with slug '${normalized}' not found`,
      "PROJECT_NOT_FOUND",
      { slug: normalized }
    );
  }

  return project;
}

/**
 * Lists projects, optionally filtered by status (defaults to ACTIVE).
 */
export async function listProjects(filter?: {
  status?: ProjectStatus;
}): Promise<Project[]> {
  const status = filter?.status ?? "ACTIVE";

  return prisma.project.findMany({
    where: { status },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Updates an existing project's fields. If slug is modified, enforces uniqueness.
 */
export async function updateProject(
  id: string,
  rawInput: UpdateProjectInput
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

  // Verify project existence
  await getProjectById(id);

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
        NOT: { id },
      },
    });

    if (slugConflict) {
      throw new ConflictError(
        `Project with slug '${newSlug}' already exists`,
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
 * Soft-archives a project by setting its status to ARCHIVED.
 */
export async function archiveProject(id: string): Promise<Project> {
  await getProjectById(id);

  return prisma.project.update({
    where: { id },
    data: { status: "ARCHIVED" },
  });
}
