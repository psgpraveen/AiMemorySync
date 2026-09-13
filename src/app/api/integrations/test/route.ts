import { NextRequest } from "next/server";
import { validateApiKey } from "@/services/auth.service";
import { successResponse, parseJsonBody } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import fs from "fs";
import path from "path";

export async function POST(request: NextRequest) {
  try {
    const rawBody = await parseJsonBody<{ integration?: string; apiKey?: string }>(request);
    const integration = rawBody.integration || "antigravity";

    // 1. Determine API key to test: explicitly supplied in body or Bearer token header
    const authHeader = request.headers.get("authorization") || "";
    const headerToken = authHeader.startsWith("Bearer ")
      ? authHeader.substring(7).trim()
      : authHeader.trim();

    const targetKey = rawBody.apiKey?.trim() || headerToken;

    const checks = {
      apiReachable: true,
      apiKeyValid: false,
      scopesValid: false,
      mcpReady: false,
    };

    let details: Record<string, unknown> = {};

    // 2. Validate API Key
    if (targetKey) {
      try {
        const apiKey = await validateApiKey(targetKey);
        checks.apiKeyValid = true;

        // Verify scopes: need read and write for MCP server
        const hasRead = apiKey.scopes.includes("read") || apiKey.scopes.includes("admin");
        const hasWrite = apiKey.scopes.includes("write") || apiKey.scopes.includes("admin");
        checks.scopesValid = hasRead && hasWrite;

        details = {
          keyId: apiKey.id,
          name: apiKey.name,
          prefix: apiKey.prefix,
          last4: apiKey.last4,
          scopes: apiKey.scopes,
          tenantId: apiKey.tenantId,
          projectId: apiKey.projectId ?? undefined,
        };
      } catch (err: unknown) {
        checks.apiKeyValid = false;
        details = { error: err instanceof Error ? err.message : String(err) };
      }
    }

    // 3. Verify Integration Package Readiness
    if (integration === "antigravity" || integration === "vscode") {
      const vsixPath = path.resolve(
        process.cwd(),
        "packages/vscode-extension/releases/aimemory-vscode-0.1.2.vsix"
      );
      checks.mcpReady = fs.existsSync(vsixPath);
    } else if (integration === "cursor") {
      const mcpPath = path.resolve(process.cwd(), "packages/mcp-server/dist/index.js");
      checks.mcpReady = fs.existsSync(mcpPath);
    } else {
      checks.mcpReady = true;
    }

    const allPassed =
      checks.apiReachable && checks.apiKeyValid && checks.scopesValid && checks.mcpReady;

    let message = "Integration connection test succeeded! All checks passed.";
    if (!checks.apiKeyValid) {
      message = "Connection failed: Invalid or revoked API key.";
    } else if (!checks.scopesValid) {
      message = "Connection failed: API key lacks required 'read' and 'write' scopes.";
    } else if (!checks.mcpReady) {
      message = "Connection warning: Integration package binary not found.";
    }

    return successResponse({
      success: allPassed,
      message,
      checks,
      details,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
