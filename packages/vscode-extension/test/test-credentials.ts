import crypto from "crypto";
import { prisma } from "../../../src/lib/prisma";

export interface TestCredentialSession {
  rawKey: string;
  cleanup: () => Promise<void>;
}

/**
 * Provides an isolated, non-hardcoded API credential for automated testing.
 * If AIMEMORY_TEST_API_KEY is defined in the environment, uses that key.
 * Otherwise, generates a temporary test API key in the database with full scopes
 * and provides a teardown function that permanently deletes it.
 */
export async function acquireTestCredential(namePrefix = "VSCode Test Runner"): Promise<TestCredentialSession> {
  const envKey = process.env.AIMEMORY_TEST_API_KEY?.trim();
  if (envKey) {
    return {
      rawKey: envKey,
      cleanup: async () => {},
    };
  }

  // Generate ephemeral test key
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
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hr expiry safety
    },
  });

  return {
    rawKey,
    cleanup: async () => {
      try {
        await prisma.apiKey.delete({ where: { id: created.id } });
      } catch {
        // Ignore if already deleted
      }
    },
  };
}
