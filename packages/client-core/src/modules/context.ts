import type { HttpClient } from "../transport/http-client.js";
import type { CacheAdapter } from "../adapters/cache.js";
import type { ContextOptions, AssembledContextResult } from "../types/index.js";

interface BackendContextResponse {
  projectId: string | null;
  projectName: string | null;
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
   * Generates active, token/character-budgeted Markdown AI context for a project or workspace.
   * If projectId is provided, combines project memories with workspace memories.
   * If projectId is omitted or null, returns pure workspace / personal memories.
   */
  async get(projectId?: string | null, options?: ContextOptions): Promise<AssembledContextResult> {
    const targetProject = projectId ?? null;
    const budget = options?.budget ?? 8000;
    const typesKey = options?.types ? [...options.types].sort().join(",") : "ALL";
    const cacheKey = `context:${targetProject ?? "tenant"}:${budget}:${typesKey}`;

    const cached = await this.cache.get<AssembledContextResult>(cacheKey);
    if (cached) return cached;

    const query: Record<string, string | number> = {};
    if (targetProject) query.projectId = targetProject;
    if (options?.budget) query.budget = options.budget;
    if (options?.types && options.types.length > 0) {
      query.types = options.types.join(",");
    }

    const raw = await this.http.request<BackendContextResponse>(
      targetProject
        ? `/api/projects/${encodeURIComponent(targetProject)}/context`
        : `/api/context`,
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
