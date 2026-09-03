export type MemoryType =
  | "DECISION"
  | "REQUIREMENT"
  | "CONVENTION"
  | "BUG_SOLUTION";

export type MemoryPriority = "CRITICAL" | "HIGH" | "NORMAL" | "LOW";

export type MemoryStatus = "ACTIVE" | "DEPRECATED" | "ARCHIVED";

/**
 * Client-facing Memory Data Transfer Object.
 */
export interface MemoryDto {
  id: string;
  projectId: string;
  type: MemoryType;
  title: string;
  content: string;
  priority: MemoryPriority;
  contentHash: string;
  status: MemoryStatus;
  createdAt: string;
  updatedAt: string;
}

/**
 * Payload for creating a new memory strictly scoped to a project.
 */
export interface CreateMemoryPayload {
  type: MemoryType;
  title: string;
  content: string;
  priority?: MemoryPriority;
}

/**
 * Payload for updating an existing memory.
 */
export interface UpdateMemoryPayload {
  title?: string;
  content?: string;
  type?: MemoryType;
  priority?: MemoryPriority;
  status?: MemoryStatus;
}

/**
 * Query filter for listing project memories.
 */
export interface ListMemoriesFilter {
  status?: MemoryStatus;
  type?: MemoryType;
  priority?: MemoryPriority;
}
