import { NextRequest } from "next/server";
import { deprecateMemory } from "@/services/memory.service";
import { successResponse } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import { requireAuth } from "@/lib/api/auth-guard";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/memories/:id/deprecate
 * Soft-deprecates a memory record by transitioning status to DEPRECATED.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    await requireAuth(request, { requiredScope: "write" });

    const { id } = await params;
    const deprecated = await deprecateMemory(id);

    return successResponse(deprecated);
  } catch (error) {
    return handleApiError(error);
  }
}

