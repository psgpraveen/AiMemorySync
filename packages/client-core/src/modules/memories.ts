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
   * Lists tenant-level memories (projectId = null).
   */
  async listTenant(filter?: ListMemoriesFilter): Promise<MemoryDto[]> {
    const filterKey = `${filter?.status ?? "ALL"}_${filter?.type ?? "ALL"}_${filter?.priority ?? "ALL"}`;
    const cacheKey = `memories:tenant:${filterKey}`;
    const cached = await this.cache.get<MemoryDto[]>(cacheKey);
    if (cached) return cached;

    const query: Record<string, string> = { scope: "tenant" };
    if (filter?.status) query.status = filter.status;
    if (filter?.type) query.type = filter.type;
    if (filter?.priority) query.priority = filter.priority;

    const memories = await this.http.request<MemoryDto[]>(`/api/memories`, {
      method: "GET",
      query,
    });

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
   * Creates a new memory record (scoped to a project if projectId is provided, or tenant-level if null/omitted).
   */
  async create(projectId: string | null | undefined, payload: CreateMemoryPayload): Promise<MemoryDto> {
    const targetProjectId = projectId ?? payload.projectId ?? null;

    let memory: MemoryDto;
    if (targetProjectId) {
      memory = await this.http.request<MemoryDto>(
        `/api/projects/${encodeURIComponent(targetProjectId)}/memories`,
        {
          method: "POST",
          body: JSON.stringify(payload),
        }
      );
    } else {
      memory = await this.http.request<MemoryDto>(`/api/memories`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    }

    await this.invalidateMemories(targetProjectId);
    this.events.emit("memory:created", { memory });
    return memory;
  }

  /**
   * Creates a tenant-level personal/cross-project memory record (projectId = null).
   */
  async createTenant(payload: CreateMemoryPayload): Promise<MemoryDto> {
    return this.create(null, payload);
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
    await this.invalidateMemories(memory.projectId);
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
    await this.invalidateMemories(memory.projectId);
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
    await this.invalidateMemories(memory.projectId);
    this.events.emit("memory:archived", { memoryId: id, projectId: memory.projectId ?? "" });
    return memory;
  }

  private async invalidateMemories(projectId: string | null): Promise<void> {
    if (projectId) {
      if (this.cache.deletePrefix) {
        await this.cache.deletePrefix(`memories:${projectId}:`);
        await this.cache.deletePrefix(`context:${projectId}:`);
      } else {
        await this.cache.delete(`context:${projectId}:default`);
      }
      this.events.emit("context:updated", { projectId });
    } else {
      if (this.cache.deletePrefix) {
        await this.cache.deletePrefix(`memories:tenant:`);
        await this.cache.deletePrefix(`context:tenant:`);
      }
    }
  }
}

