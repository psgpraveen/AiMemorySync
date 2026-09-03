import type { IntegrationDefinition } from "../types";

export const cursorIntegration: IntegrationDefinition = {
  id: "cursor",
  name: "Cursor",
  tagline: "AI-Powered Code Editor via Model Context Protocol",
  description:
    "Seamlessly inject project-wide memories into Cursor Composer and Chat using the universal AiMemorySync MCP server.",
  category: "IDE",
  status: "coming_soon",
  installationType: "mcp",
  icon: "cursor",
  badge: "Phase 6 Roadmap",
  features: [
    "MCP-compatible tool injection into Cursor Composer",
    "Persistent codebase conventions without reprompting",
    "Single-click .cursor/mcp.json integration",
  ],
  steps: [
    {
      id: "preview",
      stepNumber: 1,
      title: "Planned for Phase 6",
      description: "Direct Cursor integration will launch following the Antigravity pilot.",
    },
  ],
};
