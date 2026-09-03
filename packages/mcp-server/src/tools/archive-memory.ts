import { z } from "zod";
import type { AiMemoryClient } from "@aimemory/client-core";
import type { McpLogger } from "../security/logger.js";

export const archiveMemorySchema = {
  memoryId: z.string().describe("UUID of the memory item to soft-archive."),
};

export function registerArchiveMemoryTool(
  server: any,
  client: AiMemoryClient,
  logger: McpLogger
) {
  server.registerTool(
    "aimemory_archive_memory",
    {
      description: "Soft-archives a memory item, removing it from active queries.",
      inputSchema: archiveMemorySchema,
    },
    async (args: any) => {
      logger.info(`Archiving memory ${args.memoryId}`);

      try {
        const archived = await client.memories.archive(args.memoryId);
        logger.info(`Memory archived: "${archived.title}" (${archived.id})`);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  status: "ARCHIVED",
                  id: archived.id,
                  projectId: archived.projectId,
                  title: archived.title,
                  memoryStatus: archived.status,
                  message: `Memory '${archived.title}' successfully archived.`,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err: any) {
        logger.error(`Failed to archive memory ${args.memoryId}`, err);
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Memory archive error: ${err.message}`,
            },
          ],
        };
      }
    }
  );
}
