/**
 * Integration Test Suite for packages/vscode-extension
 * Executes against the live AiMemorySync backend (http://localhost:3000).
 * Uses dynamic ephemeral test credentials with guaranteed teardown.
 * Zero hardcoded secrets.
 */

import "../mock-vscode.js";
import { mockState } from "../mock-vscode.js";
import * as assert from "assert";
import * as path from "path";
import { AiMemoryClient } from "@aimemory/client-core";
import { acquireTestCredential } from "../test-credentials.js";
import { WorkspaceDiscoveryService } from "../../src/services/workspace-discovery.js";
import { WorkspaceLifecycleService } from "../../src/services/workspace-lifecycle.js";
import { OutputChannelLogger } from "../../src/adapters/output-channel.logger.js";
import { SECRETS } from "../../src/constants.js";

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    console.log(`  \x1b[32m✔\x1b[0m ${name}`);
    passed++;
  } catch (err: any) {
    console.error(`  \x1b[31m✖\x1b[0m ${name}`);
    console.error(err);
    failed++;
  }
}

class MockSecretStorage {
  private _map = new Map<string, string>();
  async get(key: string): Promise<string | undefined> {
    return this._map.get(key);
  }
  async store(key: string, value: string): Promise<void> {
    this._map.set(key, value);
  }
  async delete(key: string): Promise<void> {
    this._map.delete(key);
  }
}

function createMockWorkspaceFolder(folderPath: string, name = "test-project") {
  return {
    uri: {
      fsPath: folderPath,
      toString: () => `file:///${folderPath.replace(/\\/g, "/")}`,
    },
    name,
    index: 0,
  };
}

export async function runIntegrationTests(): Promise<{ passed: number; failed: number }> {
  console.log("\n==========================================================");
  console.log("INTEGRATION TESTS: Real Backend Live Execution");
  console.log("==========================================================\n");

  const credentialSession = await acquireTestCredential("VSCode Integration Suite");
  const testApiKey = credentialSession.rawKey;

  const liveClient = new AiMemoryClient({
    baseUrl: "http://localhost:3000",
    apiKey: testApiKey,
    platform: "VSCODE",
    timeoutMs: 15000,
    maxRetries: 1,
  });

  let createdProjectId = "";
  let createdMemoryId = "";

  try {
    // 1. Live Authentication
    console.log("\x1b[1m1. Live Authentication Tests:\x1b[0m");
    await test("Authenticates against live backend using ephemeral test API key", async () => {
      const projects = await liveClient.projects.list();
      assert.ok(Array.isArray(projects));
    });

    // 2. Real Project Discovery & Deduplication
    console.log("\n\x1b[1m2. Real Project Discovery & Deduplication Tests:\x1b[0m");
    await test("Resolves project via live API without creating duplicates", async () => {
      const discovery = new WorkspaceDiscoveryService();
      const repoRoot = path.resolve(__dirname, "../../..");
      const folder = createMockWorkspaceFolder(repoRoot, "AiMemorySync-LiveTest");
      const signals = await discovery.discoverSignals(folder as any);

      // Resolve first time
      const r1 = await liveClient.projects.resolve({ signals });
      assert.ok(r1.project.id);
      assert.ok(r1.canonicalIdentity);
      assert.ok(r1.confidence > 0);
      createdProjectId = r1.project.id;

      // Re-resolve with identical signals
      const r2 = await liveClient.projects.resolve({ signals });
      assert.strictEqual(r2.project.id, r1.project.id, "Re-resolution created a duplicate project!");
      assert.strictEqual(r2.isNewlyCreated, false);
    });

    await test("HTTPS and SSH remote variants resolve to the exact same canonical identity", async () => {
      const httpsSignals = {
        gitRemoteUrl: "https://github.com/aimemory/test-canonical-repo.git",
        gitBranch: "main",
        workspaceName: "test-repo",
        workspaceDigest: "digest-1",
      };

      const sshSignals = {
        gitRemoteUrl: "git@github.com:aimemory/test-canonical-repo.git",
        gitBranch: "main",
        workspaceName: "test-repo",
        workspaceDigest: "digest-1",
      };

      const rHttps = await liveClient.projects.resolve({ signals: httpsSignals });
      const rSsh = await liveClient.projects.resolve({ signals: sshSignals });

      assert.strictEqual(rHttps.project.id, rSsh.project.id, "HTTPS and SSH variants did not resolve to the same project!");
      assert.strictEqual(rHttps.canonicalIdentity, rSsh.canonicalIdentity);
    });

    await test("Monorepo subprojects remain distinct projects", async () => {
      const subprojectASignals = {
        gitRemoteUrl: "https://github.com/aimemory/monorepo-test.git",
        monorepoSubpath: "packages/frontend",
        workspaceName: "frontend",
        workspaceDigest: "digest-front",
      };

      const subprojectBSignals = {
        gitRemoteUrl: "https://github.com/aimemory/monorepo-test.git",
        monorepoSubpath: "packages/backend",
        workspaceName: "backend",
        workspaceDigest: "digest-back",
      };

      const rA = await liveClient.projects.resolve({ signals: subprojectASignals });
      const rB = await liveClient.projects.resolve({ signals: subprojectBSignals });

      assert.notStrictEqual(rA.project.id, rB.project.id, "Distinct monorepo subprojects resolved to the same project!");
      assert.ok(rA.canonicalIdentity.includes("packages/frontend"));
      assert.ok(rB.canonicalIdentity.includes("packages/backend"));
    });

    await test("Local folder without Git resolves via manifest/digest fallback", async () => {
      const nonGitSignals = {
        packageJsonName: "@test-scope/non-git-app",
        packageJsonVersion: "1.0.0",
        workspaceName: "non-git-app",
        workspaceDigest: "digest-non-git-123456",
      };

      const res = await liveClient.projects.resolve({ signals: nonGitSignals });
      assert.ok(res.project.id);
      assert.ok(res.canonicalIdentity.includes("@test-scope/non-git-app"));
      assert.strictEqual(res.matchedBy, "PACKAGE_MANIFEST");
    });

    await test("Empty workspace without git or manifest resolves via WORKSPACE_DIGEST", async () => {
      const emptySignals = {
        workspaceName: "empty-scratch-folder",
        workspaceDigest: "sha256-empty-scratch-digest-abc",
      };

      const res = await liveClient.projects.resolve({ signals: emptySignals });
      assert.ok(res.project.id);
      assert.strictEqual(res.matchedBy, "WORKSPACE_DIGEST");
    });

    // 3. Live Memory CRUD Lifecycle
    console.log("\n\x1b[1m3. Live Memory CRUD Lifecycle Tests:\x1b[0m");
    await test("Executes full Memory CRUD lifecycle with instant cache invalidation", async () => {
      assert.ok(createdProjectId, "Project ID must exist from resolution step");

      // 1. Create memory
      const title = `E2E Test Decision - ${Date.now()}`;
      const created = await liveClient.memories.create(createdProjectId, {
        type: "DECISION",
        title,
        content: "Always use transaction wrappers for multi-entity writes.",
        priority: "CRITICAL",
      });

      assert.ok(created.id);
      assert.strictEqual(created.title, title);
      assert.strictEqual(created.status, "ACTIVE");
      createdMemoryId = created.id;

      // 2. List memories (verifying cache invalidation works!)
      const activeList = await liveClient.memories.list(createdProjectId, { status: "ACTIVE" });
      const found = activeList.find((m) => m.id === created.id);
      assert.ok(found, "Newly created memory was missing in active list!");

      // 3. Update memory
      const updated = await liveClient.memories.update(created.id, {
        title: `${title} (Updated)`,
        priority: "HIGH",
      });
      assert.strictEqual(updated.title, `${title} (Updated)`);
      assert.strictEqual(updated.priority, "HIGH");

      // 4. Deprecate memory
      const deprecated = await liveClient.memories.deprecate(created.id, {
        reason: "Superseded by architectural update",
      });
      assert.strictEqual(deprecated.status, "DEPRECATED");

      // 5. Verify it is excluded from active list
      const listAfterDeprecate = await liveClient.memories.list(createdProjectId, { status: "ACTIVE" });
      assert.strictEqual(listAfterDeprecate.some((m) => m.id === created.id), false);

      // 6. Archive memory
      const archived = await liveClient.memories.archive(created.id);
      assert.strictEqual(archived.status, "ARCHIVED");
    });

    // 4. Live Context Assembly & Budget Constraints
    console.log("\n\x1b[1m4. Live Context Assembly & Budgeting Tests:\x1b[0m");
    await test("Generates assembled AI context with character budget enforcement", async () => {
      // Create an active memory so context is non-empty
      const activeMem = await liveClient.memories.create(createdProjectId, {
        type: "REQUIREMENT",
        title: "Deterministic Context Assembly",
        content: "Context generation must respect character budget limits strictly.",
        priority: "HIGH",
      });

      // Test budget 2000
      const ctx2000 = await liveClient.context.get(createdProjectId, { budget: 2000 });
      assert.strictEqual(ctx2000.projectId, createdProjectId);
      assert.strictEqual(ctx2000.budget.requested, 2000);
      assert.ok(ctx2000.budget.usedCharacters <= 2000);
      assert.ok(ctx2000.markdown.length <= 2000);
      assert.ok(ctx2000.markdown.includes("Deterministic Context Assembly"));

      // Test budget 5000
      const ctx5000 = await liveClient.context.get(createdProjectId, { budget: 5000 });
      assert.strictEqual(ctx5000.budget.requested, 5000);
      assert.ok(ctx5000.budget.usedCharacters <= 5000);

      // Clean up test memory
      await liveClient.memories.archive(activeMem.id);
    });

    // 5. Security & Error Handling
    console.log("\n\x1b[1m5. Security & Error Handling Tests:\x1b[0m");
    await test("Dispatches auth:unauthorized event on 401 response", async () => {
      let eventFired = false;
      const badClient = new AiMemoryClient({
        baseUrl: "http://localhost:3000",
        apiKey: "aimem_live_invalidkey999999",
        platform: "VSCODE",
        maxRetries: 0,
      });

      badClient.events.on("auth:unauthorized", () => {
        eventFired = true;
      });

      try {
        await badClient.projects.list();
        assert.fail("Expected 401 Unauthorized");
      } catch (err: any) {
        assert.strictEqual(err.status, 401);
        assert.strictEqual(eventFired, true, "auth:unauthorized event did not fire!");
      }
    });

    await test("Handles offline / connection refusal gracefully with NetworkError", async () => {
      const offlineClient = new AiMemoryClient({
        baseUrl: "http://127.0.0.1:59999",
        apiKey: testApiKey,
        platform: "VSCODE",
        timeoutMs: 1000,
        maxRetries: 0,
      });

      let networkErrorFired = false;
      offlineClient.events.on("network:error", () => {
        networkErrorFired = true;
      });

      try {
        await offlineClient.projects.list();
        assert.fail("Expected network failure");
      } catch (err: any) {
        assert.ok(err.name === "NetworkError" || err.name === "TimeoutError");
        assert.strictEqual(networkErrorFired, true, "network:error event was not emitted!");
      }
    });

    // 6. Multi-Folder Workspace Isolation
    console.log("\n\x1b[1m6. Multi-Folder Workspace Isolation Tests:\x1b[0m");
    await test("Maintains independent resolution caches for distinct workspace folders", async () => {
      const mockLogger = new OutputChannelLogger("ERROR");
      (mockLogger as any).channel = { appendLine: () => {}, dispose: () => {} };

      const mockClient = {
        projects: {
          resolve: async (input: any) => ({
            project: { id: `proj-${input.signals.workspaceName}`, name: input.signals.workspaceName },
            matchedBy: "WORKSPACE_DIGEST",
            canonicalIdentity: input.signals.workspaceName,
            confidence: 70,
            isNewlyCreated: false,
          }),
        },
      };

      const lifecycle = new WorkspaceLifecycleService(mockClient as any, mockLogger);
      const folderA = createMockWorkspaceFolder("d:/projects/app-frontend", "app-frontend");
      const folderB = createMockWorkspaceFolder("d:/projects/app-backend", "app-backend");

      const rA = await lifecycle.resolveNow(folderA as any);
      const rB = await lifecycle.resolveNow(folderB as any);

      assert.strictEqual(rA?.project.name, "app-frontend");
      assert.strictEqual(rB?.project.name, "app-backend");

      assert.strictEqual(lifecycle.getCachedResult(folderA.uri.toString())?.project.name, "app-frontend");
      assert.strictEqual(lifecycle.getCachedResult(folderB.uri.toString())?.project.name, "app-backend");
    });

    // 7. Full Extension Activation & Command Registration
    console.log("\n\x1b[1m7. Extension Activation & Command Registration Tests:\x1b[0m");
    await test("Simulates full extension activation and registers all 12 commands", async () => {
      const { activate, deactivate } = await import("../../src/extension.js");
      const mockContext = {
        subscriptions: [] as any[],
        secrets: new MockSecretStorage(),
        extensionPath: path.resolve(__dirname, "../.."),
        globalState: { get: () => undefined, update: async () => {} },
        workspaceState: { get: () => undefined, update: async () => {} },
      };

      await mockContext.secrets.store(SECRETS.API_KEY, testApiKey);
      await activate(mockContext as any);

      const expectedCommands = [
        "aimemory.setApiKey",
        "aimemory.removeApiKey",
        "aimemory.checkConnection",
        "aimemory.resolveProject",
        "aimemory.copyContext",
        "aimemory.previewContext",
        "aimemory.openDashboard",
        "aimemory.refreshAll",
        "aimemory.addMemory",
        "aimemory.editMemory",
        "aimemory.deprecateMemory",
        "aimemory.archiveMemory",
      ];

      for (const cmd of expectedCommands) {
        assert.ok(mockState.registeredCommands.has(cmd), `Command ${cmd} was not registered during activation!`);
      }

      // Execute checkConnection command
      const checkHandler = mockState.registeredCommands.get("aimemory.checkConnection");
      assert.ok(checkHandler);
      await checkHandler!();

      deactivate();
    });

  } finally {
    // Teardown: delete test API key
    console.log("\nCleaning up ephemeral test credentials...");
    await credentialSession.cleanup();
    console.log("Cleanup completed.");
  }

  return { passed, failed };
}

if (process.argv[1]?.includes("run-integration-tests")) {
  runIntegrationTests().then(({ passed, failed }) => {
    console.log(`\nINTEGRATION TEST SUMMARY: ${passed} passed, ${failed} failed`);
    if (failed > 0) process.exit(1);
  });
}
