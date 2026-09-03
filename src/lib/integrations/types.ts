export type IntegrationCategory = "IDE" | "AI_AGENT" | "CHAT" | "CLI";

export type IntegrationStatus = "available" | "beta" | "coming_soon";

export type InstallationType = "mcp" | "extension" | "plugin" | "api";

export interface InstallationStep {
  id: string;
  stepNumber: number;
  title: string;
  description: string;
  codeSnippet?: {
    language: string;
    code: string;
    filename?: string;
  };
  actionButton?: {
    label: string;
    href?: string;
    actionType?: "copy" | "download" | "verify" | "navigate";
  };
  tips?: string[];
}

export interface IntegrationDefinition {
  id: string;
  name: string;
  tagline: string;
  description: string;
  category: IntegrationCategory;
  status: IntegrationStatus;
  installationType: InstallationType;
  icon: string;
  badge?: string;
  documentationUrl?: string;
  setupRoute?: string;
  features: string[];
  steps: InstallationStep[];
}
