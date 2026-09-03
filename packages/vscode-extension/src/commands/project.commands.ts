import * as vscode from "vscode";
import type { AiMemoryClient } from "@aimemory/client-core";
import { StatusBarManager } from "../services/status-bar.manager.js";
import { WorkspaceLifecycleService } from "../services/workspace-lifecycle.js";
import { ProjectsTreeDataProvider } from "../providers/projects-tree.provider.js";
import { MemoriesTreeDataProvider } from "../providers/memories-tree.provider.js";
import { ContextTreeDataProvider } from "../providers/context-tree.provider.js";
import { CONFIG } from "../constants.js";
import { showInfo, showError } from "../utils/ui-feedback.js";

export function registerProjectCommands(
  client: AiMemoryClient,
  statusBar: StatusBarManager,
  lifecycle: WorkspaceLifecycleService,
  projectsProvider: ProjectsTreeDataProvider,
  memoriesProvider: MemoriesTreeDataProvider,
  contextProvider: ContextTreeDataProvider
): vscode.Disposable[] {
  const disposables: vscode.Disposable[] = [];

  // -----------------------------------------------------------------------
  // aimemory.resolveProject — Manually trigger project resolution
  // -----------------------------------------------------------------------
  disposables.push(
    vscode.commands.registerCommand("aimemory.resolveProject", async () => {
      const apiKey = await client.auth.getApiKey();
      if (!apiKey) {
        const action = await showInfo("No API key configured.", "Set API Key");
        if (action === "Set API Key") {
          await vscode.commands.executeCommand("aimemory.setApiKey");
        }
        return;
      }

      const folder = getActiveFolder();
      if (!folder) {
        await showInfo("No workspace folder is open. Open a project folder first.");
        return;
      }

      projectsProvider.setLoading(true);
      statusBar.setResolving();

      try {
        const result = await lifecycle.resolveNow(folder);
        if (result) {
          projectsProvider.setResolveResult(result);
          statusBar.setConnected(result.project.name, result.matchedBy);

          // Load memories in background
          void loadMemories(client, result.project.id, result.project.name, memoriesProvider, CONFIG.CONTEXT_BUDGET);
          void loadContext(client, result.project.id, contextProvider, vscode.workspace.getConfiguration().get<number>(CONFIG.CONTEXT_BUDGET) ?? 8000);
        } else {
          projectsProvider.setLoading(false);
          statusBar.setDisconnected();
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        projectsProvider.setError(msg);
        statusBar.setError();
        await showError(`Project resolution failed: ${msg}`, "Retry");
      }
    })
  );

  // -----------------------------------------------------------------------
  // aimemory.copyContext — Copy assembled context to clipboard
  // -----------------------------------------------------------------------
  disposables.push(
    vscode.commands.registerCommand("aimemory.copyContext", async () => {
      const markdown = contextProvider.getMarkdown();

      if (!markdown) {
        // Try to fetch fresh context
        const resolveResult = lifecycle.getCachedResult(
          getActiveFolder()?.uri.toString() ?? ""
        );

        if (!resolveResult) {
          await showInfo("No project resolved. Run 'AiMemory: Resolve Current Project' first.");
          return;
        }

        contextProvider.setLoading(true);
        try {
          const budget = vscode.workspace.getConfiguration().get<number>(CONFIG.CONTEXT_BUDGET) ?? 8000;
          const result = await client.context.get(resolveResult.project.id, { budget });
          contextProvider.setContextResult(result);
          await vscode.env.clipboard.writeText(result.markdown);
          await showInfo("Project context copied to clipboard.");
        } catch (error) {
          const msg = error instanceof Error ? error.message : "Unknown error";
          contextProvider.setError(msg);
          await showError(`Failed to fetch context: ${msg}`);
        }
        return;
      }

      await vscode.env.clipboard.writeText(markdown);
      await showInfo("Project context copied to clipboard.");
    })
  );

  // -----------------------------------------------------------------------
  // aimemory.previewContext — Open context as read-only Markdown in editor
  // -----------------------------------------------------------------------
  disposables.push(
    vscode.commands.registerCommand("aimemory.previewContext", async () => {
      let markdown = contextProvider.getMarkdown();

      if (!markdown) {
        const resolveResult = lifecycle.getCachedResult(
          getActiveFolder()?.uri.toString() ?? ""
        );

        if (!resolveResult) {
          await showInfo("No project resolved. Run 'AiMemory: Resolve Current Project' first.");
          return;
        }

        contextProvider.setLoading(true);
        try {
          const budget = vscode.workspace.getConfiguration().get<number>(CONFIG.CONTEXT_BUDGET) ?? 8000;
          const result = await client.context.get(resolveResult.project.id, { budget });
          contextProvider.setContextResult(result);
          markdown = result.markdown;
        } catch (error) {
          const msg = error instanceof Error ? error.message : "Unknown error";
          contextProvider.setError(msg);
          await showError(`Failed to fetch context: ${msg}`);
          return;
        }
      }

      // Open in a virtual document as Markdown
      const uri = vscode.Uri.parse(`untitled:AiMemory-Context.md`);
      const doc = await vscode.workspace.openTextDocument({
        language: "markdown",
        content: markdown,
      });
      await vscode.window.showTextDocument(doc, {
        preview: true,
        viewColumn: vscode.ViewColumn.Beside,
      });
    })
  );

  // -----------------------------------------------------------------------
  // aimemory.openDashboard — Open project in web dashboard
  // -----------------------------------------------------------------------
  disposables.push(
    vscode.commands.registerCommand("aimemory.openDashboard", async () => {
      const folder = getActiveFolder();
      const resolveResult = folder
        ? lifecycle.getCachedResult(folder.uri.toString())
        : undefined;

      const apiUrl =
        vscode.workspace.getConfiguration().get<string>(CONFIG.API_URL) ??
        "http://localhost:3000";

      const projectPath = resolveResult?.project.id
        ? `/projects/${resolveResult.project.id}`
        : "/projects";

      const url = `${apiUrl}${projectPath}`;
      await vscode.env.openExternal(vscode.Uri.parse(url));
    })
  );

  // -----------------------------------------------------------------------
  // aimemory.refreshAll — Refresh all tree views for active project
  // -----------------------------------------------------------------------
  disposables.push(
    vscode.commands.registerCommand("aimemory.refreshAll", async () => {
      const folder = getActiveFolder();
      if (!folder) {
        await showInfo("No workspace folder is open.");
        return;
      }

      const resolveResult = lifecycle.getCachedResult(folder.uri.toString());
      if (!resolveResult) {
        await vscode.commands.executeCommand("aimemory.resolveProject");
        return;
      }

      const budget = vscode.workspace.getConfiguration().get<number>(CONFIG.CONTEXT_BUDGET) ?? 8000;

      memoriesProvider.setLoading(true);
      contextProvider.setLoading(true);

      await Promise.allSettled([
        loadMemories(client, resolveResult.project.id, resolveResult.project.name, memoriesProvider, CONFIG.CONTEXT_BUDGET),
        loadContext(client, resolveResult.project.id, contextProvider, budget),
      ]);
    })
  );

  return disposables;
}

/** Returns the currently-active workspace folder based on the active editor */
function getActiveFolder(): vscode.WorkspaceFolder | undefined {
  const activeUri = vscode.window.activeTextEditor?.document.uri;
  if (activeUri) {
    const folder = vscode.workspace.getWorkspaceFolder(activeUri);
    if (folder) return folder;
  }
  return vscode.workspace.workspaceFolders?.[0];
}

/** Loads memories for a project and updates the tree provider */
async function loadMemories(
  client: AiMemoryClient,
  projectId: string,
  projectName: string,
  provider: MemoriesTreeDataProvider,
  _configKey: string
): Promise<void> {
  provider.setLoading(true);
  try {
    const memories = await client.memories.list(projectId, { status: "ACTIVE" });
    provider.setMemories(memories, projectName);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to load memories";
    provider.setError(msg);
  }
}

/** Loads assembled context and updates the context tree provider */
async function loadContext(
  client: AiMemoryClient,
  projectId: string,
  provider: ContextTreeDataProvider,
  budget: number
): Promise<void> {
  provider.setLoading(true);
  try {
    const result = await client.context.get(projectId, { budget });
    provider.setContextResult(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to load context";
    provider.setError(msg);
  }
}
