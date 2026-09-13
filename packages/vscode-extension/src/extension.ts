import * as vscode from "vscode";
import { createAiMemoryClient } from "./client/client-factory.js";
import { setClient, clearClient } from "./client/client-holder.js";
import { OutputChannelLogger } from "./adapters/output-channel.logger.js";
import { StatusBarManager } from "./services/status-bar.manager.js";
import { WorkspaceLifecycleService } from "./services/workspace-lifecycle.js";
import { ProjectsTreeDataProvider } from "./providers/projects-tree.provider.js";
import { MemoriesTreeDataProvider } from "./providers/memories-tree.provider.js";
import { ContextTreeDataProvider } from "./providers/context-tree.provider.js";
import { registerAuthCommands } from "./commands/auth.commands.js";
import { registerProjectCommands } from "./commands/project.commands.js";
import { registerMemoryCommands } from "./commands/memory.commands.js";
import { WorkspaceTrustGuard } from "./services/workspace-trust.guard.js";
import { CONFIG, SECRETS, VIEWS } from "./constants.js";

/**
 * Extension activation entry point.
 *
 * Called by VS Code when any of the extension's activationEvents fire.
 * This function:
 * 1. Initializes the logger and SDK client with VS Code adapters
 * 2. Sets up tree view providers and status bar
 * 3. Wires workspace lifecycle events (debounced resolution)
 * 4. Registers all commands
 * 5. Handles SDK events (auth failures, rate limiting)
 * 6. Triggers initial project resolution if API key is already configured
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
  // -----------------------------------------------------------------------
  // Step 1: Logger (must be created first so all components can log)
  // -----------------------------------------------------------------------
  const logLevel = vscode.workspace
    .getConfiguration()
    .get<"DEBUG" | "INFO" | "WARN" | "ERROR">(CONFIG.LOG_LEVEL, "INFO");

  const logger = new OutputChannelLogger(logLevel);
  logger.info("AiMemorySync extension activating...");

  // -----------------------------------------------------------------------
  // Step 2: SDK Client
  // -----------------------------------------------------------------------
  const client = createAiMemoryClient(context, logger);
  setClient(client);

  // -----------------------------------------------------------------------
  // Step 3: UI Components
  // -----------------------------------------------------------------------
  const statusBar = new StatusBarManager();
  const projectsProvider = new ProjectsTreeDataProvider();
  const memoriesProvider = new MemoriesTreeDataProvider();
  const contextProvider = new ContextTreeDataProvider();

  // Register tree views
  const projectsView = vscode.window.createTreeView(VIEWS.PROJECTS, {
    treeDataProvider: projectsProvider,
    showCollapseAll: false,
  });

  const memoriesView = vscode.window.createTreeView(VIEWS.MEMORIES, {
    treeDataProvider: memoriesProvider,
    showCollapseAll: true,
  });

  const contextView = vscode.window.createTreeView(VIEWS.CONTEXT, {
    treeDataProvider: contextProvider,
    showCollapseAll: false,
  });

  const enableStatusBar = vscode.workspace
    .getConfiguration()
    .get<boolean>(CONFIG.ENABLE_STATUS_BAR, true);

  if (enableStatusBar) {
    statusBar.show();
  }

  // -----------------------------------------------------------------------
  // Step 4: Workspace Lifecycle Service
  // -----------------------------------------------------------------------
  const lifecycle = new WorkspaceLifecycleService(client, logger);

  lifecycle.setCallbacks(
    // onResolved: update all providers with the new project result
    async (folder, result) => {
      projectsProvider.setResolveResult(result);
      statusBar.setConnected(result.project.name, result.matchedBy);
      logger.info(`Project resolved: "${result.project.name}" for folder "${folder.name}"`);

      // Load memories and context in parallel
      const budget = vscode.workspace.getConfiguration().get<number>(CONFIG.CONTEXT_BUDGET, 8000);
      memoriesProvider.setLoading(true);
      contextProvider.setLoading(true);

      await Promise.allSettled([
        client.memories
          .list(result.project.id, { status: "ACTIVE" })
          .then((memories) => memoriesProvider.setMemories(memories, result.project.name))
          .catch((err: unknown) => {
            const msg = err instanceof Error ? err.message : "Failed to load memories";
            memoriesProvider.setError(msg);
            logger.warn(`Failed to load memories: ${msg}`);
          }),
        client.context
          .get(result.project.id, { budget })
          .then((ctx) => contextProvider.setContextResult(ctx))
          .catch((err: unknown) => {
            const msg = err instanceof Error ? err.message : "Failed to load context";
            contextProvider.setError(msg);
            logger.warn(`Failed to load context: ${msg}`);
          }),
      ]);
    },

    // onError: update status bar and project provider with error
    (_folder, error) => {
      const msg = error.message;
      const isAuthError = msg.toLowerCase().includes("unauthorized") || msg.toLowerCase().includes("401");

      if (isAuthError) {
        statusBar.setDisconnected();
        projectsProvider.setError("Authentication required. Click to sign in.");
      } else {
        statusBar.setError();
        projectsProvider.setError(msg);
      }

      logger.error(`Project resolution failed: ${msg}`);
    }
  );

  // -----------------------------------------------------------------------
  // Step 5: SDK Event Handlers
  // -----------------------------------------------------------------------

  // Handle authentication failures from any SDK module
  const unsubUnauthorized = client.events.on("auth:unauthorized", () => {
    statusBar.setDisconnected();
    projectsProvider.setError("Authentication required. Click to sign in.");
    lifecycle.invalidateCache();

    void vscode.window
      .showWarningMessage(
        "AiMemorySync: Authentication required or session expired.",
        "Sign In",
        "Enter API Key"
      )
      .then((action) => {
        if (action === "Sign In") {
          void vscode.commands.executeCommand("aimemory.login");
        } else if (action === "Enter API Key") {
          void vscode.commands.executeCommand("aimemory.setApiKey");
        }
      });
  });

  // Handle rate limiting
  const unsubRateLimit = client.events.on("rate-limit:exceeded", ({ retryAfterSecs }) => {
    const seconds = retryAfterSecs ?? 60;
    statusBar.setRateLimited(seconds);
    logger.warn(`Rate limited. Resuming in ${seconds}s`);
  });


  // -----------------------------------------------------------------------
  // Step 6: Workspace Folder Event Listeners
  // -----------------------------------------------------------------------

  // On workspace folder added or changed
  const onDidChangeWorkspaceFolders = vscode.workspace.onDidChangeWorkspaceFolders(
    (event) => {
      for (const folder of event.added) {
        lifecycle.scheduleResolution(folder);
      }
    }
  );

  // Re-resolve when active editor switches to a different workspace folder
  const onDidChangeActiveEditor = vscode.window.onDidChangeActiveTextEditor(
    (editor) => {
      if (!editor) return;
      const folder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
      if (folder) {
        lifecycle.scheduleResolution(folder);
      }
    }
  );

  // Handle workspace trust changes
  const trustGuard = new WorkspaceTrustGuard();
  const trustDisposable = trustGuard.onTrustChange((trusted) => {
    if (trusted) {
      const folder = vscode.workspace.workspaceFolders?.[0];
      if (folder) {
        lifecycle.scheduleResolution(folder);
      }
    } else {
      statusBar.setUntrusted();
    }
  });

  // Handle configuration changes dynamically
  const onDidChangeConfiguration = vscode.workspace.onDidChangeConfiguration(
    (event) => {
      if (event.affectsConfiguration(CONFIG.API_URL)) {
        const newApiUrl =
          vscode.workspace.getConfiguration().get<string>(CONFIG.API_URL) ?? "http://localhost:3000";
        client.setBaseUrl(newApiUrl);
        lifecycle.invalidateCache();
        logger.info(`AiMemorySync server URL updated to: ${newApiUrl}`);
      }
      if (event.affectsConfiguration(CONFIG.LOG_LEVEL)) {
        const newLogLevel =
          vscode.workspace.getConfiguration().get<"DEBUG" | "INFO" | "WARN" | "ERROR">(CONFIG.LOG_LEVEL, "INFO");
        logger.setLevel(newLogLevel);
      }
    }
  );

  // -----------------------------------------------------------------------
  // Step 7: Register All Commands
  // -----------------------------------------------------------------------
  const authDisposables = registerAuthCommands(
    context,
    client,
    statusBar,
    lifecycle,
    projectsProvider,
    memoriesProvider,
    contextProvider
  );

  const projectDisposables = registerProjectCommands(
    client,
    statusBar,
    lifecycle,
    projectsProvider,
    memoriesProvider,
    contextProvider
  );

  const memoryDisposables = registerMemoryCommands(
    client,
    lifecycle,
    memoriesProvider,
    contextProvider
  );

  // -----------------------------------------------------------------------
  // Step 8: Register all disposables for cleanup
  // -----------------------------------------------------------------------
  context.subscriptions.push(
    logger,
    statusBar,
    projectsView,
    memoriesView,
    contextView,
    lifecycle,
    onDidChangeWorkspaceFolders,
    onDidChangeActiveEditor,
    trustDisposable,
    onDidChangeConfiguration,
    { dispose: unsubUnauthorized },
    { dispose: unsubRateLimit },
    ...authDisposables,
    ...projectDisposables,
    ...memoryDisposables
  );

  // -----------------------------------------------------------------------
  // Step 9: Initial project resolution (if API key already configured)
  // -----------------------------------------------------------------------
  const storedApiKey = await context.secrets.get(SECRETS.API_KEY);

  if (storedApiKey) {
    // Restore API key into the SDK client (it was lost when the process started)
    await client.auth.setApiKey(storedApiKey);
    projectsProvider.setAuthenticated(true);

    const folder = vscode.workspace.workspaceFolders?.[0];
    if (folder) {
      logger.info("API key found in SecretStorage — triggering initial resolution");
      statusBar.setResolving();
      lifecycle.scheduleResolution(folder);
    } else {
      logger.info("API key found but no workspace folder is open");
      statusBar.setDisconnected();
    }
  } else {
    logger.info("No API key configured — extension in disconnected state");
    projectsProvider.setAuthenticated(false);
    statusBar.setDisconnected();
  }

  logger.info("AiMemorySync extension activated successfully");
}

/**
 * Called when the extension is deactivated (VS Code shutdown or extension reload).
 */
export function deactivate(): void {
  clearClient();
}
