import * as vscode from "vscode";
import type { AiMemoryClient, MemoryDto } from "@aimemory/client-core";
import { MemoriesTreeDataProvider } from "../providers/memories-tree.provider.js";
import { ContextTreeDataProvider } from "../providers/context-tree.provider.js";
import { WorkspaceLifecycleService } from "../services/workspace-lifecycle.js";
import { CONFIG } from "../constants.js";
import {
  promptMemoryType,
  promptMemoryPriority,
  confirmDestructiveAction,
  showInfo,
  showError,
} from "../utils/ui-feedback.js";

export function registerMemoryCommands(
  client: AiMemoryClient,
  lifecycle: WorkspaceLifecycleService,
  memoriesProvider: MemoriesTreeDataProvider,
  contextProvider: ContextTreeDataProvider
): vscode.Disposable[] {
  const disposables: vscode.Disposable[] = [];

  // -----------------------------------------------------------------------
  // aimemory.addMemory — Create a new memory via multi-step QuickPick/InputBox
  // -----------------------------------------------------------------------
  disposables.push(
    vscode.commands.registerCommand("aimemory.addMemory", async () => {
      const folder = getActiveFolder();
      const resolveResult = folder
        ? lifecycle.getCachedResult(folder.uri.toString())
        : undefined;

      if (!resolveResult) {
        await showInfo(
          "No project resolved. Run 'AiMemory: Resolve Current Project' first."
        );
        return;
      }

      const projectId = resolveResult.project.id;

      // Step 1: Type
      const type = await promptMemoryType();
      if (!type) return;

      // Step 2: Title
      const title = await vscode.window.showInputBox({
        title: "AiMemorySync — Memory Title",
        prompt: "Enter a concise title for this memory",
        placeHolder: "e.g. Use PostgreSQL with Prisma ORM",
        ignoreFocusOut: true,
        validateInput: (v) => (!v.trim() ? "Title is required" : null),
      });
      if (!title) return;

      // Step 3: Content
      const content = await vscode.window.showInputBox({
        title: "AiMemorySync — Memory Content",
        prompt: "Describe the memory in detail. This is the text that will be included in AI context.",
        placeHolder: "e.g. All database operations must use Prisma ORM. Never use raw SQL unless absolutely required...",
        ignoreFocusOut: true,
        validateInput: (v) => (!v.trim() ? "Content is required" : null),
      });
      if (!content) return;

      // Step 4: Priority
      const priority = await promptMemoryPriority();
      if (!priority) return;

      try {
        const memory = await client.memories.create(projectId, {
          type,
          title: title.trim(),
          content: content.trim(),
          priority,
        });

        await showInfo(`Memory "${memory.title}" created successfully.`);

        // Refresh memories and context
        await refreshProviders(client, projectId, resolveResult.project.name, memoriesProvider, contextProvider);
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        await showError(`Failed to create memory: ${msg}`);
      }
    })
  );

  // -----------------------------------------------------------------------
  // aimemory.editMemory — Edit a memory's title, content, or priority
  // -----------------------------------------------------------------------
  disposables.push(
    vscode.commands.registerCommand(
      "aimemory.editMemory",
      async (memory: MemoryDto) => {
        if (!memory?.id) {
          await showError("No memory selected.");
          return;
        }

        // Step 1: New title (prefilled with current)
        const title = await vscode.window.showInputBox({
          title: "AiMemorySync — Edit Memory Title",
          prompt: "Update the memory title (leave unchanged to keep current)",
          value: memory.title,
          ignoreFocusOut: true,
          validateInput: (v) => (!v.trim() ? "Title cannot be empty" : null),
        });
        if (title === undefined) return; // Escaped

        // Step 2: New content (prefilled)
        const content = await vscode.window.showInputBox({
          title: "AiMemorySync — Edit Memory Content",
          prompt: "Update the memory content",
          value: memory.content,
          ignoreFocusOut: true,
          validateInput: (v) => (!v.trim() ? "Content cannot be empty" : null),
        });
        if (content === undefined) return;

        // Step 3: New priority
        const priority = await promptMemoryPriority();
        if (!priority) return;

        try {
          await client.memories.update(memory.id, {
            title: title.trim(),
            content: content.trim(),
            priority,
          });

          await showInfo("Memory updated successfully.");

          const folder = getActiveFolder();
          const resolveResult = folder
            ? lifecycle.getCachedResult(folder.uri.toString())
            : undefined;

          if (resolveResult) {
            await refreshProviders(client, resolveResult.project.id, resolveResult.project.name, memoriesProvider, contextProvider);
          }
        } catch (error) {
          const msg = error instanceof Error ? error.message : "Unknown error";
          await showError(`Failed to update memory: ${msg}`);
        }
      }
    )
  );

  // -----------------------------------------------------------------------
  // aimemory.deprecateMemory — Mark memory as deprecated
  // -----------------------------------------------------------------------
  disposables.push(
    vscode.commands.registerCommand(
      "aimemory.deprecateMemory",
      async (memory: MemoryDto) => {
        if (!memory?.id) {
          await showError("No memory selected.");
          return;
        }

        const confirmed = await confirmDestructiveAction(
          `Deprecate "${memory.title}"? It will be removed from active AI context.`,
          "Deprecate"
        );
        if (!confirmed) return;

        try {
          await client.memories.deprecate(memory.id);
          await showInfo(`Memory "${memory.title}" deprecated.`);

          const folder = getActiveFolder();
          const resolveResult = folder
            ? lifecycle.getCachedResult(folder.uri.toString())
            : undefined;

          if (resolveResult) {
            await refreshProviders(client, resolveResult.project.id, resolveResult.project.name, memoriesProvider, contextProvider);
          }
        } catch (error) {
          const msg = error instanceof Error ? error.message : "Unknown error";
          await showError(`Failed to deprecate memory: ${msg}`);
        }
      }
    )
  );

  // -----------------------------------------------------------------------
  // aimemory.archiveMemory — Soft-archive (delete) a memory
  // -----------------------------------------------------------------------
  disposables.push(
    vscode.commands.registerCommand(
      "aimemory.archiveMemory",
      async (memory: MemoryDto) => {
        if (!memory?.id) {
          await showError("No memory selected.");
          return;
        }

        const confirmed = await confirmDestructiveAction(
          `Archive "${memory.title}"? This cannot be undone from the extension.`,
          "Archive"
        );
        if (!confirmed) return;

        try {
          await client.memories.archive(memory.id);
          await showInfo(`Memory "${memory.title}" archived.`);

          const folder = getActiveFolder();
          const resolveResult = folder
            ? lifecycle.getCachedResult(folder.uri.toString())
            : undefined;

          if (resolveResult) {
            await refreshProviders(client, resolveResult.project.id, resolveResult.project.name, memoriesProvider, contextProvider);
          }
        } catch (error) {
          const msg = error instanceof Error ? error.message : "Unknown error";
          await showError(`Failed to archive memory: ${msg}`);
        }
      }
    )
  );

  return disposables;
}

function getActiveFolder(): vscode.WorkspaceFolder | undefined {
  const activeUri = vscode.window.activeTextEditor?.document.uri;
  if (activeUri) {
    const folder = vscode.workspace.getWorkspaceFolder(activeUri);
    if (folder) return folder;
  }
  return vscode.workspace.workspaceFolders?.[0];
}

async function refreshProviders(
  client: AiMemoryClient,
  projectId: string,
  projectName: string,
  memoriesProvider: MemoriesTreeDataProvider,
  contextProvider: ContextTreeDataProvider
): Promise<void> {
  const budget = vscode.workspace.getConfiguration().get<number>(CONFIG.CONTEXT_BUDGET) ?? 8000;

  memoriesProvider.setLoading(true);
  contextProvider.setLoading(true);

  await Promise.allSettled([
    client.memories.list(projectId, { status: "ACTIVE" }).then((memories) => {
      memoriesProvider.setMemories(memories, projectName);
    }).catch((err: unknown) => {
      memoriesProvider.setError(err instanceof Error ? err.message : "Failed to load memories");
    }),
    client.context.get(projectId, { budget }).then((result) => {
      contextProvider.setContextResult(result);
    }).catch((err: unknown) => {
      contextProvider.setError(err instanceof Error ? err.message : "Failed to load context");
    }),
  ]);
}
