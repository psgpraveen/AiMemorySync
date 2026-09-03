import { z } from "zod";
import type { AiMemoryClient, MemoryType } from "@aimemory/client-core";
import type { McpSessionManager } from "../session.js";
import type { McpLogger } from "../security/logger.js";

export const getContextSchema = {
  projectId: z
    .string()
    .optional()
    .describe(
      "Optional project UUID. If omitted, automatically defaults to the currently resolved session project."
    ),
  budget: z
    .number()
    .int()
    .min(1000)
    .max(50000)
    .optional()
    .describe("Character budget for assembled context (default: 8000, min: 1000, max: 50000)."),
  types: z
    .array(z.enum(["DECISION", "REQUIREMENT", "CONVENTION", "BUG_SOLUTION"]))
    .optional()
    .describe("Optional memory types to include in context. If omitted, includes all types."),
};

export function registerGetContextTool(
  server: any,
  client: AiMemoryClient,
  session: McpSessionManager,
  logger: McpLogger
) {
  server.registerTool(
    "aimemory_get_context",
    {
      description:
        "Retrieves token/character-budgeted Markdown AI context for the active project. Formatted with clean category headers (Decisions, Requirements, Conventions, Known Bug Solutions). Does not expose internal UUIDs or database hashes. Call this tool when beginning a task or reasoning about project architecture.",
      inputSchema: getContextSchema,
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

      const budget = args.budget ?? 8000;
      logger.info(`Fetching context for project ${targetProjectId} (budget: ${budget})`);

      try {
        const result = await client.context.get(targetProjectId, {
          budget,
          types: args.types as MemoryType[] | undefined,
        });

        const tokenEst = Math.round(result.markdown.length / 4);
        logger.info(
          `Context retrieved: ${result.markdown.length} chars (~${tokenEst} tokens), ${result.budget.itemCount} memories`
        );

        return {
          content: [
            {
              type: "text",
              text: result.markdown,
            },
          ],
        };
      } catch (err: any) {
        logger.error("Failed to assemble context", err);
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Context retrieval error: ${err.message}`,
            },
          ],
        };
      }
    }
  );
}
