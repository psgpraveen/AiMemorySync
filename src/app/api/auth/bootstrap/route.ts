import { generateApiKey } from "@/services/auth.service";
import { successResponse } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import { ForbiddenError } from "@/lib/errors";

/**
 * POST /api/auth/bootstrap
 * In development mode only, allows one-click bootstrap generation of a local developer API key.
 */
export async function POST() {
  try {
    throw new ForbiddenError("Bootstrap key generation is permanently disabled.");

    const result = await generateApiKey({
      name: `Local Developer Key (${new Date().toLocaleDateString()})`,
      scopes: ["read", "write", "admin"],
      environment: "live",
    });

    return successResponse({
      message: "Development key generated successfully",
      apiKey: result.apiKey,
      rawKey: result.rawKey,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
