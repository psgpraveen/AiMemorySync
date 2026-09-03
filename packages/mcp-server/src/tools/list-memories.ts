import { z } from "zod";
import type { AiMemoryClient, MemoryType, MemoryPriority } from "@aimemory/client-core";
import type { McpSessionManager } from "../session.js";
import type { McpLogger } from "../security/logger.js";

export const listMemoriesSchema = {
  projectId: z
    .string()
    .optional()
    .describe("Optional project UUID. Defaults to currently resolved session project."),
  status: z
    .enum(["ACTIVE", "ARCHIVED", "DEPRECATED"])
    .optional()
    .describe("Filter by memory status (default: 'ACTIVE')."),
  type: z
    .enum(["DECISION", "REQUIREMENT", "CONVENTION", "BUG_SOLUTION"])
    .optional()
    .describe("Filter by memory type."),
  priority: z
    .enum(["LOW", "NORMAL", "HIGH", "CRITICAL"])
    .optional()
    .describe("Filter by memory priority."),
};

export function registerListMemoriesTool(
  server: any,
  client: AiMemoryClient,
  session: McpSessionManager,
  logger: McpLogger
) {
  server.registerTool(
    "aimemory_list_memories",
    {
      description:
        "Lists individual memory items belonging to a project. Use this tool when you need to inspect, edit, or check specific existing memories.",
      inputSchema: listMemoriesSchema,
    },
    async (args: any) => {
      const targetProjectId = args.projectId || session.getCurrentProject()?.id;

      if (!targetProjectId) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: "No active project specified or resolved. Pass 'projectId' or invoke 'aimemory_resolve_project' first.",
            },
          ],
        };
      }

      logger.info(`Listing memories for project ${targetProjectId}`, {
        status: args.status,
        type: args.type,
        priority: args.priority,
      });

      try {
        const memories = await client.memories.list(targetProjectId, {
          status: args.status,
          type: args.type as MemoryType | undefined,
          priority: args.priority as MemoryPriority | undefined,
        });

        logger.info(`Retrieved ${memories.length} memories`);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                memories.map((m) => ({
                  id: m.id,
                  type: m.type,
                  title: m.title,
                  content: m.content,
                  priority: m.priority,
                  status: m.status,
                  createdAt: m.createdAt,
                  updatedAt: m.updatedAt,
                })),
                null,
                2
              ),
            },
          ],
        };
      } catch (err: any) {
        logger.error("Failed to list memories", err);
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `List memories error: ${err.message}`,
            },
          ],
        };
      }
    }
  );
}
