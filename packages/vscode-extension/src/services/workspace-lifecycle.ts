import * as vscode from "vscode";
import type { AiMemoryClient, ResolveProjectResult } from "@aimemory/client-core";
import { WorkspaceDiscoveryService } from "./workspace-discovery.js";
import { WorkspaceTrustGuard } from "./workspace-trust.guard.js";
import { CONFIG, WORKSPACE_DEBOUNCE_MS } from "../constants.js";
import type { OutputChannelLogger } from "../adapters/output-channel.logger.js";

export type ProjectResolvedCallback = (
  folder: vscode.WorkspaceFolder,
  result: ResolveProjectResult
) => void;

export type ProjectResolveErrorCallback = (
  folder: vscode.WorkspaceFolder,
  error: Error
) => void;

/**
 * Manages workspace open/switch events with debouncing and in-flight request
 * deduplication to prevent excessive API calls and race conditions.
 *
 * Key behaviors:
 * - 400ms debounce before triggering resolution on folder change
 * - In-flight deduplication: if a resolution is already running for a URI,
 *   subsequent triggers attach to the existing Promise
 * - Caches the last successful result per folder URI for instant re-display
 * - Respects WorkspaceTrust: skips resolution for untrusted workspaces
 */
export class WorkspaceLifecycleService {
  private readonly discovery = new WorkspaceDiscoveryService();
  private readonly trustGuard = new WorkspaceTrustGuard();

  /** Currently-running resolution Promises keyed by workspace folder URI string */
  private readonly inFlightResolutions = new Map<string, Promise<ResolveProjectResult>>();

  /** Cached successful results keyed by workspace folder URI string */
  private readonly activeProjectCache = new Map<string, ResolveProjectResult>();

  /** Debounce timer handle */
  private debounceTimer?: ReturnType<typeof setTimeout>;

  /** Pending folder to resolve after debounce */
  private pendingFolder?: vscode.WorkspaceFolder;

  private onResolved?: ProjectResolvedCallback;
  private onError?: ProjectResolveErrorCallback;

  constructor(
    private readonly client: AiMemoryClient,
    private readonly logger: OutputChannelLogger
  ) {}

  setCallbacks(
    onResolved: ProjectResolvedCallback,
    onError: ProjectResolveErrorCallback
  ): void {
    this.onResolved = onResolved;
    this.onError = onError;
  }

  /**
   * Returns the cached project result for a folder URI, if available.
   */
  getCachedResult(folderUri: string): ResolveProjectResult | undefined {
    return this.activeProjectCache.get(folderUri);
  }

  /**
   * Clears the cache for all folders (used on API key change).
   */
  invalidateCache(): void {
    this.activeProjectCache.clear();
  }

  /**
   * Triggers a debounced project resolution for the given workspace folder.
   * Cancels any pending debounce timer and resets it.
   */
  scheduleResolution(folder: vscode.WorkspaceFolder): void {
    const autoResolve = vscode.workspace
      .getConfiguration()
      .get<boolean>(CONFIG.AUTO_RESOLVE, true);

    if (!autoResolve) return;

    if (!this.trustGuard.isFolderTrusted(folder)) {
      this.logger.warn(
        `Skipping auto-resolution for untrusted workspace: ${folder.name}`
      );
      return;
    }

    this.pendingFolder = folder;

    if (this.debounceTimer !== undefined) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      if (this.pendingFolder) {
        void this.executeResolution(this.pendingFolder);
        this.pendingFolder = undefined;
      }
    }, WORKSPACE_DEBOUNCE_MS);
  }

  /**
   * Immediately triggers project resolution for the given folder,
   * bypassing the debounce. Deduplication still applies.
   */
  async resolveNow(folder: vscode.WorkspaceFolder): Promise<ResolveProjectResult | null> {
    if (!this.trustGuard.isFolderTrusted(folder)) {
      vscode.window.showWarningMessage(
        "AiMemorySync: Cannot resolve project in an untrusted workspace. Trust this workspace to enable AI memory.",
        "Trust Workspace"
      ).then(action => {
        if (action === "Trust Workspace") {
          void vscode.commands.executeCommand("workbench.action.manageTrustedDomains");
        }
      });
      return null;
    }

    return this.executeResolution(folder);
  }

  /**
   * Core resolution logic with in-flight deduplication.
   */
  private async executeResolution(
    folder: vscode.WorkspaceFolder
  ): Promise<ResolveProjectResult> {
    const key = folder.uri.toString();

    // Deduplication: if already resolving this folder, return the existing Promise
    const existing = this.inFlightResolutions.get(key);
    if (existing) {
      this.logger.debug(`Resolution already in-flight for ${folder.name}, reusing Promise`);
      return existing;
    }

    const resolutionPromise = this.doResolve(folder);
    this.inFlightResolutions.set(key, resolutionPromise);

    try {
      const result = await resolutionPromise;
      this.activeProjectCache.set(key, result);
      this.onResolved?.(folder, result);
      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.onError?.(folder, err);
      throw err;
    } finally {
      this.inFlightResolutions.delete(key);
    }
  }

  private async doResolve(folder: vscode.WorkspaceFolder): Promise<ResolveProjectResult> {
    this.logger.info(`Resolving project for workspace: ${folder.name}`);

    const input = await this.discovery.buildResolveInput(folder);

    this.logger.debug("Resolution signals extracted", {
      platform: input.source.platform,
      hasGitRemote: !!input.signals.gitRemoteUrl,
      hasPackageManifest: !!input.signals.packageManifest,
      hasMonorepoSubPath: !!input.signals.monorepoSubPath,
      workspaceName: input.signals.workspaceName,
    });

    const result = await this.client.projects.resolve(input);

    this.logger.info(
      `Project resolved: "${result.project.name}" via ${result.matchedBy} (confidence: ${result.confidence}%)`,
      { projectId: result.project.id }
    );

    return result;
  }

  dispose(): void {
    if (this.debounceTimer !== undefined) {
      clearTimeout(this.debounceTimer);
    }
    this.inFlightResolutions.clear();
    this.activeProjectCache.clear();
  }
}

