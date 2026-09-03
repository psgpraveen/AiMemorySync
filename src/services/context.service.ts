import { prisma } from "@/lib/prisma";
import { NotFoundError, ValidationError } from "@/lib/errors";
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
  projectId: string;
  projectName: string;
  context: string;
  includedMemoryCount: number;
  excludedMemoryCount: number;
  budget: number;
  usedCharacters: number;
}

/**
 * Formats a list of selected memories into clean, grouped Markdown context.
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
 * Assembles active project context with deterministic prioritization,
 * character budget enforcement, and type-grouped Markdown formatting.
 *
 * This operation is completely stateless and read-only.
 */
export async function assembleProjectContext(
  projectId: string,
  rawOptions?: Partial<ContextOptions>
): Promise<ContextResult> {
  // 1. Validate inputs
  const idValidation = projectIdSchema.safeParse(projectId);
  if (!idValidation.success) {
    throw new ValidationError(
      "Invalid project ID format",
      idValidation.error.flatten()
    );
  }

  const optionsValidation = contextOptionsSchema.safeParse(rawOptions ?? {});
  if (!optionsValidation.success) {
    throw new ValidationError(
      "Invalid context generation options",
      optionsValidation.error.flatten()
    );
  }

  const { budget, types } = optionsValidation.data;

  // 2. Verify project exists
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    throw new NotFoundError(
      `Project with ID '${projectId}' not found`,
      "PROJECT_NOT_FOUND",
      { projectId }
    );
  }

  // 3. Retrieve ACTIVE memories only (ARCHIVED and DEPRECATED are strictly excluded)
  const activeMemories = await prisma.memory.findMany({
    where: {
      projectId,
      status: "ACTIVE",
      ...(types && types.length > 0 && { type: { in: types } }),
    },
  });

  // 4. Deterministic multi-tier sort for selection:
  //    Tier 1: Priority (CRITICAL -> HIGH -> NORMAL -> LOW)
  //    Tier 2: Type (DECISION -> REQUIREMENT -> CONVENTION -> BUG_SOLUTION)
  //    Tier 3: Recency (updatedAt DESC)
  //    Tier 4: Creation (createdAt DESC)
  //    Tier 5: Stable tie-breaker (id ASC)
  const sortedMemories = [...activeMemories].sort((a, b) => {
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

  // 5. Greedily select memories that fit within the character budget
  //    A memory is either included completely or excluded completely (never partially cut).
  const selectedMemories: Memory[] = [];

  for (const candidate of sortedMemories) {
    const testCandidateList = [...selectedMemories, candidate];
    const formatted = formatContextMarkdown(project.name, testCandidateList);

    if (formatted.length <= budget) {
      selectedMemories.push(candidate);
    }
    // If candidate exceeds budget, it is omitted.
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
}
