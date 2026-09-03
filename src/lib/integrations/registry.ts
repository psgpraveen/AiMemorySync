import type { IntegrationDefinition, IntegrationCategory } from "./types";
import { antigravityIntegration } from "./providers/antigravity";
import { vscodeIntegration } from "./providers/vscode";
import { cursorIntegration } from "./providers/cursor";
import { claudeIntegration } from "./providers/claude";
import { chatgptIntegration } from "./providers/chatgpt";

const INTEGRATIONS_REGISTRY: Record<string, IntegrationDefinition> = {
  antigravity: antigravityIntegration,
  vscode: vscodeIntegration,
  cursor: cursorIntegration,
  claude: claudeIntegration,
  chatgpt: chatgptIntegration,
};

export function getAllIntegrations(): IntegrationDefinition[] {
  return Object.values(INTEGRATIONS_REGISTRY);
}

export function getIntegrationById(id: string): IntegrationDefinition | undefined {
  return INTEGRATIONS_REGISTRY[id.toLowerCase()];
}

export function getIntegrationsByCategory(category: IntegrationCategory): IntegrationDefinition[] {
  return getAllIntegrations().filter((item) => item.category === category);
}
