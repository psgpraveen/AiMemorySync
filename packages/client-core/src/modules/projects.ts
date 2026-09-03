import type { HttpClient } from "../transport/http-client.js";
import type { CacheAdapter } from "../adapters/cache.js";
import type { TypedEventEmitter } from "../events/event-emitter.js";
import type {
  ProjectDto,
  CreateProjectPayload,
  UpdateProjectPayload,
  ListProjectsFilter,
  ResolveProjectInput,
  ResolveProjectResult,
} from "../types/index.js";

export class ProjectsModule {
  constructor(
    private readonly http: HttpClient,
    private readonly cache: CacheAdapter,
    private readonly events: TypedEventEmitter
  ) {}

  /**
   * Resolves incoming discovery signals (Git remote, monorepo subpath, package manifest, etc.)
   * to an existing Project or automatically provisions a new one.
   */
  async resolve(input: ResolveProjectInput): Promise<ResolveProjectResult> {
    const result = await this.http.request<ResolveProjectResult>("/api/projects/resolve", {
      method: "POST",
      body: JSON.stringify(input),
    });

    this.events.emit("project:resolved", { result });
    if (result.isNewlyCreated) {
      this.events.emit("project:created", { project: result.project });
    }

    return result;
  }

  /**
   * Lists active or archived projects.
   */
  async list(filter?: ListProjectsFilter): Promise<ProjectDto[]> {
    const cacheKey = `projects:list:${filter?.status ?? "ALL"}`;
    const cached = await this.cache.get<ProjectDto[]>(cacheKey);
    if (cached) return cached;

    const query: Record<string, string> = {};
    if (filter?.status) query.status = filter.status;

    const projects = await this.http.request<ProjectDto[]>("/api/projects", {
      method: "GET",
      query,
    });

    await this.cache.set(cacheKey, projects, { ttlMs: 30000 }); // 30s cache
    return projects;
  }

  /**
   * Retrieves a single project by its UUID.
   */
  async get(id: string): Promise<ProjectDto> {
    const cacheKey = `project:${id}`;
    const cached = await this.cache.get<ProjectDto>(cacheKey);
    if (cached) return cached;

    const project = await this.http.request<ProjectDto>(`/api/projects/${encodeURIComponent(id)}`, {
      method: "GET",
    });

    await this.cache.set(cacheKey, project, { ttlMs: 60000 }); // 60s cache
    return project;
  }

  /**
   * Creates a new project manually.
   */
  async create(payload: CreateProjectPayload): Promise<ProjectDto> {
    const project = await this.http.request<ProjectDto>("/api/projects", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    await this.invalidateListCache();
    this.events.emit("project:created", { project });
    return project;
  }

  /**
   * Updates an existing project's fields.
   */
  async update(id: string, payload: UpdateProjectPayload): Promise<ProjectDto> {
    const project = await this.http.request<ProjectDto>(`/api/projects/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });

    await this.cache.delete(`project:${id}`);
    await this.invalidateListCache();
    this.events.emit("project:updated", { project });
    return project;
  }

  /**
   * Soft-archives a project.
   */
  async archive(id: string): Promise<ProjectDto> {
    const project = await this.http.request<ProjectDto>(`/api/projects/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });

    await this.cache.delete(`project:${id}`);
    await this.invalidateListCache();
    this.events.emit("project:archived", { projectId: id });
    return project;
  }

  private async invalidateListCache(): Promise<void> {
    if (this.cache.deletePrefix) {
      await this.cache.deletePrefix("projects:list:");
    } else {
      await this.cache.delete("projects:list:ALL");
      await this.cache.delete("projects:list:ACTIVE");
      await this.cache.delete("projects:list:ARCHIVED");
    }
  }
}
