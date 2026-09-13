import { prisma } from "@/lib/prisma";
import {
  generateMemoryHash,
  normalizeContent,
  normalizeTitle,
} from "@/lib/hash";
import { NotFoundError, ConflictError, ValidationError, ForbiddenError } from "@/lib/errors";
import {
  createMemorySchema,
  updateMemorySchema,
  memoryIdSchema,
  listMemoriesFilterSchema,
  type CreateMemoryInput,
  type UpdateMemoryInput,
  type ListMemoriesFilter,
} from "@/validations/memory.validation";
import type { Memory, MemoryPriority, Prisma } from "@prisma/client";

/**
 * Creates a new Memory record for a project.
 *
 * Enforces:
 * 1. Project existence within the authenticated tenant
 * 2. Optional project-scoped API key restrictions
 * 3. Deterministic content and title normalization
 * 4. SHA-256 content hashing
 * 5. Project-isolated duplicate detection (identical hash in same project rejected)
 */
export async function createMemory(
  rawInput: CreateMemoryInput,
  tenantId?: string,
  allowedProjectId?: string
): Promise<Memory> {
  const parseResult = createMemorySchema.safeParse(rawInput);
  if (!parseResult.success) {
    throw new ValidationError(
      "Invalid memory input data",
      parseResult.error.flatten()
    );
  }

  const { projectId, type, title, content, priority, status } =
    parseResult.data;

  // Enforce machine key project scoping
  if (allowedProjectId) {
    if (!projectId) {
      throw new ForbiddenError(
        `API key is scoped exclusively to project '${allowedProjectId}' and cannot create tenant-level memories`
      );
    }
    if (projectId !== allowedProjectId) {
      throw new ForbiddenError(
        `API key is scoped exclusively to project '${allowedProjectId}' and cannot create memories in project '${projectId}'`
      );
    }
  }

  let targetTenantId: string;

  if (projectId) {
    // Verify project exists and belongs to the caller's tenant
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        ...(tenantId && { tenantId }),
      },
    });

    if (!project) {
      throw new NotFoundError(
        `Project with ID '${projectId}' not found`,
        "PROJECT_NOT_FOUND",
        { projectId }
      );
    }
    targetTenantId = project.tenantId;
  } else {
    // Tenant-level memory: resolve tenant
    targetTenantId = tenantId ?? "00000000-0000-0000-0000-000000000001";
    const tenant = await prisma.tenant.findUnique({
      where: { id: targetTenantId },
    });
    if (!tenant) {
      throw new NotFoundError(
        `Tenant with ID '${targetTenantId}' not found`,
        "TENANT_NOT_FOUND",
        { tenantId: targetTenantId }
      );
    }
  }

  const normalizedTitle = normalizeTitle(title);
  const normalizedContent = normalizeContent(content);
  const contentHash = generateMemoryHash(
    type,
    normalizedTitle,
    normalizedContent
  );

  // Check for duplicate within the same scope (tenant or project)
  const existingDuplicate = await prisma.memory.findFirst({
    where: {
      tenantId: targetTenantId,
      projectId: projectId ?? null,
      contentHash,
    },
  });

  if (existingDuplicate) {
    throw new ConflictError(
      projectId
        ? "Duplicate memory with identical type, title, and content already exists in this project"
        : "Duplicate memory with identical type, title, and content already exists in tenant scope",
      "MEMORY_DUPLICATE",
      {
        existingMemoryId: existingDuplicate.id,
        projectId: projectId ?? null,
        tenantId: targetTenantId,
        contentHash,
        title: existingDuplicate.title,
      }
    );
  }

  return prisma.memory.create({
    data: {
      tenantId: targetTenantId,
      projectId: projectId ?? null,
      type,
      title: normalizedTitle,
      content: normalizedContent,
      priority: priority ?? "NORMAL",
      status: status ?? "ACTIVE",
      contentHash,
    },
  });
}

/**
 * Retrieves a single Memory by its UUID, enforcing tenant boundary via parent project and optional project scope.
 */
export async function getMemoryById(
  id: string,
  tenantId?: string,
  allowedProjectId?: string
): Promise<Memory> {
  const parseResult = memoryIdSchema.safeParse(id);
  if (!parseResult.success) {
    throw new ValidationError(
      "Invalid memory ID format",
      parseResult.error.flatten()
    );
  }

  const memory = await prisma.memory.findUnique({
    where: { id },
  });

  // Return 404 if memory doesn't exist OR if its tenantId does not match (IDOR defense)
  if (!memory || (tenantId && memory.tenantId !== tenantId)) {
    throw new NotFoundError(
      `Memory with ID '${id}' not found`,
      "MEMORY_NOT_FOUND",
      { id }
    );
  }

  // If machine key is project-scoped, enforce project match (403)
  if (allowedProjectId && memory.projectId !== allowedProjectId) {
    throw new ForbiddenError(
      memory.projectId === null
        ? `API key is scoped exclusively to project '${allowedProjectId}' and cannot access tenant-level memories`
        : `API key is scoped exclusively to project '${allowedProjectId}' and cannot access memory in project '${memory.projectId}'`
    );
  }

  return memory;
}

/**
 * Priority weighting hierarchy: CRITICAL (4) -> HIGH (3) -> NORMAL (2) -> LOW (1)
 */
const PRIORITY_WEIGHT: Record<MemoryPriority, number> = {
  CRITICAL: 4,
  HIGH: 3,
  NORMAL: 2,
  LOW: 1,
};

/**
 * Lists memories with optional filters (scope, projectId, status, type, priority).
 * Enforces tenant ownership and project-scoped key constraints.
 * Guaranteed ordering: CRITICAL -> HIGH -> NORMAL -> LOW, then updatedAt DESC.
 */
export async function listMemories(
  filter: ListMemoriesFilter,
  tenantId?: string,
  allowedProjectId?: string
): Promise<Memory[]> {
  const parseResult = listMemoriesFilterSchema.safeParse(filter);
  if (!parseResult.success) {
    throw new ValidationError(
      "Invalid memory filter criteria",
      parseResult.error.flatten()
    );
  }

  const { projectId, scope, type, priority, status } = parseResult.data;

  // Enforce project-scoped key check
  if (allowedProjectId) {
    if (scope === "tenant") {
      throw new ForbiddenError(
        `API key is scoped exclusively to project '${allowedProjectId}' and cannot access tenant-level memories`
      );
    }
    if (projectId && projectId !== allowedProjectId) {
      throw new ForbiddenError(
        `API key is scoped exclusively to project '${allowedProjectId}' and cannot access project '${projectId}'`
      );
    }
  }

  const resolvedTenantId = tenantId ?? "00000000-0000-0000-0000-000000000001";

  // If specific project is requested, verify it exists within tenant
  if (projectId) {
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        tenantId: resolvedTenantId,
      },
    });

    if (!project) {
      throw new NotFoundError(
        `Project with ID '${projectId}' not found`,
        "PROJECT_NOT_FOUND",
        { projectId }
      );
    }
  }

  // Build where query
  const where: Prisma.MemoryWhereInput = {
    tenantId: resolvedTenantId,
    ...(status !== undefined && { status }),
    ...(type !== undefined && { type }),
    ...(priority !== undefined && { priority }),
  };

  if (allowedProjectId) {
    where.projectId = allowedProjectId;
  } else if (projectId) {
    if (scope === "all") {
      where.OR = [
        { projectId },
        { projectId: null },
      ];
    } else {
      where.projectId = projectId;
    }
  } else if (scope === "tenant") {
    where.projectId = null;
  } else if (scope === "project") {
    where.projectId = { not: null };
  }

  const memories = await prisma.memory.findMany({
    where,
    orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
  });

  // Deterministic application-level sort to guarantee strict business priority ordering:
  // CRITICAL -> HIGH -> NORMAL -> LOW, and within the same priority level, updatedAt DESC.
  return memories.sort((a, b) => {
    const pDiff = PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
    if (pDiff !== 0) return pDiff;
    return b.updatedAt.getTime() - a.updatedAt.getTime();
  });
}

/**
 * Lists memories for a project (backwards-compatible alias for listMemories).
 */
export async function listMemoriesByProject(
  filter: ListMemoriesFilter,
  tenantId?: string,
  allowedProjectId?: string
): Promise<Memory[]> {
  return listMemories(filter, tenantId, allowedProjectId);
}

/**
 * Updates an existing memory record within the authorized tenant and project scope.
 */
export async function updateMemory(
  id: string,
  rawInput: UpdateMemoryInput,
  tenantId?: string,
  allowedProjectId?: string
): Promise<Memory> {
  const idResult = memoryIdSchema.safeParse(id);
  if (!idResult.success) {
    throw new ValidationError(
      "Invalid memory ID format",
      idResult.error.flatten()
    );
  }

  const parseResult = updateMemorySchema.safeParse(rawInput);
  if (!parseResult.success) {
    throw new ValidationError(
      "Invalid memory update data",
      parseResult.error.flatten()
    );
  }

  // Verify memory exists within tenant and allowed project scope
  const existing = await getMemoryById(id, tenantId, allowedProjectId);

  const newType = parseResult.data.type ?? existing.type;
  const newTitle =
    parseResult.data.title !== undefined
      ? normalizeTitle(parseResult.data.title)
      : existing.title;
  const newContent =
    parseResult.data.content !== undefined
      ? normalizeContent(parseResult.data.content)
      : existing.content;

  let newContentHash = existing.contentHash;
  if (
    parseResult.data.type !== undefined ||
    parseResult.data.title !== undefined ||
    parseResult.data.content !== undefined
  ) {
    newContentHash = generateMemoryHash(newType, newTitle, newContent);

    // Check duplicate in same scope excluding this record
    const duplicate = await prisma.memory.findFirst({
      where: {
        tenantId: existing.tenantId,
        projectId: existing.projectId,
        contentHash: newContentHash,
        NOT: { id },
      },
    });

    if (duplicate) {
      throw new ConflictError(
        existing.projectId
          ? "Duplicate memory with identical type, title, and content already exists in this project"
          : "Duplicate memory with identical type, title, and content already exists in tenant scope",
        "MEMORY_DUPLICATE",
        {
          existingMemoryId: duplicate.id,
          projectId: existing.projectId,
          tenantId: existing.tenantId,
          contentHash: newContentHash,
          title: duplicate.title,
        }
      );
    }
  }

  return prisma.memory.update({
    where: { id },
    data: {
      ...(parseResult.data.type !== undefined && { type: newType }),
      ...(parseResult.data.title !== undefined && { title: newTitle }),
      ...(parseResult.data.content !== undefined && { content: newContent }),
      ...(parseResult.data.priority !== undefined && {
        priority: parseResult.data.priority,
      }),
      ...(parseResult.data.status !== undefined && {
        status: parseResult.data.status,
      }),
      contentHash: newContentHash,
    },
  });
}

/**
 * Soft-archives a memory item (status = ARCHIVED) within the authorized tenant.
 */
export async function archiveMemory(
  id: string,
  tenantId?: string,
  allowedProjectId?: string
): Promise<Memory> {
  await getMemoryById(id, tenantId, allowedProjectId);

  return prisma.memory.update({
    where: { id },
    data: { status: "ARCHIVED" },
  });
}

/**
 * Soft-deprecates a memory item (status = DEPRECATED) within the authorized tenant.
 */
export async function deprecateMemory(
  id: string,
  tenantId?: string,
  allowedProjectId?: string
): Promise<Memory> {
  await getMemoryById(id, tenantId, allowedProjectId);

  return prisma.memory.update({
    where: { id },
    data: { status: "DEPRECATED" },
  });
}
