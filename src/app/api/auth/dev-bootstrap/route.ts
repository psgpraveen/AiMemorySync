import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { TenantRole } from "@prisma/client";
import { successResponse } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { DEFAULT_LEGACY_TENANT_ID } from "@/config/tenant";
import { hashPassword } from "@/lib/auth/password";
import { createSession } from "@/services/auth.service";
import { SESSION_COOKIE_NAME, getSessionCookieOptions } from "@/lib/auth/cookies";

/**
 * POST /api/auth/dev-bootstrap
 * DEVELOPMENT-ONLY convenience endpoint.
 * Provisions or signs into a local development user (dev@aimemory.local) attached to Legacy Workspace.
 *
 * STRICT GUARD: Hard-disabled in production. Never exposes credentials or bypasses security.
 */
export async function POST(_request: NextRequest) {
  try {
    throw new ForbiddenError("Developer bootstrap is permanently disabled.");

    const devEmail = "dev@aimemory.local";

    // 1. Verify Legacy Workspace exists
    const legacyTenant = await prisma.tenant.findUnique({
      where: { id: DEFAULT_LEGACY_TENANT_ID },
    });

    if (!legacyTenant) {
      throw new NotFoundError("Legacy Workspace tenant not found. Please run migrations first.");
    }

    // 2. Find or create dev user
    let devUser = await prisma.user.findUnique({
      where: { email: devEmail },
    });

    if (!devUser) {
      const devPasswordHash = await hashPassword("DevLocalPassword123!");
      devUser = await prisma.user.create({
        data: {
          email: devEmail,
          name: "Developer Local",
          passwordHash: devPasswordHash,
        },
      });
    }

    // 3. Ensure membership in Legacy Workspace
    let membership = await prisma.tenantMember.findUnique({
      where: {
        tenantId_userId: {
          tenantId: legacyTenant.id,
          userId: devUser.id,
        },
      },
    });

    if (!membership) {
      membership = await prisma.tenantMember.create({
        data: {
          tenantId: legacyTenant.id,
          userId: devUser.id,
          role: TenantRole.OWNER,
        },
      });
    }

    // 4. Create session
    const { rawToken } = await createSession({
      userId: devUser.id,
      tenantId: legacyTenant.id,
      userAgent: request.headers.get("user-agent") || "dev-bootstrap",
    });

    const response = successResponse({
      message: "Development session bootstrapped successfully",
      user: {
        id: devUser.id,
        email: devUser.email,
        name: devUser.name,
        createdAt: devUser.createdAt,
      },
      activeTenant: {
        id: legacyTenant.id,
        name: legacyTenant.name,
        slug: legacyTenant.slug,
        role: membership.role,
      },
    });

    const cookieOptions = getSessionCookieOptions(request);
    response.cookies.set(SESSION_COOKIE_NAME, rawToken, cookieOptions);

    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
