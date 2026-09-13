/**
 * Canonical identifier for the default/legacy migration workspace.
 * Used during Phase 6B.1 database foundation to preserve full backward
 * compatibility for existing projects, API keys, and machine integrations
 * before full multi-tenant context enforcement is implemented in Phase 6B.2+.
 */
export const DEFAULT_LEGACY_TENANT_ID = "00000000-0000-0000-0000-000000000001";
export const DEFAULT_LEGACY_TENANT_NAME = "Legacy Workspace";
export const DEFAULT_LEGACY_TENANT_SLUG = "legacy-workspace";
