import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { TenantRole } from "@prisma/client";
import { createdResponse, parseJsonBody } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import { ValidationError, ConflictError } from "@/lib/errors";
import { normalizeSlug } from "@/lib/hash";
import { hashPassword } from "@/lib/auth/password";
import {
  createSession,
  safeUserSelect,
} from "@/services/auth.service";
import {
  SESSION_COOKIE_NAME,
  getSessionCookieOptions,
} from "@/lib/auth/cookies";
import { z } from "zod";

const registerSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name cannot exceed 100 characters").trim(),
  email: z.string().email("Valid email address is required").max(255).trim().toLowerCase(),
  password: z.string().min(8, "Password must be at least 8 characters").max(128, "Password cannot exceed 128 characters"),
  tenantName: z.string().min(2, "Workspace name must be at least 2 characters").max(100, "Workspace name cannot exceed 100 characters").trim(),
});

/**
 * POST /api/auth/register
 * Creates a human User account, a new Tenant, and an OWNER TenantMember inside a transaction.
 * Establishes an authenticated session via an HttpOnly cookie.
 */
export async function POST(request: NextRequest) {
  try {
    const rawBody = await parseJsonBody<Record<string, unknown>>(request);
    const validation = registerSchema.safeParse(rawBody);

    if (!validation.success) {
      throw new ValidationError("Invalid registration data", validation.error.flatten());
    }

    const { name, email, password, tenantName } = validation.data;

    // 1. Check if user with normalized email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictError(`An account with email '${email}' already exists`);
    }

    // 2. Hash password securely
    const passwordHash = await hashPassword(password);

    // 3. Derive unique tenant slug
    const baseSlug = normalizeSlug(tenantName) || "workspace";
    let tenantSlug = baseSlug;
    let counter = 1;
    while (await prisma.tenant.findUnique({ where: { slug: tenantSlug } })) {
      tenantSlug = `${baseSlug}-${counter++}`;
    }

    // 4. Create User, Tenant, and TenantMember in a single transaction
    const { user, tenant, membership } = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email,
          name,
          passwordHash,
        },
        select: safeUserSelect,
      });

      const newTenant = await tx.tenant.create({
        data: {
          name: tenantName,
          slug: tenantSlug,
        },
      });

      const newMembership = await tx.tenantMember.create({
        data: {
          userId: newUser.id,
          tenantId: newTenant.id,
          role: TenantRole.OWNER,
        },
      });

      return { user: newUser, tenant: newTenant, membership: newMembership };
    });

    // 5. Create secure session
    const userAgent = request.headers.get("user-agent") || undefined;
    const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined;

    const { rawToken } = await createSession({
      userId: user.id,
      tenantId: tenant.id,
      userAgent,
      ipAddress,
    });

    // 6. Set HttpOnly session cookie
    const response = createdResponse({
      message: "User registered and workspace created successfully",
      user,
      activeTenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        role: membership.role,
      },
    });

    const cookieOptions = getSessionCookieOptions();
    response.cookies.set(SESSION_COOKIE_NAME, rawToken, cookieOptions);

    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
