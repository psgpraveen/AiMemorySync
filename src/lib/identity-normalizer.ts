import crypto from "crypto";

/**
 * Normalizes a Git remote URL into a deterministic canonical repository identifier.
 *
 * Supports:
 * - HTTPS (e.g., https://github.com/org/repo.git)
 * - SSH (e.g., git@github.com:org/repo.git)
 * - Custom SSH schemes with ports (e.g., ssh://git@gitlab.company.com:2222/org/repo.git)
 * - Credential/Token-embedded URLs (e.g., https://oauth2:ghp_secret@github.com/org/repo.git)
 * - Self-hosted domains and nested GitLab subgroups (e.g., gitlab.company.com/group/subgroup/repo)
 *
 * Rules:
 * 1. Strips user credentials and access tokens.
 * 2. Strips protocol prefixes (https://, http://, ssh://, git://).
 * 3. Converts SCP-style SSH syntax (git@host:owner/repo) to host/owner/repo.
 * 4. Strips port numbers (:2222/).
 * 5. Strips trailing '.git' suffix and trailing slashes.
 * 6. Lowercases hostname and repository path.
 * 7. Standardizes internal path separators to single forward slashes.
 *
 * @param rawUrl Raw Git remote URL string.
 * @returns Canonical repository string (e.g., "github.com/org/repo") or empty string if invalid.
 */
export function normalizeGitRemote(rawUrl: string): string {
  if (!rawUrl || typeof rawUrl !== "string") return "";

  let cleaned = rawUrl.trim();
  if (!cleaned) return "";

  // 1. Strip embedded basic-auth / token credentials: https://user:pass@host/repo -> https://host/repo
  cleaned = cleaned.replace(/^(https?|ssh|git):\/\/[^/@]+@/i, "$1://");

  // 2. Strip standard protocol prefixes
  cleaned = cleaned.replace(/^(https?|ssh|git):\/\//i, "");

  // 3. Convert SCP-style SSH syntax: git@host:owner/repo -> host/owner/repo
  cleaned = cleaned.replace(/^[^/@]+@([^:/]+):/i, "$1/");

  // 4. Strip custom port numbers: host:2222/owner/repo -> host/owner/repo
  cleaned = cleaned.replace(/^([^/:]+):\d+\//, "$1/");

  // 5. Strip any leftover user@ prefix from host: user@host/owner/repo -> host/owner/repo
  cleaned = cleaned.replace(/^[^/@]+@/i, "");

  // 6. Strip trailing '.git' suffix and trailing slashes
  cleaned = cleaned.replace(/\.git\/?$/i, "");
  cleaned = cleaned.replace(/\/+$/, "");

  // 7. Collapse multiple consecutive slashes
  cleaned = cleaned.replace(/\/+/g, "/");

  // 8. Lowercase and trim
  return cleaned.toLowerCase().trim();
}

/**
 * Normalizes a monorepo subproject identity by combining canonical Git remote and root-relative subpath.
 *
 * @param gitRemote Raw Git remote URL.
 * @param subPath Root-relative subpath (e.g., "packages/frontend").
 * @returns Canonical monorepo subproject identifier (e.g., "github.com/org/repo#packages/frontend").
 */
export function normalizeMonorepoSubproject(
  gitRemote: string,
  subPath: string
): string {
  const canonicalRemote = normalizeGitRemote(gitRemote);
  if (!canonicalRemote) return "";

  const cleanSubPath = (subPath || "")
    .trim()
    .toLowerCase()
    .replace(/^\/+|\/+$/g, "")
    .replace(/\/+/g, "/");

  if (!cleanSubPath) return canonicalRemote;

  return `${canonicalRemote}#${cleanSubPath}`;
}

/**
 * Normalizes a package manifest identity into a standard canonical format.
 *
 * Example:
 * ecosystem: "npm", name: "@aimemory/core" -> "pkg:npm:@aimemory/core"
 *
 * @param ecosystem Package ecosystem (e.g., npm, cargo, pypi, go, composer).
 * @param packageName Package name from manifest.
 * @returns Canonical package identifier string.
 */
export function normalizeManifestIdentity(
  ecosystem: string,
  packageName: string
): string {
  if (!ecosystem || !packageName) return "";

  const cleanEco = ecosystem.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
  const cleanName = packageName.trim().toLowerCase().replace(/\s+/g, "");

  if (!cleanEco || !cleanName) return "";

  return `pkg:${cleanEco}:${cleanName}`;
}

/**
 * Normalizes a local workspace identity without storing raw filesystem paths.
 * Generates a privacy-preserving hash of the local path.
 *
 * @param clientId Unique identifier for the client machine / IDE installation.
 * @param folderName Name of the workspace root folder.
 * @param localPath Optional raw filesystem path (hashed deterministically).
 * @returns Privacy-safe canonical workspace identifier.
 */
export function normalizeWorkspaceDigest(
  clientId: string,
  folderName: string,
  localPath?: string
): string {
  const cleanClientId = (clientId || "default")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "");
  const cleanFolderName = (folderName || "workspace")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "-");

  const pathDigest = localPath
    ? generateIdentityHash(localPath.trim().toLowerCase().replace(/\\/g, "/"))
    : "none";

  return `ws:${cleanClientId}:${cleanFolderName}:${pathDigest.slice(0, 16)}`;
}

/**
 * Normalizes an external platform conversation or project session identifier.
 *
 * @param platform Platform identifier (e.g., "CHATGPT", "CLAUDE").
 * @param sessionId External session or conversation ID.
 * @returns Canonical platform session string.
 */
export function normalizePlatformSession(
  platform: string,
  sessionId: string
): string {
  if (!platform || !sessionId) return "";

  const cleanPlatform = platform.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
  const cleanSession = sessionId.trim().replace(/\s+/g, "");

  if (!cleanPlatform || !cleanSession) return "";

  return `platform:${cleanPlatform}:${cleanSession}`;
}

/**
 * Generates a deterministic SHA-256 hex digest for an identity value.
 *
 * @param canonicalValue The normalized canonical identity string.
 * @returns 64-character lowercase hexadecimal hash.
 */
export function generateIdentityHash(canonicalValue: string): string {
  if (!canonicalValue) return "";

  return crypto
    .createHash("sha256")
    .update(canonicalValue.trim(), "utf8")
    .digest("hex");
}

/**
 * Generates a privacy-preserving digest of a local filesystem path for the ProjectSource record.
 *
 * @param rawPath Local filesystem path.
 * @returns 64-character SHA-256 hex digest or null if empty.
 */
export function generateLocalPathDigest(rawPath?: string): string | null {
  if (!rawPath || typeof rawPath !== "string") return null;

  const normalized = rawPath.trim().toLowerCase().replace(/\\/g, "/");
  if (!normalized) return null;

  return crypto.createHash("sha256").update(normalized, "utf8").digest("hex");
}

/**
 * Extracts a human-readable repository or project name from a Git remote URL.
 *
 * Example:
 * "git@github.com:org/ai-memory-sync.git" -> "ai-memory-sync"
 * "https://gitlab.company.com/group/subgroup/payment-service" -> "payment-service"
 *
 * @param rawUrl Raw or normalized Git URL.
 * @returns Repository name or null.
 */
export function extractRepoNameFromGitUrl(rawUrl: string): string | null {
  const normalized = normalizeGitRemote(rawUrl);
  if (!normalized) return null;

  const segments = normalized.split("/").filter(Boolean);
  if (segments.length >= 2) {
    const lastSegment = segments[segments.length - 1];
    return lastSegment.replace(/[^a-zA-Z0-9._-]/g, "") || null;
  }

  return null;
}
