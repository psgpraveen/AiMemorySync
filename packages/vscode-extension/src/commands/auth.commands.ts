import * as vscode from "vscode";
import type { AiMemoryClient } from "@aimemory/client-core";
import { SECRETS } from "../constants.js";
import { StatusBarManager } from "../services/status-bar.manager.js";
import { WorkspaceLifecycleService } from "../services/workspace-lifecycle.js";
import { ProjectsTreeDataProvider } from "../providers/projects-tree.provider.js";
import { MemoriesTreeDataProvider } from "../providers/memories-tree.provider.js";
import { ContextTreeDataProvider } from "../providers/context-tree.provider.js";
import { promptApiKey, showInfo, showError } from "../utils/ui-feedback.js";

export function registerAuthCommands(
  context: vscode.ExtensionContext,
  client: AiMemoryClient,
  statusBar: StatusBarManager,
  lifecycle: WorkspaceLifecycleService,
  projectsProvider: ProjectsTreeDataProvider,
  memoriesProvider: MemoriesTreeDataProvider,
  contextProvider: ContextTreeDataProvider
): vscode.Disposable[] {
  const disposables: vscode.Disposable[] = [];

  // -----------------------------------------------------------------------
  // aimemory.setApiKey — Set or update API key
  // -----------------------------------------------------------------------
  disposables.push(
    vscode.commands.registerCommand("aimemory.setApiKey", async () => {
      const key = await promptApiKey();
      if (!key) return; // User cancelled

      // SECURITY: Store exclusively in VS Code's OS-backed SecretStorage
      await context.secrets.store(SECRETS.API_KEY, key);
      await client.auth.setApiKey(key);

      statusBar.setConnecting();

      // Invalidate resolution cache so all providers refresh with new credentials
      lifecycle.invalidateCache();
      projectsProvider.clear();
      memoriesProvider.clear();
      contextProvider.clear();

      await showInfo("API key saved securely. Resolving project...");
      statusBar.setResolving();

      // Trigger resolution on the active workspace folder
      const folder = vscode.workspace.workspaceFolders?.[0];
      if (folder) {
        try {
          const result = await lifecycle.resolveNow(folder);
          if (result) {
            statusBar.setConnected(result.project.name, result.matchedBy);
          }
        } catch (error) {
          const msg = error instanceof Error ? error.message : "Unknown error";
          statusBar.setError();
          await showError(`Failed to connect: ${msg}`, "Open Logs");
        }
      } else {
        statusBar.setDisconnected();
        await showInfo("API key saved. Open a workspace folder to begin.");
      }
    })
  );

  // -----------------------------------------------------------------------
  // aimemory.removeApiKey — Remove API key and disconnect
  // -----------------------------------------------------------------------
  disposables.push(
    vscode.commands.registerCommand("aimemory.removeApiKey", async () => {
      await context.secrets.delete(SECRETS.API_KEY);
      await client.auth.clearApiKey();

      lifecycle.invalidateCache();
      projectsProvider.clear();
      memoriesProvider.clear();
      contextProvider.clear();
      statusBar.setDisconnected();

      await showInfo("Disconnected. API key removed from secure storage.");
    })
  );

  // -----------------------------------------------------------------------
  // aimemory.checkConnection — Validate current API key with a real API call
  // -----------------------------------------------------------------------
  disposables.push(
    vscode.commands.registerCommand("aimemory.checkConnection", async () => {
      const apiKey = await client.auth.getApiKey();

      if (!apiKey) {
        const action = await showInfo("No API key configured.", "Set API Key");
        if (action === "Set API Key") {
          await vscode.commands.executeCommand("aimemory.setApiKey");
        }
        return;
      }

      try {
        statusBar.setConnecting();
        // Use listKeys as a lightweight connectivity probe (requires admin scope)
        await client.auth.listKeys();
        statusBar.setResolving();
        await showInfo("Connection successful. API key is valid.");

        // Re-trigger resolution after connection check
        const folder = vscode.workspace.workspaceFolders?.[0];
        if (folder) {
          const result = await lifecycle.resolveNow(folder);
          if (result) {
            statusBar.setConnected(result.project.name, result.matchedBy);
          }
        } else {
          statusBar.setDisconnected();
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        statusBar.setError();

        if (msg.toLowerCase().includes("unauthorized") || msg.toLowerCase().includes("401")) {
          const action = await showError(
            "API key is invalid or expired.",
            "Update API Key"
          );
          if (action === "Update API Key") {
            await vscode.commands.executeCommand("aimemory.setApiKey");
          }
        } else {
          await showError(`Connection failed: ${msg}`);
        }
      }
    })
  );

  return disposables;
}
