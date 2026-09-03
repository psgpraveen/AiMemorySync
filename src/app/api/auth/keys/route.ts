import { NextRequest } from "next/server";
import { generateApiKey, listApiKeys } from "@/services/auth.service";
import { successResponse, createdResponse, parseJsonBody } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import { requireAuth } from "@/lib/api/auth-guard";
import { z } from "zod";
import { ValidationError } from "@/lib/errors";

const createKeySchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long").trim(),
  scopes: z.array(z.string().trim()).optional(),
  expiresInDays: z.number().int().positive().optional(),
});

/**
 * GET /api/auth/keys
 * Lists all registered API keys. Requires admin scope.
 */
export async function GET(request: NextRequest) {
  try {
    await requireAuth(request, { requiredScope: "admin" });
    const keys = await listApiKeys();
    return successResponse(keys);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/auth/keys
 * Generates a new API key. Returns plaintext token once. Requires admin scope.
 */
export async function POST(request: NextRequest) {
  try {
    await requireAuth(request, { requiredScope: "admin" });

    const rawBody = await parseJsonBody<Record<string, unknown>>(request);
    const validation = createKeySchema.safeParse(rawBody);

    if (!validation.success) {
      throw new ValidationError("Invalid API key creation payload", validation.error.flatten());
    }

    const result = await generateApiKey({
      name: validation.data.name,
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
