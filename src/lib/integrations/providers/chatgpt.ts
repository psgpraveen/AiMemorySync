import type { IntegrationDefinition } from "../types";

export const chatgptIntegration: IntegrationDefinition = {
  id: "chatgpt",
  name: "ChatGPT",
  tagline: "Custom GPT with Secure REST Actions & Context Sync",
  description:
    "Equip custom GPTs and ChatGPT Team workspaces with persistent project memory via OpenAPI Actions and client-core transport.",
  category: "CHAT",
  status: "coming_soon",
  installationType: "api",
  icon: "chatgpt",
  badge: "Roadmap",
  features: [
    "OpenAPI Schema integration for Custom GPT Actions",
    "Bearer token authentication per workspace",
    "Cross-platform memory synchronization",
  ],
  steps: [
    {
      id: "preview",
      stepNumber: 1,
      title: "Planned Action Integration",
      description: "Custom GPT Action integration via OpenAPI specification.",
    },
  ],
};
