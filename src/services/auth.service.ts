import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import type { ApiKey, User, Session, TenantRole } from "@prisma/client";
import { UnauthorizedError, ForbiddenError, NotFoundError, ValidationError, ConflictError } from "@/lib/errors";
import { DEFAULT_LEGACY_TENANT_ID } from "@/config/tenant";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import {
  hashSessionToken,
  generateRawSessionToken,
  SESSION_MAX_AGE_SECONDS,
  SLIDING_RENEWAL_THRESHOLD_MS,
} from "@/lib/auth/cookies";

export type SafeApiKey = Omit<ApiKey, "keyHash">;
export type SafeUser = Omit<User, "passwordHash">;

export const safeUserSelect = {
  id: true,
  email: true,
  name: true,
  createdAt: true,
  updatedAt: true,
} as const;

export interface SessionContext {
  session: {
    id: string;
    expiresAt: Date;
    createdAt: Date;
  };
  user: SafeUser;
  activeTenant: {
    id: string;
    name: string;
    slug: string;
    role: TenantRole;
  };
  memberships: Array<{
    tenantId: string;
    name: string;
    slug: string;
    role: TenantRole;
  }>;
}

export const safeApiKeySelect = {
  id: true,
  tenantId: true,
  projectId: true,
  createdById: true,
  name: true,
  prefix: true,
  last4: true,
  scopes: true,
  createdAt: true,
  updatedAt: true,
  lastUsedAt: true,
  expiresAt: true,
  revokedAt: true,
} as const;

export interface GenerateApiKeyInput {
  name: string;
  tenantId?: string;
  projectId?: string;
  createdById?: string;
  scopes?: string[];
  expiresInDays?: number;
  environment?: "live" | "test";
}

export interface GenerateApiKeyResult {
  apiKey: SafeApiKey;
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

  const tenantId = input.tenantId || DEFAULT_LEGACY_TENANT_ID;

  // If key is to be scoped to a project, verify that the project exists in this tenant
  if (input.projectId) {
    const project = await prisma.project.findFirst({
      where: {
        id: input.projectId,
        tenantId,
      },
    });

    if (!project) {
      throw new NotFoundError(
        `Project with ID '${input.projectId}' not found in this workspace`,
        "PROJECT_NOT_FOUND"
      );
    }
  }

  const apiKey = await prisma.apiKey.create({
    data: {
      tenantId,
      projectId: input.projectId ?? null,
      createdById: input.createdById ?? null,
      name: trimmedName,
      keyHash,
      prefix,
      last4,
      scopes,
      expiresAt,
    },
    select: safeApiKeySelect,
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
 * Revokes an active API key immediately, verifying tenant ownership.
 */
export async function revokeApiKey(id: string, tenantId?: string): Promise<SafeApiKey> {
  const existing = await prisma.apiKey.findFirst({
    where: {
      id,
      ...(tenantId && { tenantId }),
    },
  });

  if (!existing) {
    throw new NotFoundError(`API key with ID '${id}' not found`, "PROJECT_NOT_FOUND");
  }

  return prisma.apiKey.update({
    where: { id },
    data: { revokedAt: new Date() },
    select: safeApiKeySelect,
  });
}

/**
 * Lists registered API keys strictly scoped to the tenant (without exposing raw secret keys or hashes).
 */
export async function listApiKeys(
  tenantId: string = DEFAULT_LEGACY_TENANT_ID,
  projectId?: string
): Promise<SafeApiKey[]> {
  return prisma.apiKey.findMany({
    where: {
      tenantId,
      ...(projectId && { projectId }),
    },
    select: safeApiKeySelect,
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Seeds or retrieves a default bootstrap development API key if none exist.
 */
export async function ensureBootstrapApiKey(): Promise<{ key: SafeApiKey; rawKey?: string }> {
  const existingKeys = await prisma.apiKey.findMany({
    where: { revokedAt: null },
    select: safeApiKeySelect,
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

// ============================================================================
// HUMAN AUTHENTICATION & SECURE SESSION SERVICES
// ============================================================================

export interface CreateUserInput {
  email: string;
  name: string;
  password: string;
}

/**
 * Creates a new human User account.
 */
export async function createUser(input: CreateUserInput): Promise<SafeUser> {
  const email = input.email?.trim().toLowerCase();
  if (!email || !email.includes("@") || email.length > 255) {
    throw new ValidationError("A valid email address is required");
  }

  const name = input.name?.trim();
  if (!name || name.length < 1 || name.length > 100) {
    throw new ValidationError("Name must be between 1 and 100 characters");
  }

  const existing = await prisma.user.findUnique({
    where: { email },
  });

  if (existing) {
    throw new ConflictError(`A user with email '${email}' already exists`);
  }

  const passwordHash = await hashPassword(input.password);

  return prisma.user.create({
    data: {
      email,
      name,
      passwordHash,
    },
    select: safeUserSelect,
  });
}

/**
 * Verifies a candidate password against a user's stored Argon2id hash.
 */
export async function verifyUserPassword(user: User, candidatePassword: string): Promise<boolean> {
  return verifyPassword(candidatePassword, user.passwordHash);
}

export interface CreateSessionInput {
  userId: string;
  tenantId: string;
  userAgent?: string | null;
  ipAddress?: string | null;
}

export interface CreateSessionResult {
  session: Session;
  rawToken: string;
}

/**
 * Creates a secure human session.
 * Stores ONLY the SHA-256 hash of the token in the database.
 * Returns the raw token once for Set-Cookie header.
 */
export async function createSession(input: CreateSessionInput): Promise<CreateSessionResult> {
  const rawToken = generateRawSessionToken();
  const sessionTokenHash = hashSessionToken(rawToken);
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);

  const session = await prisma.session.create({
    data: {
      sessionTokenHash,
      userId: input.userId,
      tenantId: input.tenantId,
      expiresAt,
      userAgent: input.userAgent ?? null,
      ipAddress: input.ipAddress ?? null,
    },
  });

  return { session, rawToken };
}

/**
 * Validates a session token, enforcing the strict verification chain:
 * Session -> User -> TenantMember -> Tenant.
 *
 * Never trusts session.tenantId by itself.
 * Renews sliding expiration window only when session age > 24 hours.
 */
export async function validateSession(rawToken: string): Promise<SessionContext | null> {
  if (!rawToken || typeof rawToken !== "string") {
    return null;
  }

  const tokenHash = hashSessionToken(rawToken);
  const session = await prisma.session.findUnique({
    where: { sessionTokenHash: tokenHash },
    include: {
      user: {
        select: safeUserSelect,
      },
    },
  });

  if (!session) {
    return null;
  }

  const now = new Date();

  // Never renew or accept expired sessions
  if (session.expiresAt < now) {
    void prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  // Authorization chain: Verify TenantMember exists for session.userId and session.tenantId
  const activeMembership = await prisma.tenantMember.findUnique({
    where: {
      tenantId_userId: {
        tenantId: session.tenantId,
        userId: session.userId,
      },
    },
    include: {
      tenant: true,
    },
  });

  if (!activeMembership) {
    // User is no longer an authorized member of the session's active tenant
    return null;
  }

  // Sliding renewal: only when session age exceeds 24 hours
  const sessionAgeMs = now.getTime() - session.createdAt.getTime();
  if (sessionAgeMs > SLIDING_RENEWAL_THRESHOLD_MS) {
    const newExpiresAt = new Date(now.getTime() + SESSION_MAX_AGE_SECONDS * 1000);
    void prisma.session
      .update({
        where: { id: session.id },
        data: { expiresAt: newExpiresAt },
      })
      .catch(() => {});
  }

  // Fetch all tenant memberships for this user
  const allMemberships = await prisma.tenantMember.findMany({
    where: { userId: session.userId },
    include: { tenant: true },
    orderBy: { createdAt: "asc" },
  });

  return {
    session: {
      id: session.id,
      expiresAt: session.expiresAt,
      createdAt: session.createdAt,
    },
    user: session.user,
    activeTenant: {
      id: activeMembership.tenant.id,
      name: activeMembership.tenant.name,
      slug: activeMembership.tenant.slug,
      role: activeMembership.role,
    },
    memberships: allMemberships.map((m) => ({
      tenantId: m.tenant.id,
      name: m.tenant.name,
      slug: m.tenant.slug,
      role: m.role,
    })),
  };
}

/**
 * Deletes a session by raw token.
 */
export async function deleteSession(rawToken: string): Promise<void> {
  if (!rawToken || typeof rawToken !== "string") return;
  const tokenHash = hashSessionToken(rawToken);
  await prisma.session.deleteMany({
    where: { sessionTokenHash: tokenHash },
  });
}

/**
 * Deletes all active sessions for a user.
 */
export async function deleteAllUserSessions(userId: string): Promise<void> {
  await prisma.session.deleteMany({
    where: { userId },
  });
}

/**
 * Switches the active tenant on an authenticated session.
 * Rejects unauthorized tenant switching with ForbiddenError.
 */
export async function switchActiveTenant(
  userId: string,
  sessionId: string,
  targetTenantId: string
): Promise<{ id: string; name: string; slug: string; role: TenantRole }> {
  const membership = await prisma.tenantMember.findUnique({
    where: {
      tenantId_userId: {
        tenantId: targetTenantId,
        userId,
      },
    },
    include: { tenant: true },
  });

  if (!membership) {
    throw new ForbiddenError("You do not have access to the requested workspace");
  }

  await prisma.session.update({
    where: { id: sessionId },
    data: { tenantId: targetTenantId },
  });

  return {
    id: membership.tenant.id,
    name: membership.tenant.name,
    slug: membership.tenant.slug,
    role: membership.role,
  };
}

/**
 * Deterministically selects the primary active tenant for login:
 * Role priority: OWNER (1) > ADMIN (2) > MEMBER (3) > VIEWER (4), then oldest membership (createdAt ASC).
 */
export function selectDeterministicActiveTenant<
  T extends { tenantId: string; role: TenantRole; createdAt: Date }
>(memberships: T[]): T | null {
  if (!memberships || memberships.length === 0) return null;

  const ROLE_PRIORITY: Record<TenantRole, number> = {
    OWNER: 1,
    ADMIN: 2,
    MEMBER: 3,
    VIEWER: 4,
  };

  return [...memberships].sort((a, b) => {
    const roleDiff = (ROLE_PRIORITY[a.role] ?? 99) - (ROLE_PRIORITY[b.role] ?? 99);
    if (roleDiff !== 0) return roleDiff;
    const timeDiff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    if (timeDiff !== 0) return timeDiff;
    return a.tenantId.localeCompare(b.tenantId);
  })[0];
}

