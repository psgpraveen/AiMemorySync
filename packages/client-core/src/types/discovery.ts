import type { ProjectDto } from "./project.js";

export type ProjectIdentityType =
  | "GIT_REMOTE"
  | "MONOREPO_SUBPROJECT"
  | "PACKAGE_MANIFEST"
  | "WORKSPACE_DIGEST"
  | "PLATFORM_SESSION";

/**
 * Package manifest identity signal.
 */
export interface PackageManifestSignal {
  ecosystem: string;
  name: string;
}

/**
 * Identity discovery signals provided by client IDEs or platform integrations.
 */
export interface DiscoverySignals {
  gitRemoteUrl?: string;
  monorepoSubPath?: string;
  packageManifest?: PackageManifestSignal;
  workspaceName?: string;
  localPath?: string;
}

/**
 * Platform and client environment source metadata.
 */
export interface DiscoverySource {
  platform: string;
  externalId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Request payload for POST /api/projects/resolve.
 */
export interface ResolveProjectInput {
  signals: DiscoverySignals;
  source: DiscoverySource;
}

/**
 * Response payload returned from POST /api/projects/resolve.
 */
export interface ResolveProjectResult {
  project: ProjectDto;
  matchedBy: ProjectIdentityType;
  canonicalIdentity: string;
  confidence: number;
  isNewlyCreated: boolean;
}
