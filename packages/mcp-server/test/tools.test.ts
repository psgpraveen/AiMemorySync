import * as assert from "assert";
import { McpSessionManager } from "../src/session.js";
import { McpLogger } from "../src/security/logger.js";
import { registerResolveProjectTool } from "../src/tools/resolve-project.js";
import { registerGetCurrentProjectTool } from "../src/tools/get-current-project.js";
import { registerGetContextTool } from "../src/tools/get-context.js";
import { registerListMemoriesTool } from "../src/tools/list-memories.js";
import { registerCreateMemoryTool } from "../src/tools/create-memory.js";
import { registerUpdateMemoryTool } from "../src/tools/update-memory.js";
import { registerDeprecateMemoryTool } from "../src/tools/deprecate-memory.js";
import { registerArchiveMemoryTool } from "../src/tools/archive-memory.js";
import { registerProjectContextResource } from "../src/resources/project-context.js";

// Mock Server implementation
class MockMcpServer {
  public tools = new Map<string, { config: any; handler: (args: any) => Promise<any> }>();
  public resources = new Map<string, { template: any; config: any; handler: (uri: any, vars: any) => Promise<any> }>();

  registerTool(name: string, config: any, handler: (args: any) => Promise<any>) {
    this.tools.set(name, { config, handler });
  }

  registerResource(name: string, template: any, config: any, handler: any) {
    this.resources.set(name, { template, config, handler });
  }
}

export async function runToolsTests(): Promise<{ passed: number; failed: number }> {
  let passed = 0;
  let failed = 0;

  async function test(name: string, fn: () => void | Promise<void>) {
    try {
      await fn();
      console.log(`  \x1b[32m✔\x1b[0m ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`  \x1b[31m✖\x1b[0m ${name}:`, err.message);
      failed++;
    }
  }

  console.log("\n\x1b[1m3. MCP Tools Unit Tests (Mocked Core):\x1b[0m");

  const mockClient: any = {
    projects: {
      resolve: async (input: any) => ({
        project: {
          id: "proj-mock-123",
          name: "MockProject",
          slug: "mock-project",
        },
        canonicalIdentity: "git:github.com/mock/repo.git",
        matchedBy: "GIT_REMOTE",
        confidence: 1.0,
        isNewlyCreated: false,
      }),
    },
    context: {
      get: async (id: string, opts?: any) => ({
        projectId: id,
        projectName: "MockProject",
        markdown: "# Project Context\n\n## Decisions\n\n### Architectural Choice\n\nUse clean architecture.",
        budget: {
          requested: opts?.budget ?? 8000,
          usedCharacters: 90,
          remainingCharacters: (opts?.budget ?? 8000) - 90,
          itemCount: 1,
        },
      }),
    },
    memories: {
      list: async (id: string, filter?: any) => [
        {
          id: "mem-123",
          projectId: id,
          type: "DECISION",
          title: "Architectural Choice",
          content: "Use clean architecture.",
          priority: "CRITICAL",
          status: "ACTIVE",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      create: async (id: string, payload: any) => ({
        id: "mem-new-456",
        projectId: id,
        type: payload.type,
        title: payload.title,
        content: payload.content,
        priority: payload.priority ?? "NORMAL",
        status: "ACTIVE",
      }),
      update: async (id: string, payload: any) => ({
        id,
        projectId: "proj-mock-123",
        title: payload.title ?? "Updated Title",
        priority: payload.priority ?? "HIGH",
        type: "CONVENTION",
        updatedAt: new Date().toISOString(),
      }),
      deprecate: async (id: string) => ({
        id,
        projectId: "proj-mock-123",
        title: "Superseded Memory",
        status: "DEPRECATED",
      }),
      archive: async (id: string) => ({
        id,
        projectId: "proj-mock-123",
        title: "Archived Memory",
        status: "ARCHIVED",
      }),
    },
  };

  const session = new McpSessionManager();
  const logger = new McpLogger(false);
  const server = new MockMcpServer();

  registerResolveProjectTool(server, mockClient, session, logger);
  registerGetCurrentProjectTool(server, session, logger);
  registerGetContextTool(server, mockClient, session, logger);
  registerListMemoriesTool(server, mockClient, session, logger);
  registerCreateMemoryTool(server, mockClient, session, logger);
  registerUpdateMemoryTool(server, mockClient, logger);
  registerDeprecateMemoryTool(server, mockClient, logger);
  registerArchiveMemoryTool(server, mockClient, logger);
  registerProjectContextResource(server, mockClient, logger);

  await test("aimemory_get_current_project returns NOT_RESOLVED when empty", async () => {
    const res = await server.tools.get("aimemory_get_current_project")!.handler({});
    const parsed = JSON.parse(res.content[0].text);
    assert.strictEqual(parsed.status, "NOT_RESOLVED");
  });

  await test("aimemory_resolve_project rejects raw absolute machine paths", async () => {
    const res = await server.tools.get("aimemory_resolve_project")!.handler({
      workspaceName: "D:\\Freelance\\AiMemorySync",
    });
    assert.strictEqual(res.isError, true);
    assert.ok(res.content[0].text.includes("Absolute local machine paths"));
  });

  await test("aimemory_resolve_project resolves and caches project in session", async () => {
    const res = await server.tools.get("aimemory_resolve_project")!.handler({
      workspaceName: "AiMemorySync",
      gitRemoteUrl: "https://github.com/mock/repo.git",
    });
    const parsed = JSON.parse(res.content[0].text);
    assert.strictEqual(parsed.status, "RESOLVED");
    assert.strictEqual(parsed.projectId, "proj-mock-123");

    // Session now reflects resolved project
    const current = session.getCurrentProject();
    assert.strictEqual(current?.id, "proj-mock-123");
  });

  await test("aimemory_get_current_project returns active session project", async () => {
    const res = await server.tools.get("aimemory_get_current_project")!.handler({});
    const parsed = JSON.parse(res.content[0].text);
    assert.strictEqual(parsed.status, "RESOLVED");
    assert.strictEqual(parsed.projectId, "proj-mock-123");
    assert.strictEqual(parsed.projectName, "MockProject");
  });

  await test("aimemory_get_context defaults to session project when omitted", async () => {
    const res = await server.tools.get("aimemory_get_context")!.handler({
      budget: 5000,
    });
    assert.ok(res.content[0].text.includes("# Project Context"));
  });

  await test("aimemory_create_memory enforces pre-flight anti-poisoning secret scan", async () => {
    const res = await server.tools.get("aimemory_create_memory")!.handler({
      type: "CONVENTION",
      title: "Secret Key Storage",
      content: "Here is my secret aimem_live_abcdef1234567890_secret",
    });
    assert.strictEqual(res.isError, true);
    assert.ok(res.content[0].text.includes("Security Violation"));
  });

  await test("aimemory_create_memory creates valid memory record", async () => {
    const res = await server.tools.get("aimemory_create_memory")!.handler({
      type: "DECISION",
      title: "Use MCP Server",
      content: "The universal MCP server acts as standard protocol transport.",
      priority: "HIGH",
    });
    const parsed = JSON.parse(res.content[0].text);
    assert.strictEqual(parsed.status, "CREATED");
    assert.strictEqual(parsed.title, "Use MCP Server");
  });

  await test("aimemory_deprecate_memory soft-deprecates record", async () => {
    const res = await server.tools.get("aimemory_deprecate_memory")!.handler({
      memoryId: "mem-123",
    });
    const parsed = JSON.parse(res.content[0].text);
    assert.strictEqual(parsed.status, "DEPRECATED");
    assert.strictEqual(parsed.memoryStatus, "DEPRECATED");
  });

  await test("Dynamic resource aimemory://projects/{id}/context reads context", async () => {
    const resHandler = server.resources.get("project-context")!.handler;
    const res = await resHandler({ href: "aimemory://projects/proj-mock-123/context" }, { id: "proj-mock-123" });
    assert.ok(res.contents[0].text.includes("# Project Context"));
    assert.strictEqual(res.contents[0].mimeType, "text/markdown");
  });

  return { passed, failed };
}

if (process.argv[1]?.includes("tools.test")) {
  runToolsTests().then(({ failed }) => {
    if (failed > 0) process.exit(1);
  });
}
