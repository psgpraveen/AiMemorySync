import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { successResponse, parseJsonBody } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import { UnauthorizedError, ValidationError, RateLimitError } from "@/lib/errors";
import { checkRateLimit } from "@/lib/api/rate-limiter";
import {
  verifyUserPassword,
  createSession,
  selectDeterministicActiveTenant,
  generateApiKey,
} from "@/services/auth.service";
import {
  SESSION_COOKIE_NAME,
  getSessionCookieOptions,
} from "@/lib/auth/cookies";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email("Valid email address is required").max(255).trim().toLowerCase(),
  password: z.string().min(1, "Password is required"),
  generateKey: z.boolean().optional(),
  clientName: z.string().max(100).optional(),
});

/**
 * POST /api/auth/login
 * Human email & password authentication endpoint.
 * Issues a secure HttpOnly session cookie on successful verification.
 */
export async function POST(request: NextRequest) {
  try {
    const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
    const userAgent = request.headers.get("user-agent") || undefined;

    // 1. Rate-limit brute-force protection: 10 attempts per minute per IP
    const rateLimit = checkRateLimit(`login:${ipAddress}`, 10, 60000);
    if (!rateLimit.isAllowed) {
      const retrySecs = Math.ceil((rateLimit.resetAt - Date.now()) / 1000);
      throw new RateLimitError(`Too many login attempts. Please retry in ${retrySecs} seconds.`);
    }

    const rawBody = await parseJsonBody<Record<string, unknown>>(request);
    const validation = loginSchema.safeParse(rawBody);

    if (!validation.success) {
      throw new ValidationError("Invalid login credentials format", validation.error.flatten());
    }

    const { email, password } = validation.data;

    // 2. Query user by normalized email
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Use generic message to prevent user enumeration
      throw new UnauthorizedError("Invalid email or password");
    }

    // 3. Verify Argon2id password hash
    const isValid = await verifyUserPassword(user, password);
    if (!isValid) {
      throw new UnauthorizedError("Invalid email or password");
    }

    // 4. Determine tenant memberships and deterministically select active tenant
    const memberships = await prisma.tenantMember.findMany({
      where: { userId: user.id },
      include: { tenant: true },
      orderBy: { createdAt: "asc" },
    });

    if (memberships.length === 0) {
      throw new UnauthorizedError("No workspace memberships found for this user");
    }

    const activeMembership = selectDeterministicActiveTenant(memberships);
    if (!activeMembership) {
      throw new UnauthorizedError("Failed to select active workspace");
    }

    // 5. If machine API key was requested (e.g. VS Code / Antigravity Extension sign-in), generate one
    let generatedKeyData: { rawKey: string } | null = null;
    if (validation.data.generateKey) {
      const keyName = validation.data.clientName?.trim() || "IDE Extension Key";
      const keyResult = await generateApiKey({
        name: keyName,
        tenantId: activeMembership.tenant.id,
        createdById: user.id,
        scopes: ["read", "write", "admin"],
        environment: process.env.NODE_ENV === "production" ? "live" : "test",
      });
      generatedKeyData = { rawKey: keyResult.rawKey };
    }

    // 6. Create secure session
    const { rawToken } = await createSession({
      userId: user.id,
      tenantId: activeMembership.tenant.id,
      userAgent,
      ipAddress,
    });

    // 7. Safe response (excluding passwordHash, sessionToken, and secrets)
    const response = successResponse({
      message: "Signed in successfully",
      apiKey: generatedKeyData?.rawKey,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt,
      },
      activeTenant: {
        id: activeMembership.tenant.id,
        name: activeMembership.tenant.name,
        slug: activeMembership.tenant.slug,
        role: activeMembership.role,
      },
      memberships: memberships.map((m) => ({
        tenantId: m.tenant.id,
        name: m.tenant.name,
        slug: m.tenant.slug,
        role: m.role,
      })),
    });

    // 8. Attach HttpOnly session cookie
    const cookieOptions = getSessionCookieOptions(request);
    response.cookies.set(SESSION_COOKIE_NAME, rawToken, cookieOptions);

    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
