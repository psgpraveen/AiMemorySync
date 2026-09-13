import * as assert from "assert";
import crypto from "crypto";
import { prisma } from "../../../src/lib/prisma.js";
import { AiMemoryClient } from "@aimemory/client-core";
import { McpSessionManager } from "../src/session.js";
import { McpLogger } from "../src/security/logger.js";
import { createMcpServer } from "../src/server.js";

async function acquireEphemeralKey(namePrefix = "MCP Test Runner") {
  const envKey = process.env.AIMEMORY_TEST_API_KEY?.trim();
  if (envKey) {
    return {
      rawKey: envKey,
      cleanup: async () => {},
    };
  }

  const randomEntropy = crypto.randomBytes(24).toString("base64url");
  const rawKey = `aimem_live_${randomEntropy}`;
  const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");
  const last4 = rawKey.slice(-4);
  const name = `${namePrefix} - ${Date.now()}`;

  const created = await prisma.apiKey.create({
    data: {
      tenantId: "00000000-0000-0000-0000-000000000001",
      name,
      keyHash,
      prefix: "aimem_live_",
      last4,
      scopes: ["read", "write", "admin"],
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });

  return {
    rawKey,
    cleanup: async () => {
      try {
        await prisma.apiKey.delete({ where: { id: created.id } });
      } catch {
        // Ignore
      }
    },
  };
}

export async function runIntegrationTests(): Promise<{ passed: number; failed: number }> {
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

  console.log("\n\x1b[1m4. Live Backend MCP Integration Tests (http://localhost:3000):\x1b[0m");

  const sessionCreds = await acquireEphemeralKey();
  const createdMemoryIds: string[] = [];
  let resolvedProjectId = "";

  const client = new AiMemoryClient({
    baseUrl: "http://localhost:3000",
    apiKey: sessionCreds.rawKey,
    timeoutMs: 10000,
  });

  const session = new McpSessionManager();
  const logger = new McpLogger(false);
  const config = { apiUrl: "http://localhost:3000", apiKey: sessionCreds.rawKey, debug: false };
  const { server } = createMcpServer(client, config, session, logger);

  // Helper to invoke registered tools
  const toolsMap = (server as any)._registeredTools;

  async function invokeTool(name: string, args: any) {
    const registered = toolsMap[name];
    assert.ok(registered, `Tool '${name}' must be registered on server`);
    return registered.handler(args, {});
  }

  try {
    await test("aimemory_resolve_project connects to live backend and caches project", async () => {
      const res = await invokeTool("aimemory_resolve_project", {
        workspaceName: "AiMemorySync",
        packageManifest: {
          name: "aimemorysync",
          ecosystem: "npm",
        },
      });

      assert.strictEqual(res.isError, undefined);
      const parsed = JSON.parse(res.content[0].text);
      assert.strictEqual(parsed.status, "RESOLVED");
      assert.ok(parsed.projectId);
      resolvedProjectId = parsed.projectId;

      // Verify session manager cached project
      assert.strictEqual(session.getCurrentProject()?.id, resolvedProjectId);
    });

    await test("aimemory_get_current_project reflects live resolved project", async () => {
      const res = await invokeTool("aimemory_get_current_project", {});
      const parsed = JSON.parse(res.content[0].text);
      assert.strictEqual(parsed.status, "RESOLVED");
      assert.strictEqual(parsed.projectId, resolvedProjectId);
    });

    await test("aimemory_create_memory creates real memory on live database", async () => {
      const res = await invokeTool("aimemory_create_memory", {
        type: "DECISION",
        title: `[MCP Integration] Standard Stdio Transport - ${Date.now()}`,
        content: "The universal MCP server communicates over standard I/O streams using @modelcontextprotocol/sdk.",
        priority: "CRITICAL",
      });

      assert.strictEqual(res.isError, undefined);
      const parsed = JSON.parse(res.content[0].text);
      assert.strictEqual(parsed.status, "CREATED");
      assert.ok(parsed.id);
      createdMemoryIds.push(parsed.id);
    });

    await test("aimemory_get_context retrieves live markdown context without explicit projectId", async () => {
      const res = await invokeTool("aimemory_get_context", {
        budget: 5000,
      });

      assert.strictEqual(res.isError, undefined);
      const markdown = res.content[0].text;
      assert.ok(markdown.startsWith("# Project Context"));
      assert.ok(markdown.includes("Standard Stdio Transport"));
    });

    await test("aimemory_update_memory updates existing record title", async () => {
      const targetId = createdMemoryIds[0];
      const res = await invokeTool("aimemory_update_memory", {
        memoryId: targetId,
        title: `[MCP Integration] Standard Stdio Transport (Verified) - ${Date.now()}`,
      });

      assert.strictEqual(res.isError, undefined);
      const parsed = JSON.parse(res.content[0].text);
      assert.strictEqual(parsed.status, "UPDATED");
      assert.ok(parsed.title.includes("(Verified)"));
    });

    await test("aimemory_deprecate_memory soft-deprecates memory record", async () => {
      const targetId = createdMemoryIds[0];
      const res = await invokeTool("aimemory_deprecate_memory", {
        memoryId: targetId,
      });

      assert.strictEqual(res.isError, undefined);
      const parsed = JSON.parse(res.content[0].text);
      assert.strictEqual(parsed.status, "DEPRECATED");
    });
  } finally {
    // Teardown: soft-archive created memories and purge test key
    for (const id of createdMemoryIds) {
      try {
        await client.memories.archive(id);
      } catch {
        // Ignore
      }
    }
    await sessionCreds.cleanup();
  }

  return { passed, failed };
}

if (process.argv[1]?.includes("integration.test")) {
  runIntegrationTests().then(({ failed }) => {
    if (failed > 0) process.exit(1);
  });
}
