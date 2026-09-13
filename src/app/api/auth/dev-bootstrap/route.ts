import { NextRequest } from "next/server";
import { handleApiError } from "@/lib/api/error-handler";
import { ForbiddenError } from "@/lib/errors";


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
  } catch (error) {
    return handleApiError(error);
  }
}

