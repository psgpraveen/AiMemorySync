import type { MemoryType, MemoryPriority } from "./memory.js";

/**
 * Options for context assembly generation.
 */
export interface ContextOptions {
  budget?: number; // Character budget (min: 1000, max: 50000, default: 8000)
  types?: MemoryType[];
}

/**
 * Section metadata of a memory included in the assembled context.
 */
export interface AssembledContextSection {
  memoryId: string;
  type: MemoryType;
  title: string;
  priority: MemoryPriority;
  characters: number;
  content: string;
}

/**
 * Assembled AI context result payload for a project.
 */
export interface AssembledContextResult {
  projectId: string;
  projectName: string;
  budget: {
    requested: number;
    usedCharacters: number;
    remainingCharacters: number;
    itemCount: number;
  };
  markdown: string;
  includedMemories: AssembledContextSection[];
}
