import type { ProjectDto } from "@aimemory/client-core";
import type { SessionState } from "./types/mcp.js";

export class McpSessionManager {
  private state: SessionState = {
    currentProject: null,
    resolvedAt: null,
    canonicalIdentity: null,
  };

  public getCurrentProject(): ProjectDto | null {
    return this.state.currentProject;
  }

  public getCanonicalIdentity(): string | null {
    return this.state.canonicalIdentity;
  }

  public getResolvedAt(): Date | null {
    return this.state.resolvedAt;
  }

  public setCurrentProject(project: ProjectDto, canonicalIdentity?: string): void {
    this.state.currentProject = project;
    this.state.canonicalIdentity = canonicalIdentity ?? null;
    this.state.resolvedAt = new Date();
  }

  public clear(): void {
    this.state.currentProject = null;
    this.state.resolvedAt = null;
    this.state.canonicalIdentity = null;
  }
}
