import { NextRequest } from "next/server";
import { generateApiKey, listApiKeys } from "@/services/auth.service";
import { successResponse, createdResponse, parseJsonBody } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import { requireAuth } from "@/lib/api/auth-guard";
import { z } from "zod";
import { ValidationError, ForbiddenError } from "@/lib/errors";

const createKeySchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long").trim(),
  projectId: z.string().uuid("Invalid project ID format").optional(),
  scopes: z.array(z.string().trim()).optional(),
  expiresInDays: z.number().int().positive().optional(),
});

/**
 * GET /api/auth/keys
 * Lists registered API keys scoped strictly to the authenticated tenant. Requires admin scope.
 */
export async function GET(request: NextRequest) {
  try {
    const principal = await requireAuth(request, { requiredScope: "admin" });

    if (principal.projectId) {
      throw new ForbiddenError("Project-scoped API key cannot manage API keys");
    }

    const keys = await listApiKeys(principal.tenantId);
    return successResponse(keys);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/auth/keys
 * Generates a new API key scoped strictly to the caller's tenant. Returns plaintext token once.
 */
export async function POST(request: NextRequest) {
  try {
    const principal = await requireAuth(request, { requiredScope: "admin" });

    if (principal.projectId) {
      throw new ForbiddenError("Project-scoped API key cannot generate API keys");
    }

    const rawBody = await parseJsonBody<Record<string, unknown>>(request);
    const validation = createKeySchema.safeParse(rawBody);

    if (!validation.success) {
      throw new ValidationError("Invalid API key creation payload", validation.error.flatten());
    }

    const result = await generateApiKey({
      name: validation.data.name,
      tenantId: principal.tenantId,
      projectId: validation.data.projectId,
      createdById: principal.userId,
      scopes: validation.data.scopes,
      expiresInDays: validation.data.expiresInDays,
      environment: process.env.NODE_ENV === "production" ? "live" : "test",
    });

    return createdResponse({
      apiKey: result.apiKey,
      rawKey: result.rawKey,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
