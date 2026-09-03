/**
 * All stable identifiers for commands, views, configuration keys, and storage keys.
 *
 * SECURITY: API keys are NEVER stored as configuration properties.
 * The only storage key for credentials is SECRETS.API_KEY which maps to
 * VS Code's OS-backed ExtensionContext.secrets (SecretStorage).
 */

// -----------------------------------------------------------------
// Command IDs (must match package.json contributes.commands)
// -----------------------------------------------------------------
export const COMMANDS = {
  SET_API_KEY: "aimemory.setApiKey",
  REMOVE_API_KEY: "aimemory.removeApiKey",
  CHECK_CONNECTION: "aimemory.checkConnection",
  RESOLVE_PROJECT: "aimemory.resolveProject",
  COPY_CONTEXT: "aimemory.copyContext",
  PREVIEW_CONTEXT: "aimemory.previewContext",
  ADD_MEMORY: "aimemory.addMemory",
  EDIT_MEMORY: "aimemory.editMemory",
  DEPRECATE_MEMORY: "aimemory.deprecateMemory",
  ARCHIVE_MEMORY: "aimemory.archiveMemory",
  REFRESH_ALL: "aimemory.refreshAll",
  OPEN_DASHBOARD: "aimemory.openDashboard",
} as const;

// -----------------------------------------------------------------
// View IDs (must match package.json contributes.views)
// -----------------------------------------------------------------
export const VIEWS = {
  PROJECTS: "aimemory-projects",
  MEMORIES: "aimemory-memories",
  CONTEXT: "aimemory-context",
} as const;

// -----------------------------------------------------------------
// Configuration keys (must match package.json contributes.configuration)
// NOTE: There is intentionally NO config key for API keys. Use SecretStorage.
// -----------------------------------------------------------------
export const CONFIG = {
  API_URL: "aimemory.apiUrl",
  AUTO_RESOLVE: "aimemory.autoResolve",
  CONTEXT_BUDGET: "aimemory.contextBudget",
  ENABLE_STATUS_BAR: "aimemory.enableStatusBar",
  LOG_LEVEL: "aimemory.logLevel",
} as const;

// -----------------------------------------------------------------
// SecretStorage keys (maps to OS-backed keychain via ExtensionContext.secrets)
// -----------------------------------------------------------------
export const SECRETS = {
  /** API key for authenticating with AiMemorySync backend. NEVER put this in settings.json. */
  API_KEY: "aimemory.apiKey",
} as const;

// -----------------------------------------------------------------
// Output channel name
// -----------------------------------------------------------------
export const OUTPUT_CHANNEL_NAME = "AiMemorySync";

// -----------------------------------------------------------------
// Workspace debounce config
// -----------------------------------------------------------------
export const WORKSPACE_DEBOUNCE_MS = 400;

// -----------------------------------------------------------------
// Platform identifier sent with project resolution signals
// -----------------------------------------------------------------
export const PLATFORM_ID = "VSCODE";

// -----------------------------------------------------------------
// Extension version — keep in sync with package.json
// -----------------------------------------------------------------
export const EXTENSION_VERSION = "0.1.0";
