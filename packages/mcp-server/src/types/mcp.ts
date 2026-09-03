import type { ProjectDto, MemoryDto, MemoryType, MemoryPriority } from "@aimemory/client-core";

export interface McpServerConfig {
  apiUrl: string;
  apiKey: string;
  debug: boolean;
}

export interface SessionState {
  currentProject: ProjectDto | null;
  resolvedAt: Date | null;
  canonicalIdentity: string | null;
}

export interface ResolveProjectToolResult {
  status: "RESOLVED";
  projectId: string;
  projectName: string;
  canonicalIdentity: string;
  matchedBy: string;
  confidence: number;
  isNewlyCreated: boolean;
}

export interface GetCurrentProjectToolResult {
  status: "RESOLVED" | "NOT_RESOLVED";
  project?: ProjectDto;
  canonicalIdentity?: string | null;
  resolvedAt?: string | null;
  message?: string;
}

export interface GetContextToolResult {
  projectId: string;
  projectName: string;
  markdown: string;
  budget: {
    requested: number;
    usedCharacters: number;
    remainingCharacters: number;
    itemCount: number;
  };
  tokenEstimate: number;
}
