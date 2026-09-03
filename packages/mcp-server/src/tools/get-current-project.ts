import type { McpSessionManager } from "../session.js";
import type { McpLogger } from "../security/logger.js";

export function registerGetCurrentProjectTool(
  server: any,
  session: McpSessionManager,
  logger: McpLogger
) {
  server.registerTool(
    "aimemory_get_current_project",
    {
      description:
        "Inspects the currently active project resolved in this MCP session. Allows the AI model to verify the current workspace identity without re-resolving signals.",
      inputSchema: {},
    },
    async () => {
      const current = session.getCurrentProject();

      if (!current) {
        logger.info("Current project requested: none resolved yet");
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  status: "NOT_RESOLVED",
                  message:
                    "No project has been resolved yet in this session. Invoke 'aimemory_resolve_project' with workspace discovery signals first.",
                },
                null,
                2
              ),
            },
          ],
        };
      }

      logger.info(`Current project requested: ${current.name} (${current.id})`);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                status: "RESOLVED",
                projectId: current.id,
                projectName: current.name,
                slug: current.slug,
                canonicalIdentity: session.getCanonicalIdentity(),
                resolvedAt: session.getResolvedAt()?.toISOString(),
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );
}
