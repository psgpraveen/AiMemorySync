import type { HttpClient } from "../transport/http-client.js";
import type { CacheAdapter } from "../adapters/cache.js";
import type { ContextOptions, AssembledContextResult } from "../types/index.js";

interface BackendContextResponse {
  projectId: string;
  projectName: string;
  context: string;
  includedMemoryCount: number;
  excludedMemoryCount: number;
  budget: number;
  usedCharacters: number;
}

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

    const raw = await this.http.request<BackendContextResponse>(
      `/api/projects/${encodeURIComponent(projectId)}/context`,
      {
        method: "GET",
        query,
      }
    );

    const result: AssembledContextResult = {
      projectId: raw.projectId,
      projectName: raw.projectName,
      markdown: raw.context ?? "",
      budget: {
        requested: raw.budget ?? budget,
        usedCharacters: raw.usedCharacters ?? 0,
        remainingCharacters: Math.max(0, (raw.budget ?? budget) - (raw.usedCharacters ?? 0)),
        itemCount: raw.includedMemoryCount ?? 0,
      },
      includedMemories: [],
    };

    await this.cache.set(cacheKey, result, { ttlMs: 15000 }); // 15s cache
    return result;
  }
}
