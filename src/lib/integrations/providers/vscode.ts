import type { IntegrationDefinition } from "../types";

export const vscodeIntegration: IntegrationDefinition = {
  id: "vscode",
  name: "Visual Studio Code",
  tagline: "Official Native Extension with OS Keychain SecretStorage",
  description:
    "Full-featured IDE extension featuring dedicated tree views for Projects, Memories, and Context Budgets, with real-time status bar telemetry and automatic workspace discovery.",
  category: "IDE",
  status: "available",
  installationType: "extension",
  icon: "vscode",
  badge: "VSIX Available",
  documentationUrl: "https://code.visualstudio.com/api",
  features: [
    "OS-backed SecretStorage (macOS Keychain, Windows Credential Manager, libsecret)",
    "Projects, Memories & Context Budget Tree Views",
    "7-state real-time Status Bar Item",
    "12 native extension commands with instant memory CRUD",
    "Automatic workspace Git & package manifest discovery",
  ],
  steps: [
    {
      id: "install-extension",
      stepNumber: 1,
      title: "Download & Install VSIX Extension",
      description:
        "Download the pre-packaged VSIX installer and install it directly into VS Code or Cursor.",
      actionButton: {
        label: "Download VSIX Extension (v0.1.2)",
        href: "/api/integrations/vscode/download",
        actionType: "download",
      },
      codeSnippet: {
        language: "bash",
        code: "code --install-extension aimemory-vscode-0.1.2.vsix",
        filename: "terminal",
      },
    },
    {
      id: "set-key",
      stepNumber: 2,
      title: "Configure API Key",
      description:
        "Press F1 or Ctrl+Shift+P in VS Code, run 'AiMemory: Set API Key', and paste your secret token.",
    },
  ],
};
