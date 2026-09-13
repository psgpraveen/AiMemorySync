import { prisma } from "@/lib/prisma";
import { NotFoundError, ValidationError, ForbiddenError } from "@/lib/errors";
import {
  contextOptionsSchema,
  projectIdSchema,
  type ContextOptions,
} from "@/validations/context.validation";
import type { Memory, MemoryPriority, MemoryType } from "@prisma/client";

/**
 * Priority weighting for deterministic context selection:
 * CRITICAL (4) -> HIGH (3) -> NORMAL (2) -> LOW (1)
 */
const PRIORITY_WEIGHT: Record<MemoryPriority, number> = {
  CRITICAL: 4,
  HIGH: 3,
  NORMAL: 2,
  LOW: 1,
};

/**
 * Type hierarchy weighting for tie-breaking:
 * DECISION (4) -> REQUIREMENT (3) -> CONVENTION (2) -> BUG_SOLUTION (1)
 */
const TYPE_WEIGHT: Record<MemoryType, number> = {
  DECISION: 4,
  REQUIREMENT: 3,
  CONVENTION: 2,
  BUG_SOLUTION: 1,
};

/**
 * Context section headers for display grouping.
 */
const SECTION_HEADERS: Record<MemoryType, string> = {
  DECISION: "## Decisions",
  REQUIREMENT: "## Requirements",
  CONVENTION: "## Conventions",
  BUG_SOLUTION: "## Known Bug Solutions",
};

/**
 * Section rendering order for final Markdown output.
 */
const SECTION_ORDER: MemoryType[] = [
  "DECISION",
  "REQUIREMENT",
  "CONVENTION",
  "BUG_SOLUTION",
];

export interface ContextResult {
  projectId: string | null;
  projectName: string | null;
  context: string;
  includedMemoryCount: number;
  excludedMemoryCount: number;
  budget: number;
  usedCharacters: number;
}

export interface AssembleContextOptions {
  projectId?: string | null;
  budget?: number;
  types?: MemoryType[];
}

/**
 * Formats a list of selected memories into clean, grouped Markdown context for a project.
 * Does NOT expose UUIDs, timestamps, hashes, or database IDs.
 */
export function formatContextMarkdown(
  projectName: string,
  memories: Memory[]
): string {
  const header = `# Project Context\n\nProject: ${projectName}`;

  if (memories.length === 0) {
    return `${header}\n\nNo active project memory is currently available.`;
  }

  // Group memories by type
  const grouped: Partial<Record<MemoryType, Memory[]>> = {};
  for (const memory of memories) {
    if (!grouped[memory.type]) {
      grouped[memory.type] = [];
    }
    grouped[memory.type]!.push(memory);
  }

  const sections: string[] = [];

  for (const type of SECTION_ORDER) {
    const items = grouped[type];
    if (!items || items.length === 0) continue;

    const sectionTitle = SECTION_HEADERS[type];
    const itemBlocks = items.map(
      (m) => `### ${m.title}\n\n${m.content}`
    );

    sections.push(`${sectionTitle}\n\n${itemBlocks.join("\n\n---\n\n")}`);
  }

  return `${header}\n\n${sections.join("\n\n---\n\n")}`;
}

/**
 * Formats a list of selected memories into clean, grouped Markdown context for a workspace/tenant.
 */
export function formatWorkspaceContextMarkdown(
  tenantName: string,
  memories: Memory[]
): string {
  const header = `# Workspace Context\n\nTenant: ${tenantName}`;

  if (memories.length === 0) {
    return `${header}\n\nNo active workspace memory is currently available.`;
  }

  // Group memories by type
  const grouped: Partial<Record<MemoryType, Memory[]>> = {};
  for (const memory of memories) {
    if (!grouped[memory.type]) {
      grouped[memory.type] = [];
    }
    grouped[memory.type]!.push(memory);
  }

  const sections: string[] = [];

  for (const type of SECTION_ORDER) {
    const items = grouped[type];
    if (!items || items.length === 0) continue;

    const sectionTitle = SECTION_HEADERS[type];
    const itemBlocks = items.map(
      (m) => `### ${m.title}\n\n${m.content}`
    );

    sections.push(`${sectionTitle}\n\n${itemBlocks.join("\n\n---\n\n")}`);
  }

  return `${header}\n\n${sections.join("\n\n---\n\n")}`;
}

/**
 * Deterministic multi-tier sort for memory selection:
 * Tier 1: Priority (CRITICAL -> HIGH -> NORMAL -> LOW)
 * Tier 2: Type (DECISION -> REQUIREMENT -> CONVENTION -> BUG_SOLUTION)
 * Tier 3: Recency (updatedAt DESC)
 * Tier 4: Creation (createdAt DESC)
 * Tier 5: Stable tie-breaker (id ASC)
 */
function sortMemoriesForContext(memories: Memory[]): Memory[] {
  return [...memories].sort((a, b) => {
    const pDiff = PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
    if (pDiff !== 0) return pDiff;

    const tDiff = TYPE_WEIGHT[b.type] - TYPE_WEIGHT[a.type];
    if (tDiff !== 0) return tDiff;

    const uDiff = b.updatedAt.getTime() - a.updatedAt.getTime();
    if (uDiff !== 0) return uDiff;

    const cDiff = b.createdAt.getTime() - a.createdAt.getTime();
    if (cDiff !== 0) return cDiff;

    return a.id.localeCompare(b.id);
  });
}

/**
 * Assembles active context (tenant-level or project-level) with deterministic prioritization,
 * character budget enforcement, and type-grouped Markdown formatting.
 *
 * Scopes:
 * - If projectId is specified: assembles project memories + tenant memories, strictly isolating other projects.
 * - If projectId is omitted/null: assembles tenant-level memories only (projectId = null).
 *
 * Enforces tenant ownership and machine key project scoping (project-scoped keys cannot access tenant-level context).
 */
export async function assembleContext(
  options: AssembleContextOptions,
  tenantId?: string,
  allowedProjectId?: string
): Promise<ContextResult> {
  const optionsValidation = contextOptionsSchema.safeParse({
    budget: options.budget,
    types: options.types,
  });
  if (!optionsValidation.success) {
    throw new ValidationError(
      "Invalid context generation options",
      optionsValidation.error.flatten()
    );
  }

  const { budget, types } = optionsValidation.data;
  const resolvedTenantId = tenantId ?? "00000000-0000-0000-0000-000000000001";

  if (options.projectId) {
    const idValidation = projectIdSchema.safeParse(options.projectId);
    if (!idValidation.success) {
      throw new ValidationError(
        "Invalid project ID format",
        idValidation.error.flatten()
      );
    }

    // Enforce project-scoped key check
    if (allowedProjectId && options.projectId !== allowedProjectId) {
      throw new ForbiddenError(
        `API key is scoped exclusively to project '${allowedProjectId}' and cannot access '${options.projectId}'`
      );
    }

    // Verify project exists within tenant
    const project = await prisma.project.findFirst({
      where: {
        id: options.projectId,
        tenantId: resolvedTenantId,
      },
    });

    if (!project) {
      throw new NotFoundError(
        `Project with ID '${options.projectId}' not found`,
        "PROJECT_NOT_FOUND",
        { projectId: options.projectId }
      );
    }

    // Retrieve ACTIVE memories: project memories + tenant memories (projectId = null)
    const activeMemories = await prisma.memory.findMany({
      where: {
        tenantId: resolvedTenantId,
        status: "ACTIVE",
        OR: [
          { projectId: project.id },
          { projectId: null },
        ],
        ...(types && types.length > 0 && { type: { in: types } }),
      },
    });

    const sortedMemories = sortMemoriesForContext(activeMemories);

    // Greedily select memories that fit within the character budget
    const selectedMemories: Memory[] = [];
    for (const candidate of sortedMemories) {
      const testCandidateList = [...selectedMemories, candidate];
      const formatted = formatContextMarkdown(project.name, testCandidateList);

      if (formatted.length <= budget) {
        selectedMemories.push(candidate);
      }
    }

    const finalContext = formatContextMarkdown(project.name, selectedMemories);

    return {
      projectId: project.id,
      projectName: project.name,
      context: finalContext,
      includedMemoryCount: selectedMemories.length,
      excludedMemoryCount: sortedMemories.length - selectedMemories.length,
      budget,
      usedCharacters: finalContext.length,
    };
  } else {
    // Tenant-level context request (no project)
    if (allowedProjectId) {
      throw new ForbiddenError(
        `API key is scoped exclusively to project '${allowedProjectId}' and cannot access tenant-level context`
      );
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: resolvedTenantId },
    });

    if (!tenant) {
      throw new NotFoundError(
        `Tenant with ID '${resolvedTenantId}' not found`,
        "TENANT_NOT_FOUND",
        { tenantId: resolvedTenantId }
      );
    }

    // Retrieve ACTIVE memories: tenant-level memories only (projectId = null)
    const activeMemories = await prisma.memory.findMany({
      where: {
        tenantId: resolvedTenantId,
        projectId: null,
        status: "ACTIVE",
        ...(types && types.length > 0 && { type: { in: types } }),
      },
    });

    const sortedMemories = sortMemoriesForContext(activeMemories);

    const selectedMemories: Memory[] = [];
    for (const candidate of sortedMemories) {
      const testCandidateList = [...selectedMemories, candidate];
      const formatted = formatWorkspaceContextMarkdown(tenant.name, testCandidateList);

      if (formatted.length <= budget) {
        selectedMemories.push(candidate);
      }
    }

    const finalContext = formatWorkspaceContextMarkdown(tenant.name, selectedMemories);

    return {
      projectId: null,
      projectName: null,
      context: finalContext,
      includedMemoryCount: selectedMemories.length,
      excludedMemoryCount: sortedMemories.length - selectedMemories.length,
      budget,
      usedCharacters: finalContext.length,
    };
  }
}

/**
 * Assembles active project context (backwards-compatible alias for assembleContext with projectId).
 */
export async function assembleProjectContext(
  projectId: string,
  rawOptions?: Partial<ContextOptions>,
  tenantId?: string,
  allowedProjectId?: string
): Promise<ContextResult> {
  return assembleContext(
    { ...rawOptions, projectId },
    tenantId,
    allowedProjectId
  );
}
