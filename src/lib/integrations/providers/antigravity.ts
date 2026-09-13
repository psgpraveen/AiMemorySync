import type { IntegrationDefinition } from "../types";
import { API_ENDPOINTS } from "@/lib/api/endpoints";

export const antigravityIntegration: IntegrationDefinition = {
  id: "antigravity",
  name: "Antigravity",
  tagline: "Native MCP Plugin with Event-Driven Context Loading",
  description:
    "Connect Antigravity to your AiMemorySync workspace using the Model Context Protocol (MCP). Automatically synchronizes persistent architectural decisions, conventions, and bug solutions directly into agent sessions.",
  category: "AI_AGENT",
  status: "available",
  installationType: "mcp",
  icon: "antigravity",
  badge: "Official Plugin",
  setupRoute: "/integrations/antigravity/setup",
  documentationUrl: "https://modelcontextprotocol.io",
  features: [
    "8 Universal MCP AI Tools (resolve, get context, CRUD memories)",
    "Dynamic Markdown Resource (aimemory://projects/{id}/context)",
    "Strict Stdio Framing & Zero Database Direct Queries",
    "Pre-flight Anti-Poisoning Secret Detection",
    "Multi-session continuity across independent AI chats",
  ],
  steps: [
    {
      id: "requirements",
      stepNumber: 1,
      title: "Prerequisites Check",
      description:
        "Ensure you have Node.js (v18+) and the Antigravity coding environment installed on your local machine.",
      tips: [
        "Node.js 18 or higher is required for stdio process management.",
        "Your AiMemorySync server must be accessible (e.g. http://localhost:3000).",
      ],
    },
    {
      id: "api-key",
      stepNumber: 2,
      title: "Select or Generate API Key",
      description:
        "The Antigravity MCP server requires a scoped secret API key (read and write permissions) to interact with your projects.",
      tips: [
        "Never commit your API key to public repositories.",
        "Use a dedicated key with 'read' and 'write' scopes.",
      ],
    },
    {
      id: "install-mcp",
      stepNumber: 3,
      title: "Install or Build MCP Server",
      description:
        "Build the universal MCP server package inside your local monorepo or install globally.",
      codeSnippet: {
        language: "bash",
        code: "npm run build:mcp",
        filename: "terminal",
      },
      tips: [
        "The compiled binary resides at packages/mcp-server/dist/index.js",
        "It communicates purely over stdio with process.stdout reserved for JSON-RPC.",
      ],
    },
    {
      id: "configure-antigravity",
      stepNumber: 4,
      title: "Configure Antigravity MCP Server",
      description:
        "Add the AiMemorySync server to your workspace's .agents/plugins/aimemory/mcp_config.json file.",
      codeSnippet: {
        language: "json",
        code: `{
  "mcpServers": {
    "aimemory": {
      "command": "node",
      "args": ["packages/mcp-server/dist/index.js"],
      "env": {
        "AIMEMORY_API_URL": "http://localhost:3000",
        "AIMEMORY_API_KEY": "PASTE_YOUR_API_KEY_HERE"
      }
    }
  }
}`,
        filename: ".agents/plugins/aimemory/mcp_config.json",
      },
    },
    {
      id: "install-skills",
      stepNumber: 5,
      title: "Download AiMemory Skills & Rules",
      description:
        "Download and unpack the official generic plugin package into your workspace's .agents/ directory.",
      actionButton: {
        label: "Download Plugin Package (.zip)",
        href: API_ENDPOINTS.INTEGRATIONS.DOWNLOAD("antigravity"),
        actionType: "download",
      },
      tips: [
        "Includes aimemory-context: Selective context loading on substantial tasks.",
        "Includes aimemory-capture: Explicit memory capture for verified decisions.",
        "Includes aimemory-guardrails.md: Security constraints and anti-poisoning.",
      ],
    },
    {
      id: "verify",
      stepNumber: 6,
      title: "Verify Live Connection",
      description:
        "Execute a full-chain verification test to confirm your API key is valid and the MCP server responds correctly.",
      actionButton: {
        label: "Run Full Connection Test",
        actionType: "verify",
      },
    },
  ],
};
