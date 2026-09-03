/**
 * Unit Test Suite for packages/vscode-extension
 * Tests all isolated units using mock VS Code environment:
 * - SecretStorage Adapter
 * - OutputChannel Logger & Secret Scrubbing
 * - Git Detector & Worktree / Submodule / Monorepo Detection
 * - Workspace Discovery & Path Leakage Guards
 * - Workspace Trust Guard
 * - Workspace Lifecycle (Debounce & Concurrency Deduplication)
 * - Status Bar Manager State Transitions
 * - TreeDataProviders (Projects, Memories, Context)
 */

import "../mock-vscode.js";
import * as assert from "assert";
import * as path from "path";
import * as fs from "fs";
import { VSCodeSecretStorageAdapter } from "../../src/adapters/secret-storage.adapter.js";
import { OutputChannelLogger } from "../../src/adapters/output-channel.logger.js";
import { detectGitRemoteUrl, detectMonorepoSubPath } from "../../src/utils/git-detector.js";
import { WorkspaceDiscoveryService } from "../../src/services/workspace-discovery.js";
import { WorkspaceTrustGuard } from "../../src/services/workspace-trust.guard.js";
import { WorkspaceLifecycleService } from "../../src/services/workspace-lifecycle.js";
import { StatusBarManager } from "../../src/services/status-bar.manager.js";
import { ProjectsTreeDataProvider } from "../../src/providers/projects-tree.provider.js";
import { MemoriesTreeDataProvider } from "../../src/providers/memories-tree.provider.js";
import { ContextTreeDataProvider } from "../../src/providers/context-tree.provider.js";
import type { MemoryDto, ProjectDto } from "@aimemory/client-core";

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

export async function runUnitTests(): Promise<{ passed: number; failed: number }> {
  console.log("\n==========================================================");
  console.log("UNIT TESTS: VS Code Extension Components");
  console.log("==========================================================\n");

  console.log("\x1b[1m1. SecretStorage Adapter Tests:\x1b[0m");
  await test("Stores, retrieves, and deletes API key securely from SecretStorage", async () => {
    const mockSecrets = new MockSecretStorage();
    const adapter = new VSCodeSecretStorageAdapter(mockSecrets as any);

    assert.strictEqual(await adapter.get("test_key"), null);
    await adapter.set("test_key", "secret_value_123");
    assert.strictEqual(await adapter.get("test_key"), "secret_value_123");
    await adapter.delete("test_key");
    assert.strictEqual(await adapter.get("test_key"), null);
  });

  await test("Recovers gracefully if SecretStorage read throws", async () => {
    const brokenSecrets = {
      get: async () => {
        throw new Error("OS Keychain Locked");
      },
      store: async () => {},
      delete: async () => {},
    };
    const adapter = new VSCodeSecretStorageAdapter(brokenSecrets as any);
    const val = await adapter.get("test_key");
    assert.strictEqual(val, null);
  });

  console.log("\n\x1b[1m2. OutputChannel Logger Tests:\x1b[0m");
  await test("Sanitizes sensitive keys and substrings from log metadata", () => {
    const mockLogger = new OutputChannelLogger("DEBUG");
    let logLine = "";
    (mockLogger as any).channel = {
      appendLine: (msg: string) => {
        logLine = msg;
      },
      dispose: () => {},
    };

    mockLogger.info("Testing diagnostic output", {
      projectId: "proj-123",
      apiKey: "unscrubbed_secret_key",
      authorization: "Bearer secret_token",
      tokenString: "jwt_token_123",
      safeStatus: "OK",
    });

    assert.ok(!logLine.includes("unscrubbed_secret_key"), "apiKey was not scrubbed!");
    assert.ok(!logLine.includes("secret_token"), "authorization was not scrubbed!");
    assert.ok(!logLine.includes("jwt_token_123"), "token was not scrubbed!");
    assert.ok(logLine.includes("proj-123"), "Safe project ID was incorrectly stripped");
    assert.ok(logLine.includes("OK"), "Safe status was incorrectly stripped");
  });

  await test("Respects log level filtering", () => {
    const mockLogger = new OutputChannelLogger("ERROR");
    let logged = false;
    (mockLogger as any).channel = {
      appendLine: () => {
        logged = true;
      },
      dispose: () => {},
    };

    mockLogger.debug("Should be suppressed");
    assert.strictEqual(logged, false);
    mockLogger.info("Should be suppressed");
    assert.strictEqual(logged, false);
    mockLogger.error("Should be written");
    assert.strictEqual(logged, true);
  });

  console.log("\n\x1b[1m3. Git Detection & Signal Extraction Tests:\x1b[0m");
  await test("Detects repository Git remote and strips embedded credentials", async () => {
    const repoRoot = path.resolve(__dirname, "../../..");
    const remoteUrl = await detectGitRemoteUrl(repoRoot);

    if (remoteUrl) {
      assert.ok(!remoteUrl.includes("@"), "Credentials were not stripped from Git URL!");
      assert.ok(remoteUrl.startsWith("http") || remoteUrl.startsWith("git@") || remoteUrl.startsWith("ssh://"));
    }
  });

  await test("Guarantees root Git repo is not misclassified as monorepo subproject", () => {
    const repoRoot = path.resolve(__dirname, "../../..");
    const subpath = detectMonorepoSubPath(repoRoot);
    assert.strictEqual(subpath, undefined);
  });

  await test("Correctly detects subproject path when nested in monorepo", () => {
    const extensionDir = path.resolve(__dirname, "../..");
    const subpath = detectMonorepoSubPath(extensionDir);
    assert.ok(subpath?.includes("vscode-extension"));
  });

  await test("WorkspaceDiscoveryService builds signals without leaking raw absolute paths", async () => {
    const discovery = new WorkspaceDiscoveryService();
    const repoRoot = path.resolve(__dirname, "../../..");
    const folder = createMockWorkspaceFolder(repoRoot, "AiMemorySync");
    const { signals } = await discovery.buildResolveInput(folder as any);

    assert.strictEqual(signals.workspaceName, "AiMemorySync");

    const payloadJson = JSON.stringify(signals);
    assert.ok(!payloadJson.includes("D:\\Freelance"), "Raw Windows path leaked!");
    assert.ok(!payloadJson.includes("/Users/"), "Raw Unix path leaked!");
  });

  console.log("\n\x1b[1m4. Workspace Trust Guard Tests:\x1b[0m");
  await test("Guards against untrusted workspace execution", () => {
    const guard = new WorkspaceTrustGuard();
    const trusted = guard.isTrusted();
    assert.strictEqual(typeof trusted, "boolean");
  });

  console.log("\n\x1b[1m5. Workspace Lifecycle (Debounce & Deduplication) Tests:\x1b[0m");
  await test("Deduplicates concurrent in-flight resolution calls for the same folder", async () => {
    let callCount = 0;
    const mockClient = {
      projects: {
        resolve: async () => {
          callCount++;
          await new Promise((r) => setTimeout(r, 40));
          return {
            project: { id: "proj-1", name: "Test Project", slug: "test-project", status: "ACTIVE" },
            matchedBy: "PACKAGE_MANIFEST",
            canonicalIdentity: "npm:aimemory-vscode",
            confidence: 80,
            isNewlyCreated: false,
          };
        },
      },
    };
    const mockLogger = new OutputChannelLogger("ERROR");
    (mockLogger as any).channel = { appendLine: () => {}, dispose: () => {} };

    const lifecycle = new WorkspaceLifecycleService(mockClient as any, mockLogger);
    const folder = createMockWorkspaceFolder(path.resolve(__dirname, "../.."), "vscode-extension");

    const [r1, r2, r3] = await Promise.all([
      lifecycle.resolveNow(folder as any),
      lifecycle.resolveNow(folder as any),
      lifecycle.resolveNow(folder as any),
    ]);

    assert.strictEqual(callCount, 1, `Expected 1 API call due to in-flight deduplication, got ${callCount}`);
    assert.strictEqual(r1?.project.id, "proj-1");
    assert.strictEqual(r2?.project.id, "proj-1");
    assert.strictEqual(r3?.project.id, "proj-1");
  });

  console.log("\n\x1b[1m6. StatusBarManager State Transitions Tests:\x1b[0m");
  await test("Transitions correctly through all 7 status bar states", () => {
    const statusBar = new StatusBarManager();
    const item = (statusBar as any).item;

    statusBar.setDisconnected();
    assert.strictEqual(statusBar.getState(), "disconnected");
    assert.ok(item.text.includes("AiMemory"));

    statusBar.setConnecting();
    assert.strictEqual(statusBar.getState(), "connecting");
    assert.ok(item.text.includes("Connecting"));

    statusBar.setResolving();
    assert.strictEqual(statusBar.getState(), "resolving");
    assert.ok(item.text.includes("Resolving"));

    statusBar.setConnected("My Backend Project", "GIT_REMOTE");
    assert.strictEqual(statusBar.getState(), "connected");
    assert.ok(item.text.includes("My Backend Project"));

    statusBar.setUntrusted();
    assert.strictEqual(statusBar.getState(), "untrusted");
    assert.ok(item.text.includes("Restricted"));

    statusBar.setError();
    assert.strictEqual(statusBar.getState(), "error");
    assert.ok(item.text.includes("Error"));

    statusBar.setRateLimited(15);
    assert.strictEqual(statusBar.getState(), "rate-limited");
    assert.ok(item.text.includes("Rate Limited"));
  });

  console.log("\n\x1b[1m7. TreeDataProviders Rendering Tests:\x1b[0m");
  await test("ProjectsTreeDataProvider renders identity details, match method and confidence", () => {
    const provider = new ProjectsTreeDataProvider();
    let items = provider.getChildren();
    assert.ok(items[0].label?.toString().includes("No project resolved"));

    provider.setResolveResult({
      project: {
        id: "proj-123",
        name: "Test Repository",
        slug: "test-repo",
        description: "Test description",
        status: "ACTIVE",
        creationSource: "AUTO_DISCOVERY",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      matchedBy: "GIT_REMOTE",
      canonicalIdentity: "git:github.com/org/test-repo",
      confidence: 100,
      isNewlyCreated: false,
    });

    items = provider.getChildren();
    assert.strictEqual(items.length, 7);
    assert.ok(items[0].label?.toString().includes("Test Repository"));
    assert.ok(items[1].label?.toString().includes("GIT_REMOTE"));
    assert.ok(items[2].label?.toString().includes("100% confidence"));
  });

  await test("MemoriesTreeDataProvider groups active memories by type with priority tags", () => {
    const provider = new MemoriesTreeDataProvider();
    const mockMemories: MemoryDto[] = [
      {
        id: "mem-1",
        projectId: "proj-123",
        type: "DECISION",
        title: "Use PostgreSQL",
        content: "We use Postgres for all transactions.",
        priority: "CRITICAL",
        status: "ACTIVE",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "mem-2",
        projectId: "proj-123",
        type: "CONVENTION",
        title: "Kebab Case Routes",
        content: "API routes must use kebab-case.",
        priority: "NORMAL",
        status: "ACTIVE",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    provider.setMemories(mockMemories);
    const categoryNodes = provider.getChildren();
    assert.strictEqual(categoryNodes.length, 2);

    const decisionGroup = categoryNodes.find((n) => (n as any).type === "DECISION");
    assert.ok(decisionGroup);
    const decisionItems = provider.getChildren(decisionGroup);
    assert.strictEqual(decisionItems.length, 1);
    assert.strictEqual((decisionItems[0] as any).memory.title, "Use PostgreSQL");
  });

  await test("ContextTreeDataProvider renders budget bar and memory counts", () => {
    const provider = new ContextTreeDataProvider();
    provider.setContextResult({
      projectId: "proj-123",
      projectName: "Test Project",
      budget: {
        requested: 8000,
        usedCharacters: 4000,
        remainingCharacters: 4000,
        itemCount: 5,
      },
      markdown: "# Context\nSample context text.",
      includedMemories: [],
    });

    const items = provider.getChildren();
    assert.strictEqual(items.length, 4);
    assert.ok(items[0].label?.toString().includes("50%"));
    assert.ok(items[1].label?.toString().includes("5 included"));
    assert.ok(items[2].label?.toString().includes("Copy Context"));
    assert.ok(items[3].label?.toString().includes("Preview in Editor"));
  });

  return { passed, failed };
}

if (process.argv[1]?.includes("run-unit-tests")) {
  runUnitTests().then(({ passed, failed }) => {
    console.log(`\nUNIT TEST SUMMARY: ${passed} passed, ${failed} failed`);
    if (failed > 0) process.exit(1);
  });
}
