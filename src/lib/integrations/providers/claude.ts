import type { IntegrationDefinition } from "../types";

export const claudeIntegration: IntegrationDefinition = {
  id: "claude",
  name: "Claude Desktop",
  tagline: "Desktop AI Assistant with MCP Architecture Context",
  description:
    "Enable Claude Desktop to read and maintain persistent architecture decisions across chat conversations using MCP stdio.",
  category: "CHAT",
  status: "coming_soon",
  installationType: "mcp",
  icon: "claude",
  badge: "Roadmap",
  features: [
    "Connects via claude_desktop_config.json",
    "Queries project context during architecture reviews",
    "Stores design decisions directly into AiMemorySync",
  ],
  steps: [
    {
      id: "preview",
      stepNumber: 1,
      title: "Planned MCP Client",
      description: "Direct Claude Desktop support via universal MCP server.",
    },
  ],
};
