import assert from "assert";
import { prisma } from "../src/lib/prisma";
import crypto from "crypto";

async function testOnboardingFlow() {
  console.log("==========================================================");
  console.log("PHASE 5C.2: ONBOARDING & INTEGRATIONS E2E VERIFICATION");
  console.log("==========================================================");

  // 1. Provision Ephemeral Test Key
  const randomEntropy = crypto.randomBytes(24).toString("base64url");
  const rawKey = `aimem_live_${randomEntropy}`;
  const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");
  const last4 = rawKey.slice(-4);
  const name = `Onboarding E2E Runner - ${Date.now()}`;

  const createdKey = await prisma.apiKey.create({
    data: {
      name,
      keyHash,
      prefix: "aimem_live_",
      last4,
      scopes: ["read", "write", "admin"],
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });

  const baseUrl = "http://localhost:3000";

  try {
    // 2. Test GET /api/auth/verify with valid key
    console.log("\n1. Testing GET /api/auth/verify with valid key...");
    const verifyRes = await fetch(`${baseUrl}/api/auth/verify`, {
      headers: { Authorization: `Bearer ${rawKey}` },
    });
    assert.strictEqual(verifyRes.status, 200, "Verify should return 200 OK");
    const verifyJson = await verifyRes.json();
    assert.strictEqual(verifyJson.data.valid, true);
    assert.strictEqual(verifyJson.data.key.last4, last4);
    console.log("  \x1b[32m✔\x1b[0m GET /api/auth/verify passed for active key");

    // 3. Test GET /api/auth/verify with invalid key
    console.log("\n2. Testing GET /api/auth/verify with invalid key...");
    const invalidRes = await fetch(`${baseUrl}/api/auth/verify`, {
      headers: { Authorization: "Bearer aimem_live_invalidkey123456789" },
    });
    assert.strictEqual(invalidRes.status, 401, "Verify should return 401 Unauthorized");
    console.log("  \x1b[32m✔\x1b[0m GET /api/auth/verify correctly rejected invalid key (401)");

    // 4. Test POST /api/integrations/test
    console.log("\n3. Testing POST /api/integrations/test (connection test)...");
    const testRes = await fetch(`${baseUrl}/api/integrations/test`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${rawKey}`,
      },
      body: JSON.stringify({
        integration: "antigravity",
        apiKey: rawKey,
      }),
    });
    assert.strictEqual(testRes.status, 200, "Test integration should return 200");
    const testJson = await testRes.json();
    assert.strictEqual(testJson.data.success, true);
    assert.strictEqual(testJson.data.checks.apiReachable, true);
    assert.strictEqual(testJson.data.checks.apiKeyValid, true);
    assert.strictEqual(testJson.data.checks.scopesValid, true);
    assert.strictEqual(testJson.data.checks.mcpReady, true);
    console.log("  \x1b[32m✔\x1b[0m POST /api/integrations/test passed all 4 checks: API, Key, Scopes, MCP Ready");

    // 5. Test GET /api/integrations/antigravity/download (Plugin ZIP)
    console.log("\n4. Testing GET /api/integrations/antigravity/download (Plugin ZIP)...");
    const dlRes = await fetch(`${baseUrl}/api/integrations/antigravity/download`);
    assert.strictEqual(dlRes.status, 200, "Download should return 200 OK");
    assert.strictEqual(dlRes.headers.get("content-type"), "application/zip");
    assert.ok(
      dlRes.headers.get("content-disposition")?.includes("antigravity-aimemory-plugin.zip")
    );

    const zipBuffer = Buffer.from(await dlRes.arrayBuffer());
    assert.ok(zipBuffer.length > 500, "ZIP buffer must be non-empty");

    // Parse first local file header (mcp_config.json)
    const nameLen = zipBuffer.readUInt16LE(26);
    const extraLen = zipBuffer.readUInt16LE(28);
    const compLen = zipBuffer.readUInt32LE(18);
    const fileName = zipBuffer.subarray(30, 30 + nameLen).toString("utf-8");
    assert.strictEqual(fileName, "mcp_config.json");

    const compData = zipBuffer.subarray(30 + nameLen + extraLen, 30 + nameLen + extraLen + compLen);
    const zlib = await import("zlib");
    const uncompressed = zlib.inflateRawSync(compData).toString("utf-8");

    // Security assertions: MUST NOT contain live API keys or local paths
    assert.ok(!uncompressed.includes(rawKey), "ZIP must NOT leak the user's API key");
    assert.ok(!uncompressed.includes("aimem_live_"), "ZIP must NOT contain raw live keys");
    assert.ok(!uncompressed.includes("Freelance"), "ZIP must NOT leak local machine paths");
    assert.ok(uncompressed.includes("PASTE_YOUR_API_KEY_HERE"), "ZIP should contain generic placeholder");
    console.log("  \x1b[32m✔\x1b[0m Plugin ZIP generated successfully with zero credential / machine path leakage");

    console.log("\n==========================================================");
    console.log("ALL ONBOARDING & INTEGRATIONS ENDPOINTS VERIFIED CLEANLY!");
    console.log("==========================================================\n");
  } finally {
    // Teardown
    await prisma.apiKey.delete({ where: { id: createdKey.id } }).catch(() => {});
  }
}

testOnboardingFlow().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
