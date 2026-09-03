import type { HttpClient } from "../transport/http-client.js";
import type { CacheAdapter } from "../adapters/cache.js";
import type { ContextOptions, AssembledContextResult } from "../types/index.js";

export class ContextModule {
  constructor(
    private readonly http: HttpClient,
    private readonly cache: CacheAdapter
  ) {}

  /**
   * Generates active, token/character-budgeted Markdown AI context for a project.
   */
  async get(projectId: string, options?: ContextOptions): Promise<AssembledContextResult> {
    const budget = options?.budget ?? 8000;
    const typesKey = options?.types ? [...options.types].sort().join(",") : "ALL";
    const cacheKey = `context:${projectId}:${budget}:${typesKey}`;


    const cached = await this.cache.get<AssembledContextResult>(cacheKey);
    if (cached) return cached;

    const query: Record<string, string | number> = {};
    if (options?.budget) query.budget = options.budget;
    if (options?.types && options.types.length > 0) {
      query.types = options.types.join(",");
    }

    const result = await this.http.request<AssembledContextResult>(
      `/api/projects/${encodeURIComponent(projectId)}/context`,
      {
        method: "GET",
        query,
      }
    );

    await this.cache.set(cacheKey, result, { ttlMs: 15000 }); // 15s cache
    return result;
  }
}
