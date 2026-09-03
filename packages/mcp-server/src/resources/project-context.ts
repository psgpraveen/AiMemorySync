import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AiMemoryClient } from "@aimemory/client-core";
import type { McpLogger } from "../security/logger.js";

export function registerProjectContextResource(
  server: any,
  client: AiMemoryClient,
  logger: McpLogger
) {
  server.registerResource(
    "project-context",
    new ResourceTemplate("aimemory://projects/{id}/context", { list: undefined }),
    {
      description: "Assembled project memory context in Markdown format.",
      mimeType: "text/markdown",
    },
    async (uri: any, variables: any) => {
      const projectId = variables.id;
      logger.info(`Resource read requested: ${uri.href} for project ${projectId}`);

      try {
        const result = await client.context.get(projectId);
        return {
          contents: [
            {
              uri: uri.href,
              text: result.markdown,
              mimeType: "text/markdown",
            },
          ],
        };
      } catch (err: any) {
        logger.error(`Resource read failed for project ${projectId}`, err);
        return {
          contents: [
            {
              uri: uri.href,
              text: `# Error\n\nFailed to load context for project '${projectId}': ${err.message}`,
              mimeType: "text/markdown",
            },
          ],
        };
      }
    }
  );
}
