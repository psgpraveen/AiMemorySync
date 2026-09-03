export type ProjectStatus = "ACTIVE" | "ARCHIVED";
export type ProjectCreationSource = "MANUAL" | "AUTO_DISCOVERY";

/**
 * Client-facing Project Data Transfer Object.
 */
export interface ProjectDto {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: ProjectStatus;
  creationSource: ProjectCreationSource;
  createdAt: string;
  updatedAt: string;
}

/**
 * Payload for creating a new project.
 */
export interface CreateProjectPayload {
  name: string;
  slug?: string;
  description?: string;
}

/**
 * Payload for updating an existing project.
 */
export interface UpdateProjectPayload {
  name?: string;
  slug?: string;
  description?: string;
  status?: ProjectStatus;
}

/**
 * Query filter for listing projects.
 */
export interface ListProjectsFilter {
  status?: ProjectStatus;
}
