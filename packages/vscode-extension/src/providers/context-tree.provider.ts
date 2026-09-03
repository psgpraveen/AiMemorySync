import * as vscode from "vscode";
import type { AssembledContextResult } from "@aimemory/client-core";

type TreeItem = vscode.TreeItem;

/**
 * Tree data provider for the "Context Preview" view (aimemory-context).
 *
 * Displays budget usage, sections summary, and a Copy Context action item.
 */
export class ContextTreeDataProvider
  implements vscode.TreeDataProvider<TreeItem>
{
  private _onDidChangeTreeData = new vscode.EventEmitter<TreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private contextResult: AssembledContextResult | null = null;
  private isLoading = false;
  private errorMessage: string | null = null;

  setLoading(loading: boolean): void {
    this.isLoading = loading;
    this._onDidChangeTreeData.fire();
  }

  setContextResult(result: AssembledContextResult): void {
    this.contextResult = result;
    this.isLoading = false;
    this.errorMessage = null;
    this._onDidChangeTreeData.fire();
  }

  setError(message: string): void {
    this.errorMessage = message;
    this.isLoading = false;
    this._onDidChangeTreeData.fire();
  }

  clear(): void {
    this.contextResult = null;
    this.isLoading = false;
    this.errorMessage = null;
    this._onDidChangeTreeData.fire();
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  /** Returns the assembled markdown for clipboard/preview commands */
  getMarkdown(): string | null {
    return this.contextResult?.markdown ?? null;
  }

  getTreeItem(element: TreeItem): TreeItem {
    return element;
  }

  getChildren(_element?: TreeItem): TreeItem[] {
    if (this.isLoading) {
      return [
        this.makeItem("$(sync~spin) Assembling context...", undefined),
      ];
    }

    if (this.errorMessage) {
      return [
        this.makeItem(`$(alert) ${this.errorMessage}`, "Check output channel for details"),
      ];
    }

    if (!this.contextResult) {
      return [
        this.makeItem(
          "$(info) No context available",
          "Resolve a project first, then use 'AiMemory: Copy Project Context to Clipboard'."
        ),
      ];
    }

    const { budget, includedMemories } = this.contextResult;

    const used = budget.usedCharacters;
    const requested = budget.requested;
    const budgetPct = requested > 0 ? Math.round((used / requested) * 100) : 0;
    const budgetBar = this.buildBudgetBar(budgetPct);

    const items: TreeItem[] = [
      this.makeItem(
        `$(graph) Budget: ${used.toLocaleString()} / ${requested.toLocaleString()} chars (${budgetPct}%)`,
        `${budgetBar}\n\n${used} of ${requested} character budget used`
      ),
      this.makeItem(
        `$(list-unordered) Memories: ${budget.itemCount} included`,
        `${budget.itemCount} memories included within character budget out of ${includedMemories.length} total assembled`
      ),
    ];

    // Copy action item
    const copyItem = new vscode.TreeItem(
      "$(clippy) Copy Context to Clipboard",
      vscode.TreeItemCollapsibleState.None
    );
    copyItem.command = {
      command: "aimemory.copyContext",
      title: "Copy Context",
    };
    copyItem.tooltip = "Copy the assembled project context as Markdown to clipboard";
    copyItem.contextValue = "copyAction";
    items.push(copyItem);

    // Preview action item
    const previewItem = new vscode.TreeItem(
      "$(preview) Preview in Editor",
      vscode.TreeItemCollapsibleState.None
    );
    previewItem.command = {
      command: "aimemory.previewContext",
      title: "Preview Context",
    };
    previewItem.tooltip = "Open a read-only Markdown preview of the assembled context";
    previewItem.contextValue = "previewAction";
    items.push(previewItem);

    return items;
  }

  private makeItem(label: string, tooltip?: string): vscode.TreeItem {
    const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
    if (tooltip) item.tooltip = tooltip;
    return item;
  }

  private buildBudgetBar(pct: number): string {
    const filled = Math.round(pct / 10);
    const empty = 10 - filled;
    return `[${"█".repeat(filled)}${"░".repeat(empty)}] ${pct}%`;
  }
}
