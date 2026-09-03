import { z } from "zod";
import type { AiMemoryClient, MemoryType, MemoryPriority } from "@aimemory/client-core";
import type { McpSessionManager } from "../session.js";
import type { McpLogger } from "../security/logger.js";

export const createMemorySchema = {
  projectId: z
    .string()
    .optional()
    .describe("Optional project UUID. Defaults to currently resolved session project."),
  type: z
    .enum(["DECISION", "REQUIREMENT", "CONVENTION", "BUG_SOLUTION"])
    .describe(
      "Category of memory: 'DECISION' (architectural choices), 'CONVENTION' (coding standards & rules), 'REQUIREMENT' (product/functional specifications), 'BUG_SOLUTION' (non-obvious bug fixes)."
    ),
  title: z
    .string()
    .min(1)
    .max(200)
    .describe("Concise, human-readable summary of the memory (e.g. 'Use client-core for all integrations')."),
  content: z
    .string()
    .min(1)
    .max(10000)
    .describe(
      "Detailed explanation of the rule, architectural rationale, or solution. NEVER include secrets, API keys, credentials, or private personal data."
    ),
  priority: z
    .enum(["LOW", "NORMAL", "HIGH", "CRITICAL"])
    .optional()
    .describe("Priority rank (default: 'NORMAL'). Reserve 'CRITICAL' strictly for major architectural or security pillars."),
};

export function registerCreateMemoryTool(
  server: any,
  client: AiMemoryClient,
  session: McpSessionManager,
  logger: McpLogger
) {
  server.registerTool(
    "aimemory_create_memory",
    {
      description:
        "Explicitly creates a persistent project memory. Use this tool ONLY for verified architectural decisions, project conventions, or non-obvious bug solutions that must survive across future AI sessions. CRITICAL SAFETY: Never store API keys, tokens, credentials, temporary debugging notes, or conversational chat.",
      inputSchema: createMemorySchema,
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

      // Pre-flight anti-poisoning guardrail: scan title & content for secrets
      const combined = `${args.title} ${args.content}`;
      if (
        /aimem_(?:live|test)_[a-zA-Z0-9_-]{16,}/.test(combined) ||
        /(?:ghp_|sk-[a-zA-Z0-9]{20,}|Bearer\s+[a-zA-Z0-9_.-]{20,})/.test(combined)
      ) {
        logger.warn("Blocked attempt to save memory containing credential patterns");
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: "Security Violation: Memory creation rejected. Detected potential API key, bearer token, or secret in title or content. Secrets must never be stored in persistent memory.",
            },
          ],
        };
      }

      logger.info(`Creating memory for project ${targetProjectId}`, {
        type: args.type,
        title: args.title,
        priority: args.priority,
      });

      try {
        const memory = await client.memories.create(targetProjectId, {
          type: args.type as MemoryType,
          title: args.title,
          content: args.content,
          priority: (args.priority as MemoryPriority) ?? "NORMAL",
        });

        logger.info(`Memory created: "${memory.title}" (${memory.id})`);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  status: "CREATED",
                  id: memory.id,
                  projectId: memory.projectId,
                  type: memory.type,
                  title: memory.title,
                  priority: memory.priority,
                  message: `Memory '${memory.title}' successfully stored. It will automatically influence future AI sessions.`,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err: any) {
        logger.error("Failed to create memory", err);
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Memory creation error: ${err.message}`,
            },
          ],
        };
      }
    }
  );
}
