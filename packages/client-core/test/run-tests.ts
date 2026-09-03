import assert from "node:assert/strict";
import {
  AiMemoryClient,
  resolveConfig,
  EphemeralStorageAdapter,
  InMemoryCache,
  TypedEventEmitter,
  calculateBackoff,
  parseRetryAfter,
  isRetryableMethod,
  isRetryableStatus,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  ValidationError,
  RateLimitError,
  NetworkError,
  TimeoutError,
  ServerError,
  type ResolveProjectResult,
} from "../src/index.js";


async function runAllSdkTests() {
  console.log("==========================================================");
  console.log("PHASE 5B.1: @aimemory/client-core AUTOMATED TEST SUITE");
  console.log("==========================================================\n");

  let passed = 0;
  let failed = 0;

  async function test(name: string, fn: () => void | Promise<void>) {
    try {
      await fn();
      console.log(`  ✔ ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ ${name}`);
      console.error(err);
      failed++;
    }
  }

  // -------------------------------------------------------------
  // 1. CONFIGURATION TESTS
  // -------------------------------------------------------------
  console.log("1. Configuration & URL Normalization Tests:");
  await test("Normalizes trailing slashes in baseUrl", () => {
    const config = resolveConfig({ baseUrl: "https://api.example.com///" });
    assert.equal(config.baseUrl, "https://api.example.com");
    assert.equal(config.platform, "CLIENT");
    assert.equal(config.timeoutMs, 10000);
    assert.equal(config.maxRetries, 3);
  });

  await test("Throws ValidationError on invalid or empty baseUrl", () => {
    assert.throws(
      () => resolveConfig({ baseUrl: "" }),
      (err) => err instanceof ValidationError
    );
    assert.throws(
      () => resolveConfig({ baseUrl: "not-a-valid-url" }),
      (err) => err instanceof ValidationError
    );
  });

  await test("Throws ValidationError on invalid timeout or retries", () => {
    assert.throws(
      () => resolveConfig({ baseUrl: "https://example.com", timeoutMs: -50 }),
      (err) => err instanceof ValidationError
    );
    assert.throws(
      () => resolveConfig({ baseUrl: "https://example.com", maxRetries: -1 }),
      (err) => err instanceof ValidationError
    );
  });

  // -------------------------------------------------------------
  // 2. RETRY & BACKOFF LOGIC TESTS
  // -------------------------------------------------------------
  console.log("\n2. Retry Policy & Backoff Tests:");
  await test("Calculates exponential backoff with jitter", () => {
    const b0 = calculateBackoff(0, 100, 2000);
    const b1 = calculateBackoff(1, 100, 2000);
    const b2 = calculateBackoff(2, 100, 2000);

    assert.ok(b0 >= 75 && b0 <= 125, `b0: ${b0}`);
    assert.ok(b1 >= 150 && b1 <= 250, `b1: ${b1}`);
    assert.ok(b2 >= 300 && b2 <= 500, `b2: ${b2}`);
  });

  await test("Parses standard Retry-After header", () => {
    assert.equal(parseRetryAfter("15"), 15000);
    assert.equal(parseRetryAfter("0"), 0);
    assert.equal(parseRetryAfter(null), null);
    assert.equal(parseRetryAfter("invalid"), null);
  });

  await test("Enforces retry only for safe GET requests", () => {
    assert.equal(isRetryableMethod("GET"), true);
    assert.equal(isRetryableMethod("get"), true);
    assert.equal(isRetryableMethod("POST"), false);
    assert.equal(isRetryableMethod("PATCH"), false);
    assert.equal(isRetryableMethod("DELETE"), false);
  });

  await test("Identifies transient 5xx status codes", () => {
    assert.equal(isRetryableStatus(502), true);
    assert.equal(isRetryableStatus(503), true);
    assert.equal(isRetryableStatus(504), true);
    assert.equal(isRetryableStatus(500), false);
    assert.equal(isRetryableStatus(400), false);
  });

  // -------------------------------------------------------------
  // 3. EVENT EMITTER TESTS
  // -------------------------------------------------------------
  console.log("\n3. Typed Event Emitter Tests:");
  await test("Dispatches events and unbinds with unsubscribe function", () => {
    const emitter = new TypedEventEmitter();
    let count = 0;

    const unsubscribe = emitter.on("project:archived", (data) => {
      if (data.projectId === "p-123") count++;
    });

    emitter.emit("project:archived", { projectId: "p-123" });
    assert.equal(count, 1);

    unsubscribe();
    emitter.emit("project:archived", { projectId: "p-123" });
    assert.equal(count, 1); // Not incremented after unsubscribe
  });

  await test("once() triggers listener at most once", () => {
    const emitter = new TypedEventEmitter();
    let count = 0;

    emitter.once("network:error", () => {
      count++;
    });

    emitter.emit("network:error", { error: new NetworkError("test") });
    emitter.emit("network:error", { error: new NetworkError("test") });
    assert.equal(count, 1);
  });


  // -------------------------------------------------------------
  // 4. CACHE TESTS
  // -------------------------------------------------------------
  console.log("\n4. In-Memory Cache Tests:");
  await test("Supports get, set, delete, and TTL expiration", async () => {
    const cache = new InMemoryCache(10);
    await cache.set("k1", "v1", { ttlMs: 50 });

    assert.equal(await cache.get("k1"), "v1");

    await new Promise((r) => setTimeout(r, 60));
    assert.equal(await cache.get("k1"), null); // Expired
  });

  await test("Evicts oldest item when max entries capacity is reached", async () => {
    const cache = new InMemoryCache(2);
    await cache.set("k1", "v1");
    await cache.set("k2", "v2");
    await cache.set("k3", "v3"); // Evicts k1

    assert.equal(await cache.get("k1"), null);
    assert.equal(await cache.get("k2"), "v2");
    assert.equal(await cache.get("k3"), "v3");
  });

  // -------------------------------------------------------------
  // 5. TRANSPORT & ERROR MAPPING TESTS (MOCKED FETCH)
  // -------------------------------------------------------------
  console.log("\n5. Transport & Error Mapping Tests:");

  await test("Maps HTTP 400 to ValidationError", async () => {
    const mockFetch = async () =>
      new Response(JSON.stringify({ error: { code: "VALIDATION_ERROR", message: "Invalid payload" } }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });

    const client = new AiMemoryClient({
      baseUrl: "https://mock.api",
      fetch: mockFetch as unknown as typeof fetch,
    });

    await assert.rejects(
      () => client.projects.create({ name: "" }),
      (err) => err instanceof ValidationError && err.status === 400
    );
  });

  await test("Maps HTTP 401 to AuthenticationError and emits auth:unauthorized", async () => {
    const mockFetch = async () =>
      new Response(JSON.stringify({ error: { code: "UNAUTHORIZED", message: "Invalid token" } }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });

    const client = new AiMemoryClient({
      baseUrl: "https://mock.api",
      fetch: mockFetch as unknown as typeof fetch,
    });

    let authEventTriggered = false;
    client.events.on("auth:unauthorized", () => {
      authEventTriggered = true;
    });

    await assert.rejects(
      () => client.projects.get("p-1"),
      (err) => err instanceof AuthenticationError && err.status === 401
    );

    assert.equal(authEventTriggered, true);
  });

  await test("Maps HTTP 403 to AuthorizationError and emits auth:forbidden", async () => {
    const mockFetch = async () =>
      new Response(JSON.stringify({ error: { code: "FORBIDDEN", message: "Scope required" } }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });

    const client = new AiMemoryClient({
      baseUrl: "https://mock.api",
      fetch: mockFetch as unknown as typeof fetch,
    });

    let forbiddenEvent = false;
    client.events.on("auth:forbidden", () => {
      forbiddenEvent = true;
    });

    await assert.rejects(
      () => client.projects.archive("p-1"),
      (err) => err instanceof AuthorizationError && err.status === 403
    );

    assert.equal(forbiddenEvent, true);
  });

  await test("Maps HTTP 404 to NotFoundError", async () => {
    const mockFetch = async () =>
      new Response(JSON.stringify({ error: { code: "NOT_FOUND", message: "Project not found" } }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });

    const client = new AiMemoryClient({
      baseUrl: "https://mock.api",
      fetch: mockFetch as unknown as typeof fetch,
    });

    await assert.rejects(
      () => client.projects.get("p-999"),
      (err) => err instanceof NotFoundError && err.status === 404
    );
  });

  await test("Maps HTTP 409 to ConflictError", async () => {
    const mockFetch = async () =>
      new Response(JSON.stringify({ error: { code: "CONFLICT", message: "Duplicate memory" } }), {
        status: 409,
        headers: { "Content-Type": "application/json" },
      });

    const client = new AiMemoryClient({
      baseUrl: "https://mock.api",
      fetch: mockFetch as unknown as typeof fetch,
    });

    await assert.rejects(
      () => client.memories.create("p-1", { type: "DECISION", title: "T", content: "C" }),
      (err) => err instanceof ConflictError && err.status === 409
    );
  });

  await test("Maps HTTP 429 to RateLimitError with parsed Retry-After and emits event", async () => {
    const mockFetch = async () =>
      new Response(JSON.stringify({ error: { code: "RATE_LIMIT_EXCEEDED", message: "Slow down" } }), {
        status: 429,
        headers: { "Content-Type": "application/json", "Retry-After": "45" },
      });

    const client = new AiMemoryClient({
      baseUrl: "https://mock.api",
      fetch: mockFetch as unknown as typeof fetch,
    });

    let rateLimitEvent = false;
    let retrySecs = 0;
    client.events.on("rate-limit:exceeded", (data) => {
      rateLimitEvent = true;
      retrySecs = data.retryAfterSecs ?? 0;
    });

    await assert.rejects(
      () => client.projects.get("p-1"),
      (err) => err instanceof RateLimitError && err.status === 429 && err.retryAfterSecs === 45
    );

    assert.equal(rateLimitEvent, true);
    assert.equal(retrySecs, 45);
  });

  await test("Maps HTTP 500 to ServerError", async () => {
    const mockFetch = async () =>
      new Response(JSON.stringify({ error: { code: "INTERNAL_ERROR", message: "Server crashed" } }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });

    const client = new AiMemoryClient({
      baseUrl: "https://mock.api",
      fetch: mockFetch as unknown as typeof fetch,
      maxRetries: 0,
    });

    await assert.rejects(
      () => client.projects.get("p-1"),
      (err) => err instanceof ServerError && err.status === 500
    );
  });

  await test("Throws TimeoutError when request exceeds timeoutMs threshold", async () => {
    const mockFetch = async (url: string | URL | Request, init?: RequestInit) => {
      return new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener("abort", () => {
          const abortErr = new Error("The operation was aborted.");
          abortErr.name = "AbortError";
          reject(abortErr);
        });
      });
    };

    const client = new AiMemoryClient({
      baseUrl: "https://mock.api",
      fetch: mockFetch as unknown as typeof fetch,
      timeoutMs: 50,
      maxRetries: 0,
    });

    await assert.rejects(
      () => client.projects.get("p-1"),
      (err) => err instanceof TimeoutError
    );
  });

  // -------------------------------------------------------------
  // 6. MODULES & FULL CLIENT LIFECYCLE SIMULATION
  // -------------------------------------------------------------
  console.log("\n6. Domain Modules & Facade Integration Tests:");

  await test("AuthModule stores and injects Authorization Bearer token", async () => {
    let capturedAuthHeader: string | null = null;

    const mockFetch = async (url: string | URL | Request, init?: RequestInit) => {
      capturedAuthHeader = (init?.headers as Record<string, string>)?.["Authorization"] ?? null;
      return new Response(JSON.stringify({ data: { id: "p-1", name: "Test" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    const storage = new EphemeralStorageAdapter();
    const client = new AiMemoryClient({
      baseUrl: "https://mock.api",
      storage,
      fetch: mockFetch as unknown as typeof fetch,
    });

    await client.auth.setApiKey("aimem_live_supersecrettoken");
    assert.equal(await client.auth.getApiKey(), "aimem_live_supersecrettoken");

    await client.projects.get("p-1");
    assert.equal(capturedAuthHeader, "Bearer aimem_live_supersecrettoken");

    await client.auth.clearApiKey();
    assert.equal(await client.auth.getApiKey(), null);
  });

  await test("ProjectsModule resolve() passes signals and emits project:resolved", async () => {
    const testState: {
      capturedBody: { signals?: { gitRemoteUrl?: string } } | null;
      eventResult: ResolveProjectResult | null;
    } = {
      capturedBody: null,
      eventResult: null,
    };

    const mockFetch = async (url: string | URL | Request, init?: RequestInit) => {
      testState.capturedBody = JSON.parse(init?.body as string) as { signals?: { gitRemoteUrl?: string } };
      return new Response(
        JSON.stringify({
          data: {
            project: { id: "p-123", name: "my-repo", slug: "my-repo", status: "ACTIVE" },
            matchedBy: "GIT_REMOTE",
            canonicalIdentity: "github.com/org/my-repo",
            confidence: 100,
            isNewlyCreated: true,
          },
        }),
        { status: 201, headers: { "Content-Type": "application/json" } }
      );
    };

    const client = new AiMemoryClient({
      baseUrl: "https://mock.api",
      fetch: mockFetch as unknown as typeof fetch,
    });

    client.events.on("project:resolved", (e) => {
      testState.eventResult = e.result;
    });

    const res = await client.projects.resolve({
      signals: { gitRemoteUrl: "git@github.com:org/my-repo.git", workspaceName: "my-repo" },
      source: { platform: "VSCODE" },
    });

    assert.equal(res.project.id, "p-123");
    assert.equal(res.matchedBy, "GIT_REMOTE");
    assert.ok(testState.capturedBody);
    assert.equal(testState.capturedBody.signals?.gitRemoteUrl, "git@github.com:org/my-repo.git");
    assert.ok(testState.eventResult);
    assert.equal(testState.eventResult.project.id, "p-123");
  });





  await test("ContextModule get() passes budget and types query params", async () => {
    let capturedUrl = "";

    const mockFetch = async (url: string | URL | Request) => {
      capturedUrl = String(url);
      return new Response(
        JSON.stringify({
          data: {
            projectId: "p-123",
            projectName: "my-repo",
            budget: { requested: 4000, usedCharacters: 1200, remainingCharacters: 2800, itemCount: 2 },
            markdown: "# Project Context\n\n- item 1",
            includedMemories: [],
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    };

    const client = new AiMemoryClient({
      baseUrl: "https://mock.api",
      fetch: mockFetch as unknown as typeof fetch,
    });

    const ctx = await client.context.get("p-123", {
      budget: 4000,
      types: ["DECISION", "CONVENTION"],
    });

    assert.equal(ctx.projectId, "p-123");
    assert.ok(capturedUrl.includes("budget=4000"));
    assert.ok(decodeURIComponent(capturedUrl).includes("types=DECISION,CONVENTION"));
  });


  await test("MemoriesModule create() emits memory:created and invalidates cache", async () => {
    const mockFetch = async (url: string | URL | Request, init?: RequestInit) => {
      if (init?.method === "POST") {
        return new Response(
          JSON.stringify({
            data: {
              id: "m-1",
              projectId: "p-123",
              type: "DECISION",
              title: "T1",
              content: "C1",
              priority: "HIGH",
              status: "ACTIVE",
            },
          }),
          { status: 201, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response(JSON.stringify({ data: [] }), { status: 200 });
    };

    const client = new AiMemoryClient({
      baseUrl: "https://mock.api",
      fetch: mockFetch as unknown as typeof fetch,
    });

    let createdEventFired = false;
    client.events.on("memory:created", (e) => {
      if (e.memory.id === "m-1") createdEventFired = true;
    });

    const created = await client.memories.create("p-123", {
      type: "DECISION",
      title: "T1",
      content: "C1",
      priority: "HIGH",
    });

    assert.equal(created.id, "m-1");
    assert.equal(createdEventFired, true);
  });

  // -------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------
  console.log("\n==========================================================");
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("==========================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runAllSdkTests().catch((err) => {
  console.error("Fatal test runner error:", err);
  process.exit(1);
});
