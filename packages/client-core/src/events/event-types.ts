import type { ProjectDto, ResolveProjectResult } from "../types/index.js";
import type { MemoryDto } from "../types/index.js";
import type { AuthenticationError, AuthorizationError, RateLimitError, NetworkError } from "../transport/errors.js";

/**
 * Standardized colon-separated lowercase event dictionary for AiMemorySync SDK.
 */
export interface AiMemoryEvents {
  "project:resolved": { result: ResolveProjectResult };
  "project:created": { project: ProjectDto };
  "project:updated": { project: ProjectDto };
  "project:archived": { projectId: string };

  "memory:created": { memory: MemoryDto };
  "memory:updated": { memory: MemoryDto };
  "memory:deprecated": { memory: MemoryDto };
  "memory:archived": { memoryId: string; projectId: string };

  "context:updated": { projectId: string };

  "auth:unauthorized": { error: AuthenticationError };
  "auth:forbidden": { error: AuthorizationError; requiredScope?: string };

  "rate-limit:exceeded": { error: RateLimitError; retryAfterSecs?: number };

  "network:error": { error: NetworkError };
}
