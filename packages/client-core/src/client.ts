import type { ClientOptions } from "./config.js";
import { resolveConfig } from "./config.js";
import { HttpClient } from "./transport/http-client.js";
import { TypedEventEmitter } from "./events/event-emitter.js";
import { AuthModule } from "./modules/auth.js";
import { ProjectsModule } from "./modules/projects.js";
import { MemoriesModule } from "./modules/memories.js";
import { ContextModule } from "./modules/context.js";

/**
 * Main platform-independent client facade for AiMemorySync.
 */
export class AiMemoryClient {
  public readonly events: TypedEventEmitter;
  public readonly auth: AuthModule;
  public readonly projects: ProjectsModule;
  public readonly memories: MemoriesModule;
  public readonly context: ContextModule;

  private readonly http: HttpClient;

  constructor(options: ClientOptions) {
    const config = resolveConfig(options);

    this.events = new TypedEventEmitter();

    // Create auth module with secure storage
    this.auth = new AuthModule(
      // Pass a temporary lazy reference that resolves after HTTP client is constructed
      null as unknown as HttpClient,
      config.storage,
      config.initialApiKey
    );

    // Initialize resilient HTTP transport
    this.http = new HttpClient({
      baseUrl: config.baseUrl,
      getApiKey: () => this.auth.getApiKey(),
      platform: config.platform,
      clientId: config.clientId,
      timeoutMs: config.timeoutMs,
      maxRetries: config.maxRetries,
      fetch: config.fetch,
      logger: config.logger,
      events: this.events,
    });

    // Wire real HTTP client into AuthModule
    (this.auth as unknown as { http: HttpClient }).http = this.http;

    // Initialize domain modules
    this.projects = new ProjectsModule(this.http, config.cache, this.events);
    this.memories = new MemoriesModule(this.http, config.cache, this.events);
    this.context = new ContextModule(this.http, config.cache);
  }

  /**
   * Dynamically updates the base URL for subsequent HTTP requests.
   */
  setBaseUrl(url: string): void {
    this.http.setBaseUrl(url);
  }

  /**
   * Returns the current base URL.
   */
  getBaseUrl(): string {
    return this.http.getBaseUrl();
  }
}
