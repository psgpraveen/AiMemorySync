import { z } from "zod";
import type { AiMemoryClient } from "@aimemory/client-core";
import type { McpSessionManager } from "../session.js";
import type { McpLogger } from "../security/logger.js";

export const resolveProjectSchema = {
  workspaceName: z
    .string()
    .optional()
    .describe("Human-readable workspace folder or project name (e.g. 'AiMemorySync')."),
  gitRemoteUrl: z
    .string()
    .optional()
    .describe("Git remote origin URL (e.g. 'https://github.com/owner/repo.git')."),
  monorepoSubPath: z
    .string()
    .optional()
    .describe("Relative subpath within a monorepo (e.g. 'packages/web'). Never pass absolute paths."),
  packageManifest: z
    .object({
      name: z.string().describe("Package name from package manifest."),
      ecosystem: z.string().describe("Package ecosystem, e.g. 'npm', 'cargo', 'pip'."),
    })
    .optional()
    .describe("Package manifest identity signal."),
};

export function registerResolveProjectTool(
  server: any,
  client: AiMemoryClient,
  session: McpSessionManager,
  logger: McpLogger
) {
  server.registerTool(
    "aimemory_resolve_project",
    {
      description:
        "Resolves project identity from workspace discovery signals (Git remote, monorepo subpath, package manifest, or workspace name) and caches it as the active session project. Never provide raw absolute local machine paths (e.g. D:\\... or /home/...).",
      inputSchema: resolveProjectSchema,
    },
    async (args: any) => {
      logger.info("Resolving project with signals", {
        workspaceName: args.workspaceName,
        gitRemote: args.gitRemoteUrl ? "[PROVIDED]" : undefined,
        subpath: args.monorepoSubPath,
        manifest: args.packageManifest?.name,
      });

      // Privacy check: reject raw drive paths if accidentally passed
      if (
        (args.monorepoSubPath && /^[a-zA-Z]:|^\\|^\//.test(args.monorepoSubPath)) ||
        (args.workspaceName && /^[a-zA-Z]:/.test(args.workspaceName))
      ) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: "Invalid input: Absolute local machine paths must never be transmitted. Provide relative subpaths or folder names only.",
            },
          ],
        };
      }

      try {
        const result = await client.projects.resolve({
          signals: {
            workspaceName: args.workspaceName,
            gitRemoteUrl: args.gitRemoteUrl,
            monorepoSubPath: args.monorepoSubPath,
            packageManifest: args.packageManifest,
          },
          source: {
            platform: "MCP",
            metadata: {
              serverVersion: "0.1.0",
            },
          },
        });

        session.setCurrentProject(result.project, result.canonicalIdentity);
        logger.info(`Resolved project: ${result.project.name} (${result.project.id})`);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  status: "RESOLVED",
                  projectId: result.project.id,
                  projectName: result.project.name,
                  canonicalIdentity: result.canonicalIdentity,
                  matchedBy: result.matchedBy,
                  confidence: result.confidence,
                  isNewlyCreated: result.isNewlyCreated,
                  message: `Project '${result.project.name}' successfully resolved and set as active session project.`,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err: any) {
        logger.error("Project resolution failed", err);
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Project resolution error: ${err.message}`,
            },
          ],
        };
      }
    }
  );
}
