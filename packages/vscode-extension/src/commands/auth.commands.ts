import * as vscode from "vscode";
import * as os from "os";
import type { AiMemoryClient } from "@aimemory/client-core";
import { SECRETS, CONFIG } from "../constants.js";
import { StatusBarManager } from "../services/status-bar.manager.js";
import { WorkspaceLifecycleService } from "../services/workspace-lifecycle.js";
import { ProjectsTreeDataProvider } from "../providers/projects-tree.provider.js";
import { MemoriesTreeDataProvider } from "../providers/memories-tree.provider.js";
import { ContextTreeDataProvider } from "../providers/context-tree.provider.js";
import {
  promptEmail,
  promptPassword,
  promptServerUrl,
  promptApiKey,
  showInfo,
  showError,
} from "../utils/ui-feedback.js";

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
  // aimemory.login — Sign in with email & password and automatically connect
  // -----------------------------------------------------------------------
  disposables.push(
    vscode.commands.registerCommand("aimemory.login", async () => {
      const email = await promptEmail();
      if (!email) return; // User cancelled

      const password = await promptPassword();
      if (!password) return; // User cancelled

      statusBar.setConnecting();

      try {
        const clientName = `Antigravity / VS Code (${os.hostname()})`;
        const result = await client.auth.login({
          email,
          password,
          generateKey: true,
          clientName,
        });

        if (result.apiKey) {
          await context.secrets.store(SECRETS.API_KEY, result.apiKey);
        }

        // Invalidate resolution cache so all providers refresh with new credentials
        lifecycle.invalidateCache();
        projectsProvider.clear();
        memoriesProvider.clear();
        contextProvider.clear();

        const tenantName = result.activeTenant?.name || "Default Workspace";
        await showInfo(`Logged in as ${result.user.email} (${tenantName}). Connecting workspace...`);
        statusBar.setResolving();

        // Trigger resolution on the active workspace folder
        const folder = vscode.workspace.workspaceFolders?.[0];
        if (folder) {
          try {
            const res = await lifecycle.resolveNow(folder);
            if (res) {
              statusBar.setConnected(res.project.name, res.matchedBy);
            }
          } catch (error) {
            const msg = error instanceof Error ? error.message : "Unknown error";
            statusBar.setError();
            await showError(`Failed to resolve workspace: ${msg}`, "Open Logs");
          }
        } else {
          statusBar.setDisconnected();
          await showInfo(`Connected to ${tenantName}. Open a workspace folder to begin.`);
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Sign in failed";
        statusBar.setDisconnected();

        const isNetworkErr =
          msg.toLowerCase().includes("fetch") ||
          msg.toLowerCase().includes("network") ||
          msg.toLowerCase().includes("econnrefused") ||
          msg.toLowerCase().includes("failed to connect");

        const currentUrl =
          vscode.workspace.getConfiguration().get<string>(CONFIG.API_URL) ?? "http://localhost:3000";

        if (isNetworkErr) {
          const action = await showError(
            `Cannot connect to server at ${currentUrl}: ${msg}`,
            "Change Server URL",
            "Retry"
          );
          if (action === "Change Server URL") {
            await vscode.commands.executeCommand("aimemory.setServerUrl");
          } else if (action === "Retry") {
            await vscode.commands.executeCommand("aimemory.login");
          }
        } else {
          await showError(`Sign in failed: ${msg}`);
        }
      }
    })
  );

  // -----------------------------------------------------------------------
  // aimemory.setServerUrl — Configure backend base URL
  // -----------------------------------------------------------------------
  disposables.push(
    vscode.commands.registerCommand("aimemory.setServerUrl", async () => {
      const currentUrl =
        vscode.workspace.getConfiguration().get<string>(CONFIG.API_URL) ?? "http://localhost:3000";

      const newUrl = await promptServerUrl(currentUrl);
      if (!newUrl) return; // User cancelled

      await vscode.workspace
        .getConfiguration()
        .update(CONFIG.API_URL, newUrl, vscode.ConfigurationTarget.Global);

      client.setBaseUrl(newUrl);
      lifecycle.invalidateCache();

      const action = await showInfo(
        `Server URL updated to ${newUrl}.`,
        "Sign In Now"
      );
      if (action === "Sign In Now") {
        await vscode.commands.executeCommand("aimemory.login");
      }
    })
  );

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
