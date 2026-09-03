import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api/auth-guard";
import { prisma } from "@/lib/prisma";
import { successResponse } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import { UnauthorizedError } from "@/lib/errors";

/**
 * GET /api/auth/verify
 * Validates the caller's Bearer API key and returns safe metadata.
 */
export async function GET(request: NextRequest) {
  try {
    const principal = await requireAuth(request);

    const apiKey = await prisma.apiKey.findUnique({
      where: { id: principal.keyId },
      select: {
        id: true,
        name: true,
        prefix: true,
        last4: true,
        scopes: true,
        createdAt: true,
        expiresAt: true,
        lastUsedAt: true,
        revokedAt: true,
      },
    });

    if (!apiKey || apiKey.revokedAt !== null) {
      throw new UnauthorizedError("API key is not found or has been revoked");
    }

    return successResponse({
      valid: true,
      key: apiKey,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
