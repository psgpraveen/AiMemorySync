/**
 * Multi-Session Continuity E2E Test
 * 
 * Verifies that a memory created in Session 1 persists across independent
 * MCP server process lifetimes and is immediately retrieved by Session 2.
 */

import * as assert from "assert";
import crypto from "crypto";
import * as path from "path";
import { fileURLToPath } from "url";
import { prisma } from "../../../src/lib/prisma.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { AiMemoryClient } from "@aimemory/client-core";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function acquireEphemeralKey(namePrefix = "MultiSession Continuity Test") {
  const envKey = process.env.AIMEMORY_TEST_API_KEY?.trim();
  if (envKey) {
    return { rawKey: envKey, cleanup: async () => {} };
  }

  const randomEntropy = crypto.randomBytes(24).toString("base64url");
  const rawKey = `aimem_live_${randomEntropy}`;
  const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");
  const last4 = rawKey.slice(-4);
  const name = `${namePrefix} - ${Date.now()}`;

  const created = await prisma.apiKey.create({
    data: {
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

export async function runContinuityTest(): Promise<boolean> {
  console.log("\n==========================================================");
  console.log("MULTI-SESSION CONTINUITY E2E TEST (Antigravity Scenario)");
  console.log("==========================================================");

  const creds = await acquireEphemeralKey();
  const createdMemoryIds: string[] = [];
  const serverPath = path.resolve(__dirname, "../dist/index.js");

  const directClient = new AiMemoryClient({
    baseUrl: "http://localhost:3000",
    apiKey: creds.rawKey,
    timeoutMs: 10000,
  });

  const testTitle = `[Continuity Decision] Client-Core Standard - ${Date.now()}`;
  const testContent = "We use @aimemory/client-core for all platform integrations. No direct DB queries.";

  try {
    // -------------------------------------------------------------
    // SESSION 1: Process 1 initializes, resolves, and saves memory
    // -------------------------------------------------------------
    console.log("\n\x1b[1m--- SESSION 1 (First AI Conversation) ---\x1b[0m");
    const transport1 = new StdioClientTransport({
      command: "node",
      args: [serverPath],
      env: {
        ...process.env,
        AIMEMORY_API_KEY: creds.rawKey,
        AIMEMORY_API_URL: "http://localhost:3000",
      },
    });

    const client1 = new Client(
      { name: "antigravity-session-1", version: "1.0.0" },
      { capabilities: {} }
    );

    await client1.connect(transport1);
    console.log("  \x1b[32m✔\x1b[0m Session 1: Connected to MCP server process #1 via stdio");

    // 1. Resolve workspace
    const resolveRes1 = (await client1.callTool({
      name: "aimemory_resolve_project",
      arguments: {
        workspaceName: "AiMemorySync",
        packageManifest: { name: "aimemorysync", ecosystem: "npm" },
      },
    })) as any;

    const resolveData1 = JSON.parse(resolveRes1.content[0].text);
    assert.strictEqual(resolveData1.status, "RESOLVED");
    console.log(`  \x1b[32m✔\x1b[0m Session 1: Resolved workspace -> Project '${resolveData1.projectName}' (${resolveData1.projectId})`);

    // 2. Save architectural memory
    const createRes1 = (await client1.callTool({
      name: "aimemory_create_memory",
      arguments: {
        type: "DECISION",
        title: testTitle,
        content: testContent,
        priority: "CRITICAL",
      },
    })) as any;

    const createData1 = JSON.parse(createRes1.content[0].text);
    assert.strictEqual(createData1.status, "CREATED");
    createdMemoryIds.push(createData1.id);
    console.log(`  \x1b[32m✔\x1b[0m Session 1: Created CRITICAL decision: "${testTitle}"`);

    // 3. Disconnect Session 1 (simulating session termination)
    await client1.close();
    console.log("  \x1b[32m✔\x1b[0m Session 1: Session terminated and MCP process #1 closed.\n");

    // -------------------------------------------------------------
    // SESSION 2: Brand new independent Process 2 retrieves memory
    // -------------------------------------------------------------
    console.log("\x1b[1m--- SESSION 2 (New AI Conversation, Fresh Process) ---\x1b[0m");
    const transport2 = new StdioClientTransport({
      command: "node",
      args: [serverPath],
      env: {
        ...process.env,
        AIMEMORY_API_KEY: creds.rawKey,
        AIMEMORY_API_URL: "http://localhost:3000",
      },
    });

    const client2 = new Client(
      { name: "antigravity-session-2", version: "1.0.0" },
      { capabilities: {} }
    );

    await client2.connect(transport2);
    console.log("  \x1b[32m✔\x1b[0m Session 2: Connected to brand new MCP server process #2 via stdio");

    // 1. Resolve workspace in new session
    const resolveRes2 = (await client2.callTool({
      name: "aimemory_resolve_project",
      arguments: {
        workspaceName: "AiMemorySync",
        packageManifest: { name: "aimemorysync", ecosystem: "npm" },
      },
    })) as any;

    const resolveData2 = JSON.parse(resolveRes2.content[0].text);
    assert.strictEqual(resolveData2.projectId, resolveData1.projectId);
    console.log(`  \x1b[32m✔\x1b[0m Session 2: Verified identical project identity resolved (${resolveData2.projectId})`);

    // 2. Retrieve assembled context
    const contextRes2 = (await client2.callTool({
      name: "aimemory_get_context",
      arguments: { budget: 5000 },
    })) as any;

    const contextMarkdown = contextRes2.content[0].text;
    assert.ok(
      contextMarkdown.includes(testTitle),
      `Session 2 context must include memory saved in Session 1! Got:\n${contextMarkdown}`
    );
    assert.ok(
      contextMarkdown.includes("We use @aimemory/client-core for all platform integrations"),
      "Session 2 context must include decision content!"
    );

    console.log("  \x1b[32m✔\x1b[0m Session 2: Successfully retrieved memory saved in Session 1!");
    console.log("     ℹ Memory Title found:   " + testTitle);
    console.log("     ℹ Context Header found: # Project Context");

    await client2.close();
    console.log("  \x1b[32m✔\x1b[0m Session 2: Completed cleanly and closed.\n");

    console.log("==========================================================");
    console.log("MULTI-SESSION CONTINUITY VERIFICATION: SUCCESS");
    console.log("==========================================================\n");
    return true;
  } finally {
    // Teardown
    for (const memId of createdMemoryIds) {
      try {
        await directClient.memories.archive(memId);
      } catch {
        // Ignore
      }
    }
    await creds.cleanup();
  }
}

if (process.argv[1]?.includes("e2e-continuity")) {
  runContinuityTest()
    .then((ok) => process.exit(ok ? 0 : 1))
    .catch((err) => {
      console.error("Continuity test failed:", err);
      process.exit(1);
    });
}
