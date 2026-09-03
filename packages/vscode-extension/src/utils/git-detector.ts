import * as fs from "fs";
import * as path from "path";

/**
 * Reads the Git remote URL for a workspace directory by parsing `.git/config` directly.
 *
 * SECURITY:
 * - Uses direct file parsing — NOT shell execution or `exec()` — to prevent injection.
 * - Strips credentials (username:password@) from remote URLs before returning.
 * - Raw local filesystem paths are NEVER transmitted in network payloads.
 */
export async function detectGitRemoteUrl(workspacePath: string): Promise<string | null> {
  // Try .git/config first (fast, no shell required)
  const gitConfigPath = path.join(workspacePath, ".git", "config");
  try {
    const content = fs.readFileSync(gitConfigPath, "utf-8");
    const url = parseGitRemoteUrl(content);
    if (url) return sanitizeGitUrl(url);
  } catch {
    // .git/config not readable — folder may not be a git repo or is a worktree
  }

  // Fallback: try parent directories up to 3 levels (covers monorepo subprojects)
  let dir = workspacePath;
  for (let i = 0; i < 3; i++) {
    const parent = path.dirname(dir);
    if (parent === dir) break; // reached filesystem root
    dir = parent;
    const parentGitConfig = path.join(dir, ".git", "config");
    try {
      const content = fs.readFileSync(parentGitConfig, "utf-8");
      const url = parseGitRemoteUrl(content);
      if (url) return sanitizeGitUrl(url);
    } catch {
      // continue
    }
  }

  return null;
}

/**
 * Detects the monorepo subpath of a workspace folder relative to the Git root.
 * Returns null if the workspace IS the Git root, or if no Git root is found.
 */
export function detectMonorepoSubPath(workspacePath: string): string | null {
  let dir = workspacePath;
  for (let i = 0; i < 5; i++) {
    const parent = path.dirname(dir);
    if (parent === dir) break;
    const parentGitDir = path.join(parent, ".git");
    try {
      fs.statSync(parentGitDir);
      // Parent has .git — workspacePath is a subproject
      const subPath = path.relative(parent, workspacePath).replace(/\\/g, "/");
      return subPath || null;
    } catch {
      dir = parent;
    }
  }
  return null;
}

/**
 * Parses the [remote "origin"] URL from a `.git/config` file content string.
 */
function parseGitRemoteUrl(configContent: string): string | null {
  const lines = configContent.split(/\r?\n/);
  let inRemoteOrigin = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Detect [remote "origin"] section
    if (/^\[remote\s+"origin"\]$/i.test(trimmed)) {
      inRemoteOrigin = true;
      continue;
    }

    // Detect start of new section
    if (trimmed.startsWith("[")) {
      inRemoteOrigin = false;
      continue;
    }

    // Inside remote "origin", find url =
    if (inRemoteOrigin) {
      const match = trimmed.match(/^url\s*=\s*(.+)$/i);
      if (match) {
        return match[1].trim();
      }
    }
  }

  return null;
}

/**
 * Strips sensitive credential information from Git remote URLs.
 *
 * Examples:
 *   https://user:token@github.com/org/repo.git → https://github.com/org/repo.git
 *   git@github.com:org/repo.git               → git@github.com:org/repo.git (unchanged)
 */
function sanitizeGitUrl(rawUrl: string): string {
  // Handle HTTPS URLs with embedded credentials
  try {
    if (rawUrl.startsWith("https://") || rawUrl.startsWith("http://")) {
      const parsed = new URL(rawUrl);
      parsed.username = "";
      parsed.password = "";
      return parsed.toString();
    }
  } catch {
    // Not a valid URL — return as-is (SSH format)
  }
  return rawUrl;
}
