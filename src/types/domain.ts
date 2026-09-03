import type {
  Project,
  Memory,
  ProjectIdentity,
  ProjectSource,
  ProjectStatus,
  ProjectIdentityType,
  MemoryType,
  MemoryPriority,
  MemoryStatus,
} from "@prisma/client";
import type {
  CreateProjectInput,
  UpdateProjectInput,
} from "@/validations/project.validation";
import type {
  CreateMemoryInput,
  UpdateMemoryInput,
  ListMemoriesFilter,
} from "@/validations/memory.validation";
import type {
  ResolveProjectInput,
  DiscoverySignalsInput,
  DiscoverySourceInput,
} from "@/validations/discovery.validation";

export type {
  Project,
  Memory,
  ProjectIdentity,
  ProjectSource,
  ProjectStatus,
  ProjectIdentityType,
  MemoryType,
  MemoryPriority,
  MemoryStatus,
  CreateProjectInput,
  UpdateProjectInput,
  CreateMemoryInput,
  UpdateMemoryInput,
  ListMemoriesFilter,
  ResolveProjectInput,
  DiscoverySignalsInput,
  DiscoverySourceInput,
};

export interface DuplicateConflictDetails {
  existingMemoryId: string;
  projectId: string;
  contentHash: string;
  title: string;
}

export interface ResolveProjectResult {
  project: Project;
  matchedBy: ProjectIdentityType;
  canonicalIdentity: string;
  confidence: number;
  isNewlyCreated: boolean;
}

