import * as assert from "assert";
import { McpLogger } from "../src/security/logger.js";
import { resolveMcpConfig } from "../src/config.js";

export async function runAuthTests(): Promise<{ passed: number; failed: number }> {
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

  console.log("\n\x1b[1m1. Logger Redaction & Security Pattern Tests:\x1b[0m");

  await test("Redacts live and test API key patterns", () => {
    const logger = new McpLogger(false);
    const scrubbed1 = logger.sanitize("Error using key aimem_live_abcdef1234567890_xyz");
    assert.strictEqual(scrubbed1, "Error using key [REDACTED_API_KEY]");

    const scrubbed2 = logger.sanitize("Test key aimem_test_1234567890abcdef_xyz in payload");
    assert.strictEqual(scrubbed2, "Test key [REDACTED_API_KEY] in payload");
  });

  await test("Redacts Bearer authorization tokens", () => {
    const logger = new McpLogger(false);
    const scrubbed = logger.sanitize("Authorization: Bearer my_secret_token_1234567890_abcdef");
    assert.strictEqual(scrubbed, "Authorization: Bearer [REDACTED_TOKEN]");
  });

  await test("Redacts JSON credential values", () => {
    const logger = new McpLogger(false);
    const raw = '{"apiKey": "unscrubbed_secret", "token": "secret_token_val", "projectId": "safe-123"}';
    const scrubbed = logger.sanitize(raw);
    assert.ok(!scrubbed.includes("unscrubbed_secret"));
    assert.ok(!scrubbed.includes("secret_token_val"));
    assert.ok(scrubbed.includes('"projectId": "safe-123"'));
  });

  await test("Does NOT redact legitimate words like 'project key' or 'package key'", () => {
    const logger = new McpLogger(false);
    const input = "project key resolution failed for memory key identifier and package manifest key";
    const scrubbed = logger.sanitize(input);
    assert.strictEqual(scrubbed, input);
  });

  await test("Redacts raw Windows absolute machine drive paths", () => {
    const logger = new McpLogger(false);
    const scrubbed = logger.sanitize("Failed at D:\\Freelance\\AiMemorySync\\packages\\mcp-server");
    assert.ok(!scrubbed.includes("Freelance"));
    assert.ok(!scrubbed.includes("D:"));
  });

  console.log("\n\x1b[1m2. Configuration Resolver Tests:\x1b[0m");

  await test("Resolves default API URL with trailing slashes trimmed", () => {
    const originalUrl = process.env.AIMEMORY_API_URL;
    try {
      process.env.AIMEMORY_API_URL = "http://localhost:3000///";
      const config = resolveMcpConfig();
      assert.strictEqual(config.apiUrl, "http://localhost:3000");
    } finally {
      process.env.AIMEMORY_API_URL = originalUrl;
    }
  });

  return { passed, failed };
}

if (process.argv[1]?.includes("auth.test")) {
  runAuthTests().then(({ failed }) => {
    if (failed > 0) process.exit(1);
  });
}
