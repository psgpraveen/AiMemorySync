import crypto from "crypto";
import { NextRequest } from "next/server";
import { validateApiKey, validateSession } from "@/services/auth.service";
import { checkRateLimit } from "@/lib/api/rate-limiter";
import { UnauthorizedError, ForbiddenError, RateLimitError } from "@/lib/errors";
import { getSessionTokenFromRequest } from "@/lib/auth/cookies";
import { verifyCsrfOrigin } from "@/lib/auth/csrf";
import { DEFAULT_LEGACY_TENANT_ID } from "@/config/tenant";
import type { TenantRole } from "@prisma/client";

export interface AuthPrincipal {
  authType: "human" | "machine";
  mode: "human" | "machine"; // Backward-compatible alias for existing callers
  userId?: string;
  tenantId: string;
  tenantRole?: TenantRole;
  role?: TenantRole; // Backward-compatible alias for existing callers
  apiKeyId?: string;
  keyId?: string; // Backward-compatible alias for existing callers
  projectId?: string;
  name: string;
  scopes: string[];
}

/**
 * Unified Agent Context derived from authenticated server-side identity (AuthPrincipal).
 * Represents the common operational context for integrations (MCP, VS Code, Cursor, Antigravity, CLI, Web).
 */
export interface AgentContext {
  tenantId: string;
  projectId?: string;
  integrationId?: string;
  integrationType: string;
  userId?: string;
  permissions: string[];
  requestId: string;
  principal: AuthPrincipal;
}

export interface AuthGuardOptions {
  requiredScope?: "read" | "write" | "admin";
  rateLimit?: number; // requests per minute
}

/**
 * Enforces unified Dual-Mode Authentication and Tenant/Scope Authorization:
 * - MODE 1: Machine Bearer API Key (Authorization: Bearer aimem_...)
 * - MODE 2: Human Session Cookie (aimem_session) with Origin CSRF verification
 *
 * Resolves a server-authoritative AuthPrincipal context containing:
 * - authType ("human" | "machine")
 * - tenantId (strictly validated, non-null)
 * - tenantRole (OWNER | ADMIN | MEMBER | VIEWER for human sessions)
 * - projectId (optional; populated if machine key is project-scoped)
 * - scopes (authorized capabilities)
 *
 * @throws UnauthorizedError If credential is missing, invalid, or expired (401)
 * @throws ForbiddenError If principal lacks required role/scope or triggers CSRF (403)
 * @throws RateLimitError If request frequency exceeds rate limit window (429)
 */
export async function requireAuth(
  request: NextRequest,
  options?: AuthGuardOptions
): Promise<AuthPrincipal> {
  const authHeader =
    request.headers.get("authorization") || request.headers.get("x-api-key");

  // =========================================================================
  // MODE 1: MACHINE BEARER API KEY (MCP, IDE extensions, SDK, CLI)
  // =========================================================================
  if (authHeader) {
    const rawToken = authHeader.startsWith("Bearer ")
      ? authHeader.substring(7).trim()
      : authHeader.trim();

    const apiKey = await validateApiKey(rawToken, options?.requiredScope);

    // Rate limit check per API key ID
    const limit = options?.rateLimit ?? (options?.requiredScope === "write" ? 60 : 120);
    const rateLimitResult = checkRateLimit(apiKey.id, limit, 60000);

    if (!rateLimitResult.isAllowed) {
      const retrySecs = Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000);
      throw new RateLimitError(
        `Rate limit exceeded. Maximum ${limit} requests per minute. Retry in ${retrySecs}s.`
      );
    }

    return {
      authType: "machine",
      mode: "machine",
      apiKeyId: apiKey.id,
      keyId: apiKey.id,
      tenantId: apiKey.tenantId,
      projectId: apiKey.projectId ?? undefined,
      name: apiKey.name,
      scopes: apiKey.scopes,
    };
  }

  // =========================================================================
  // MODE 2: HUMAN SESSION COOKIE (Web Dashboard)
  // =========================================================================
  const sessionToken = getSessionTokenFromRequest(request);
  if (sessionToken) {
    // State-changing requests authenticated via session cookie must pass Origin CSRF check
    verifyCsrfOrigin(request);

    const sessionContext = await validateSession(sessionToken);
    if (!sessionContext) {
      throw new UnauthorizedError("Session has expired. Please sign in again.");
    }

    // Role-based scope resolution for human tenant members
    const userRole = sessionContext.activeTenant.role;
    const humanScopes: string[] =
      userRole === "OWNER" || userRole === "ADMIN"
        ? ["read", "write", "admin"]
        : userRole === "MEMBER"
        ? ["read", "write"]
        : ["read"]; // VIEWER is read-only

    if (options?.requiredScope && !humanScopes.includes(options.requiredScope)) {
      throw new ForbiddenError(
        `Action requires '${options.requiredScope}' permission (your workspace role is '${userRole}')`
      );
    }

    // Rate limit check per User ID
    const limit = options?.rateLimit ?? (options?.requiredScope === "write" ? 60 : 120);
    const rateLimitResult = checkRateLimit(sessionContext.user.id, limit, 60000);

    if (!rateLimitResult.isAllowed) {
      const retrySecs = Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000);
      throw new RateLimitError(
        `Rate limit exceeded. Maximum ${limit} requests per minute. Retry in ${retrySecs}s.`
      );
    }

    return {
      authType: "human",
      mode: "human",
      userId: sessionContext.user.id,
      tenantId: sessionContext.activeTenant.id,
      tenantRole: userRole,
      role: userRole,
      name: sessionContext.user.name,
      scopes: humanScopes,
    };
  }

  // =========================================================================
  // DEVELOPMENT-ONLY ANONYMOUS BYPASS (Strictly disabled in production)
  // =========================================================================
  if (
    process.env.NODE_ENV === "development" &&
    process.env.ALLOW_DEV_ANONYMOUS_AUTH === "true"
  ) {
    return {
      authType: "machine",
      mode: "machine",
      apiKeyId: "dev-anonymous-key",
      keyId: "dev-anonymous-key",
      tenantId: DEFAULT_LEGACY_TENANT_ID,
      name: "Development Anonymous Principal",
      scopes: ["read", "write", "admin"],
    };
  }

  throw new UnauthorizedError(
    "Authentication required. Provide 'Authorization: Bearer <api_key>' or sign in via session cookie."
  );
}

/**
 * Validates that an authenticated principal with a project-scoped machine key
 * is operating exclusively against its authorized project.
 *
 * @throws ForbiddenError If key is scoped to a different project (403)
 */
export function enforceProjectScope(
  principal: AuthPrincipal,
  targetProjectId: string
): void {
  if (principal.projectId && principal.projectId !== targetProjectId) {
    throw new ForbiddenError(
      `API key is scoped exclusively to project '${principal.projectId}' and cannot access '${targetProjectId}'`
    );
  }
}

/**
 * Derives a unified AgentContext from an authenticated AuthPrincipal and optional NextRequest.
 * Extracts client transport metadata (x-aimemory-platform, x-aimemory-client-id, x-request-id)
 * while strictly preserving authoritative server-side tenantId and projectId.
 */
export function createAgentContext(
  principal: AuthPrincipal,
  request?: NextRequest
): AgentContext {
  const platformHeader = request?.headers.get("x-aimemory-platform");
  const clientIdHeader = request?.headers.get("x-aimemory-client-id");
  const reqIdHeader = request?.headers.get("x-request-id");

  const integrationType = platformHeader
    ? platformHeader.trim().toUpperCase()
    : principal.authType === "human"
    ? "WEB"
    : "API";

  const integrationId =
    clientIdHeader?.trim() || principal.apiKeyId || principal.userId || undefined;

  const requestId = reqIdHeader?.trim() || crypto.randomUUID();

  return {
    tenantId: principal.tenantId,
    projectId: principal.projectId,
    integrationId,
    integrationType,
    userId: principal.userId,
    permissions: principal.scopes,
    requestId,
    principal,
  };
}

