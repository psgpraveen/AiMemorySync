import { handleApiError } from "@/lib/api/error-handler";
import { ForbiddenError } from "@/lib/errors";

/**
 * POST /api/auth/bootstrap
 * Permanently disabled for all tenants.
 */
export async function POST() {
  try {
    throw new ForbiddenError("Bootstrap key generation is permanently disabled.");
  } catch (error) {
    return handleApiError(error);
  }
}

