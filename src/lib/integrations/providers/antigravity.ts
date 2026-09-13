import type { IntegrationDefinition } from "../types";
import { API_ENDPOINTS } from "@/lib/api/endpoints";

export const antigravityIntegration: IntegrationDefinition = {
  id: "antigravity",
  name: "Antigravity",
  tagline: "Native IDE Extension & Automatic Memory Synchronization",
  description:
    "Connect Antigravity to your AiMemorySync workspace using the native IDE extension (.vsix). Automatically resolves your workspace, streams project memories, and synchronizes persistent architectural context directly into agent sessions.",
  category: "AI_AGENT",
  status: "available",
  installationType: "extension",
  icon: "antigravity",
  badge: "VSIX Available",
  setupRoute: "/integrations/antigravity/setup",
  documentationUrl: "https://modelcontextprotocol.io",
  features: [
    "Native Antigravity / VS Code VSIX extension with zero build dependencies",
    "OS-backed SecretStorage for tenant API keys",
    "Dedicated tree views for Project Identity, Memories, and Context Budgets",
    "7-state real-time Status Bar indicator for live workspace sync",
    "Automatic workspace Git & package manifest identity resolution",
    "1-Click context clipboard copy & Markdown preview for AI prompts",
  ],
  steps: [
    {
      id: "requirements",
      stepNumber: 1,
      title: "Prerequisites Check",
      description:
        "Ensure you have Antigravity installed on your machine and an active AiMemorySync account.",
      tips: [
        "Antigravity is fully compatible with standard VSIX extension packages.",
        "Your AiMemorySync server must be accessible (e.g. http://13.206.58.90:3005).",
      ],
    },
    {
      id: "api-key",
      stepNumber: 2,
      title: "Generate Tenant API Key",
      description:
        "Generate a secret machine API key with read and write permissions from your dashboard.",
      actionButton: {
        label: "Manage API Keys",
        href: "/settings/api-keys",
        actionType: "navigate",
      },
      tips: [
        "Keys are managed securely in Settings > API Keys.",
        "Use a dedicated key with 'read' and 'write' scopes.",
      ],
    },
    {
      id: "install-extension",
      stepNumber: 3,
      title: "Download & Install VSIX Extension",
      description:
        "Download the pre-built VSIX extension package and install it directly into Antigravity.",
      actionButton: {
        label: "Download Extension (v0.1.2 .vsix)",
        href: "/api/integrations/vscode/download",
        actionType: "download",
      },
      codeSnippet: {
        language: "bash",
        code: "code --install-extension aimemory-vscode-0.1.2.vsix",
        filename: "terminal",
      },
      tips: [
        "In Antigravity: Open Extensions panel (Ctrl+Shift+X) -> click '...' menu -> 'Install from VSIX...'",
        "Select the downloaded aimemory-vscode-0.1.2.vsix file to install instantly.",
      ],
    },
    {
      id: "configure-antigravity",
      stepNumber: 4,
      title: "Connect Extension to Live Backend",
      description:
        "Configure your API key and server URL inside Antigravity.",
      codeSnippet: {
        language: "text",
        code: `1. Press Ctrl+Shift+P in Antigravity
2. Run: "AiMemory: Connect / Set API Key"
3. Paste your generated secret API key
4. In Settings (Ctrl+,), set "aimemory.apiUrl" to: http://13.206.58.90:3005`,
        filename: "Antigravity Setup",
      },
    },
    {
      id: "install-skills",
      stepNumber: 5,
      title: "Optional: Download Agent Rules & Skills",
      description:
        "Optional: Unpack the official generic plugin package into your workspace's .agents/ directory for agent guardrails.",
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
        "Execute a full-chain verification test to confirm your API key is authentic and connected to the backend.",
      actionButton: {
        label: "Run Full Connection Test",
        actionType: "verify",
      },
    },
  ],
};
