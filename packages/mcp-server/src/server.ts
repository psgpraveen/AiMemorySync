import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AiMemoryClient } from "@aimemory/client-core";
import { McpSessionManager } from "./session.js";
import { McpLogger } from "./security/logger.js";
import type { McpServerConfig } from "./types/mcp.js";

import { registerResolveProjectTool } from "./tools/resolve-project.js";
import { registerGetCurrentProjectTool } from "./tools/get-current-project.js";
import { registerGetContextTool } from "./tools/get-context.js";
import { registerListMemoriesTool } from "./tools/list-memories.js";
import { registerCreateMemoryTool } from "./tools/create-memory.js";
import { registerUpdateMemoryTool } from "./tools/update-memory.js";
import { registerDeprecateMemoryTool } from "./tools/deprecate-memory.js";
import { registerArchiveMemoryTool } from "./tools/archive-memory.js";
import { registerProjectContextResource } from "./resources/project-context.js";

export function createMcpServer(
  client: AiMemoryClient,
  config: McpServerConfig,
  session: McpSessionManager = new McpSessionManager(),
  logger: McpLogger = new McpLogger(config.debug)
): { server: McpServer; session: McpSessionManager; logger: McpLogger } {
  const server = new McpServer(
    {
      name: "aimemory-mcp",
      version: "0.1.0",
    },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
    }
  );

  // Register all 8 tools
  registerResolveProjectTool(server, client, session, logger);
  registerGetCurrentProjectTool(server, session, logger);
  registerGetContextTool(server, client, session, logger);
  registerListMemoriesTool(server, client, session, logger);
  registerCreateMemoryTool(server, client, session, logger);
  registerUpdateMemoryTool(server, client, logger);
  registerDeprecateMemoryTool(server, client, logger);
  registerArchiveMemoryTool(server, client, logger);

  // Register dynamic resources
  registerProjectContextResource(server, client, logger);

  return { server, session, logger };
}
