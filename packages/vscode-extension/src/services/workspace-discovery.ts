import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import type { ResolveProjectInput, DiscoverySignals } from "@aimemory/client-core";
import { detectGitRemoteUrl, detectMonorepoSubPath } from "../utils/git-detector.js";
import { PLATFORM_ID, EXTENSION_VERSION } from "../constants.js";

/**
 * Extracts project discovery signals from a VS Code workspace folder.
 *
 * SECURITY:
 * - Raw local filesystem paths (e.g. C:\Users\alice\projects\app) are NEVER
 *   included in the returned signals or sent to the backend.
 * - Only relative monorepo subpaths and sanitized remote URLs are transmitted.
 */
export class WorkspaceDiscoveryService {
  /**
   * Builds a ResolveProjectInput from a workspace folder by reading
   * Git remotes and package manifest metadata.
   */
  async buildResolveInput(folder: vscode.WorkspaceFolder): Promise<ResolveProjectInput> {
    const folderPath = folder.uri.fsPath;

    const signals: DiscoverySignals = {};

    // 1. Git remote URL (sanitized — no embedded credentials)
    const gitRemoteUrl = await detectGitRemoteUrl(folderPath);
    if (gitRemoteUrl) {
      signals.gitRemoteUrl = gitRemoteUrl;
    }

    // 2. Monorepo subpath (relative only — no absolute paths)
    const monorepoSubPath = detectMonorepoSubPath(folderPath);
    if (monorepoSubPath) {
      signals.monorepoSubPath = monorepoSubPath;
    }

    // 3. Package manifest signals (name + ecosystem only — no paths)
    const packageManifest = this.detectPackageManifest(folderPath);
    if (packageManifest) {
      signals.packageManifest = packageManifest;
    }

    // 4. Workspace display name (human-readable label only)
    if (folder.name) {
      signals.workspaceName = folder.name;
    }

    // NOTE: signals.localPath is intentionally NOT set to avoid leaking
    // raw machine-specific paths in API payloads.

    return {
      signals,
      source: {
        platform: PLATFORM_ID,
        metadata: {
          extensionVersion: EXTENSION_VERSION,
          vsCodeVersion: vscode.version,
        },
      },
    };
  }

  /**
   * Reads package manifest files to extract ecosystem and package name.
   * Reads ONLY the name field — never version, scripts, dependencies, or paths.
   */
  private detectPackageManifest(
    folderPath: string
  ): { ecosystem: string; name: string } | null {
    // 1. package.json (Node/npm)
    const pkgJsonPath = path.join(folderPath, "package.json");
    try {
      const content = fs.readFileSync(pkgJsonPath, "utf-8");
      const parsed = JSON.parse(content) as { name?: unknown };
      if (typeof parsed.name === "string" && parsed.name.trim()) {
        return { ecosystem: "npm", name: parsed.name.trim() };
      }
    } catch {
      // No package.json or unreadable
    }

    // 2. Cargo.toml (Rust)
    const cargoTomlPath = path.join(folderPath, "Cargo.toml");
    try {
      const content = fs.readFileSync(cargoTomlPath, "utf-8");
      const match = content.match(/^\s*name\s*=\s*"([^"]+)"/m);
      if (match) {
        return { ecosystem: "cargo", name: match[1].trim() };
      }
    } catch {
      // No Cargo.toml
    }

    // 3. pyproject.toml (Python)
    const pyprojectPath = path.join(folderPath, "pyproject.toml");
    try {
      const content = fs.readFileSync(pyprojectPath, "utf-8");
      const match = content.match(/^\s*name\s*=\s*"([^"]+)"/m);
      if (match) {
        return { ecosystem: "python", name: match[1].trim() };
      }
    } catch {
      // No pyproject.toml
    }

    // 4. go.mod (Go)
    const goModPath = path.join(folderPath, "go.mod");
    try {
      const content = fs.readFileSync(goModPath, "utf-8");
      const match = content.match(/^module\s+(\S+)/m);
      if (match) {
        return { ecosystem: "go", name: match[1].trim() };
      }
    } catch {
      // No go.mod
    }

    return null;
  }
}
