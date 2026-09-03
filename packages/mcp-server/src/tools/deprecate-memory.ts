import { z } from "zod";
import type { AiMemoryClient } from "@aimemory/client-core";
import type { McpLogger } from "../security/logger.js";

export const deprecateMemorySchema = {
  memoryId: z.string().describe("UUID of the memory item to soft-deprecate."),
};

export function registerDeprecateMemoryTool(
  server: any,
  client: AiMemoryClient,
  logger: McpLogger
) {
  server.registerTool(
    "aimemory_deprecate_memory",
    {
      description:
        "Soft-deprecates an outdated or superseded memory. Deprecated memories are excluded from active AI context while retaining historical audit records.",
      inputSchema: deprecateMemorySchema,
    },
    async (args: any) => {
      logger.info(`Deprecating memory ${args.memoryId}`);

      try {
        const deprecated = await client.memories.deprecate(args.memoryId);
        logger.info(`Memory deprecated: "${deprecated.title}" (${deprecated.id})`);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  status: "DEPRECATED",
                  id: deprecated.id,
                  projectId: deprecated.projectId,
                  title: deprecated.title,
                  memoryStatus: deprecated.status,
                  message: `Memory '${deprecated.title}' marked as DEPRECATED. It is now excluded from active context assembly.`,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err: any) {
        logger.error(`Failed to deprecate memory ${args.memoryId}`, err);
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Memory deprecation error: ${err.message}`,
            },
          ],
        };
      }
    }
  );
}
