import type { HttpClient } from "../transport/http-client.js";
import type { CacheAdapter } from "../adapters/cache.js";
import type { TypedEventEmitter } from "../events/event-emitter.js";
import type {
  MemoryDto,
  CreateMemoryPayload,
  UpdateMemoryPayload,
  ListMemoriesFilter,
} from "../types/index.js";

export class MemoriesModule {
  constructor(
    private readonly http: HttpClient,
    private readonly cache: CacheAdapter,
    private readonly events: TypedEventEmitter
  ) {}

  /**
   * Lists memories strictly scoped to a specified project.
   */
  async list(projectId: string, filter?: ListMemoriesFilter): Promise<MemoryDto[]> {
    const filterKey = `${filter?.status ?? "ALL"}_${filter?.type ?? "ALL"}_${filter?.priority ?? "ALL"}`;
    const cacheKey = `memories:${projectId}:${filterKey}`;
    const cached = await this.cache.get<MemoryDto[]>(cacheKey);
    if (cached) return cached;

    const query: Record<string, string> = {};
    if (filter?.status) query.status = filter.status;
    if (filter?.type) query.type = filter.type;
    if (filter?.priority) query.priority = filter.priority;

    const memories = await this.http.request<MemoryDto[]>(
      `/api/projects/${encodeURIComponent(projectId)}/memories`,
      {
        method: "GET",
        query,
      }
    );

    await this.cache.set(cacheKey, memories, { ttlMs: 30000 }); // 30s cache
    return memories;
  }

  /**
   * Retrieves a single memory item by its UUID.
   */
  async get(id: string): Promise<MemoryDto> {
    const cacheKey = `memory:${id}`;
    const cached = await this.cache.get<MemoryDto>(cacheKey);
    if (cached) return cached;

    const memory = await this.http.request<MemoryDto>(`/api/memories/${encodeURIComponent(id)}`, {
      method: "GET",
    });

    await this.cache.set(cacheKey, memory, { ttlMs: 60000 }); // 60s cache
    return memory;
  }

  /**
   * Creates a new memory record strictly scoped to a project.
   */
  async create(projectId: string, payload: CreateMemoryPayload): Promise<MemoryDto> {
    const memory = await this.http.request<MemoryDto>(
      `/api/projects/${encodeURIComponent(projectId)}/memories`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    );

    await this.invalidateProjectMemories(projectId);
    this.events.emit("memory:created", { memory });
    return memory;
  }

  /**
   * Updates an existing memory record.
   */
  async update(id: string, payload: UpdateMemoryPayload): Promise<MemoryDto> {
    const memory = await this.http.request<MemoryDto>(`/api/memories/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });

    await this.cache.delete(`memory:${id}`);
    await this.invalidateProjectMemories(memory.projectId);
    this.events.emit("memory:updated", { memory });
    return memory;
  }

  /**
   * Soft-deprecates a memory record.
   */
  async deprecate(id: string): Promise<MemoryDto> {
    const memory = await this.http.request<MemoryDto>(`/api/memories/${encodeURIComponent(id)}/deprecate`, {
      method: "POST",
    });

    await this.cache.delete(`memory:${id}`);
    await this.invalidateProjectMemories(memory.projectId);
    this.events.emit("memory:deprecated", { memory });
    return memory;
  }

  /**
   * Soft-archives a memory record.
   */
  async archive(id: string): Promise<MemoryDto> {
    const memory = await this.http.request<MemoryDto>(`/api/memories/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });

    await this.cache.delete(`memory:${id}`);
    await this.invalidateProjectMemories(memory.projectId);
    this.events.emit("memory:archived", { memoryId: id, projectId: memory.projectId });
    return memory;
  }

  private async invalidateProjectMemories(projectId: string): Promise<void> {
    // Clear project context cache and memory list caches
    await this.cache.delete(`context:${projectId}:default`);
    this.events.emit("context:updated", { projectId });
  }
}
