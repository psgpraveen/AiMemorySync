import { z } from "zod";
import type { AiMemoryClient, MemoryType, MemoryPriority } from "@aimemory/client-core";
import type { McpLogger } from "../security/logger.js";

export const updateMemorySchema = {
  memoryId: z.string().describe("UUID of the memory item to update."),
  title: z.string().min(1).max(200).optional().describe("Updated title."),
  content: z.string().min(1).max(10000).optional().describe("Updated content."),
  priority: z
    .enum(["LOW", "NORMAL", "HIGH", "CRITICAL"])
    .optional()
    .describe("Updated priority level."),
  type: z
    .enum(["DECISION", "REQUIREMENT", "CONVENTION", "BUG_SOLUTION"])
    .optional()
    .describe("Updated category type."),
};

export function registerUpdateMemoryTool(
  server: any,
  client: AiMemoryClient,
  logger: McpLogger
) {
  server.registerTool(
    "aimemory_update_memory",
    {
      description: "Updates an existing memory item's title, content, priority, or category type.",
      inputSchema: updateMemorySchema,
    },
    async (args: any) => {
      // Secret check
      const combined = `${args.title ?? ""} ${args.content ?? ""}`;
      if (
        /aimem_(?:live|test)_[a-zA-Z0-9_-]{16,}/.test(combined) ||
        /(?:ghp_|sk-[a-zA-Z0-9]{20,}|Bearer\s+[a-zA-Z0-9_.-]{20,})/.test(combined)
      ) {
        logger.warn("Blocked attempt to update memory with credential patterns");
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: "Security Violation: Update rejected. Detected credential or token pattern.",
            },
          ],
        };
      }

      logger.info(`Updating memory ${args.memoryId}`);

      try {
        const updated = await client.memories.update(args.memoryId, {
          title: args.title,
          content: args.content,
          priority: args.priority as MemoryPriority | undefined,
          type: args.type as MemoryType | undefined,
        });

        logger.info(`Memory updated: "${updated.title}" (${updated.id})`);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  status: "UPDATED",
                  id: updated.id,
                  projectId: updated.projectId,
                  title: updated.title,
                  priority: updated.priority,
                  type: updated.type,
                  updatedAt: updated.updatedAt,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err: any) {
        logger.error(`Failed to update memory ${args.memoryId}`, err);
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Memory update error: ${err.message}`,
            },
          ],
        };
      }
    }
  );
}
