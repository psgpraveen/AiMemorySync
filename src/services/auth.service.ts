import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import type { ApiKey } from "@prisma/client";
import { UnauthorizedError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";

export interface GenerateApiKeyInput {
  name: string;
  scopes?: string[];
  expiresInDays?: number;
  environment?: "live" | "test";
}

export interface GenerateApiKeyResult {
  apiKey: ApiKey;
  rawKey: string;
}

/**
 * Generates a new cryptographically secure API key.
 * Format: aimem_<live|test>_<32_random_bytes_base64url>
 * The plaintext key is returned ONLY once in this method.
 * Only the SHA-256 hash of the key is stored in the database.
 */
export async function generateApiKey(input: GenerateApiKeyInput): Promise<GenerateApiKeyResult> {
  const trimmedName = input.name?.trim();
  if (!trimmedName || trimmedName.length > 100) {
    throw new ValidationError("API key name must be between 1 and 100 characters");
  }

  const env = input.environment === "test" ? "test" : "live";
  const prefix = `aimem_${env}_`;
  const randomEntropy = crypto.randomBytes(24).toString("base64url");
  const rawKey = `${prefix}${randomEntropy}`;
  const last4 = rawKey.slice(-4);

  const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");

  const scopes = Array.isArray(input.scopes) && input.scopes.length > 0
    ? Array.from(new Set(input.scopes.map((s) => s.trim().toLowerCase())))
    : ["read", "write"];

  const expiresAt = input.expiresInDays && input.expiresInDays > 0
    ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000)
    : null;

  const apiKey = await prisma.apiKey.create({
    data: {
      name: trimmedName,
      keyHash,
      prefix,
      last4,
      scopes,
      expiresAt,
    },
  });

  return { apiKey, rawKey };
}

/**
 * Validates a plaintext API key against the database.
 * Verifies existence, active status, non-expiration, and scope authorization.
 */
export async function validateApiKey(
  rawKey: string,
  requiredScope?: "read" | "write" | "admin"
): Promise<ApiKey> {
  if (!rawKey || typeof rawKey !== "string") {
    throw new UnauthorizedError("Authentication token is missing. Provide 'Authorization: Bearer <api_key>'");
  }

  const trimmed = rawKey.trim();
  if (trimmed.length < 16 || trimmed.length > 128) {
    throw new UnauthorizedError("Malformed API key format");
  }

  const keyHash = crypto.createHash("sha256").update(trimmed).digest("hex");

  const apiKey = await prisma.apiKey.findUnique({
    where: { keyHash },
  });

  if (!apiKey || apiKey.revokedAt !== null) {
    throw new UnauthorizedError("Invalid or revoked API key");
  }

  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
    throw new UnauthorizedError("API key has expired");
  }

  if (requiredScope) {
    const hasScope = apiKey.scopes.includes(requiredScope) || apiKey.scopes.includes("admin");
    if (!hasScope) {
      throw new ForbiddenError(`API key lacks required '${requiredScope}' permission`);
    }
  }

  // Update lastUsedAt asynchronously without blocking request pipeline (throttled to at most once every 60s)
  const now = new Date();
  const shouldUpdateLastUsed =
    !apiKey.lastUsedAt ||
    now.getTime() - new Date(apiKey.lastUsedAt).getTime() > 60_000;

  if (shouldUpdateLastUsed) {
    void prisma.apiKey
      .update({
        where: { id: apiKey.id },
        data: { lastUsedAt: now },
      })
      .catch(() => {});
  }

  return apiKey;
}

/**
 * Revokes an active API key immediately.
 */
export async function revokeApiKey(id: string): Promise<ApiKey> {
  const existing = await prisma.apiKey.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new NotFoundError(`API key with ID '${id}' not found`, "PROJECT_NOT_FOUND");
  }

  return prisma.apiKey.update({
    where: { id },
    data: { revokedAt: new Date() },
  });
}

/**
 * Lists all registered API keys (without exposing raw secret keys).
 */
export async function listApiKeys(): Promise<ApiKey[]> {
  return prisma.apiKey.findMany({
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Seeds or retrieves a default bootstrap development API key if none exist.
 */
export async function ensureBootstrapApiKey(): Promise<{ key: ApiKey; rawKey?: string }> {
  const existingKeys = await prisma.apiKey.findMany({
    where: { revokedAt: null },
    take: 1,
  });

  if (existingKeys.length > 0) {
    return { key: existingKeys[0] };
  }

  const result = await generateApiKey({
    name: "Bootstrap Default Key",
    scopes: ["read", "write", "admin"],
    environment: process.env.NODE_ENV === "production" ? "live" : "test",
  });

  return { key: result.apiKey, rawKey: result.rawKey };
}
