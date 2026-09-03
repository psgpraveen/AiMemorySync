import { NextRequest } from "next/server";
import { generateApiKey } from "@/services/auth.service";
import { createdResponse, parseJsonBody } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import { ValidationError } from "@/lib/errors";
import { z } from "zod";

const signupSchema = z.object({
  workspaceName: z.string().min(2, "Workspace name must be at least 2 characters").max(100).trim(),
  primaryPlatform: z.string().optional(),
});

/**
 * POST /api/auth/signup
 * Provisions a fresh developer workspace with an initial Bearer API key.
 */
export async function POST(request: NextRequest) {
  try {
    const rawBody = await parseJsonBody<Record<string, unknown>>(request);
    const validation = signupSchema.safeParse(rawBody);

    if (!validation.success) {
      throw new ValidationError("Invalid signup information", validation.error.flatten());
    }

    const { workspaceName, primaryPlatform } = validation.data;

    const result = await generateApiKey({
      name: `${workspaceName} (${primaryPlatform || "Universal"})`,
      scopes: ["read", "write", "admin"],
      environment: process.env.NODE_ENV === "production" ? "live" : "test",
    });

    return createdResponse({
      message: "Workspace created successfully",
      apiKey: result.apiKey,
      rawKey: result.rawKey,
      workspaceName,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
