import * as vscode from "vscode";
import type { ResolveProjectResult } from "@aimemory/client-core";

type TreeItem = vscode.TreeItem;

/**
 * Tree data provider for the "Project Identity" view (aimemory-projects).
 *
 * Displays the resolved project name, match method, confidence,
 * slug, and status as flat tree items.
 */
export class ProjectsTreeDataProvider
  implements vscode.TreeDataProvider<TreeItem>
{
  private _onDidChangeTreeData = new vscode.EventEmitter<TreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private resolveResult: ResolveProjectResult | null = null;
  private isLoading = false;
  private errorMessage: string | null = null;

  setLoading(loading: boolean): void {
    this.isLoading = loading;
    this._onDidChangeTreeData.fire();
  }

  setResolveResult(result: ResolveProjectResult | null): void {
    this.resolveResult = result;
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
    this.resolveResult = null;
    this.isLoading = false;
    this.errorMessage = null;
    this._onDidChangeTreeData.fire();
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: TreeItem): TreeItem {
    return element;
  }

  getChildren(_element?: TreeItem): TreeItem[] {
    if (this.isLoading) {
      return [this.makeItem("$(sync~spin) Resolving project...", undefined, "loading")];
    }

    if (this.errorMessage) {
      return [
        this.makeItem(
          `$(alert) ${this.errorMessage}`,
          "Check output channel for details",
          "error"
        ),
      ];
    }

    if (!this.resolveResult) {
      return [
        this.makeItem(
          "$(info) No project resolved",
          "Open a workspace with a Git repository or package.json, then run 'AiMemory: Resolve Current Project'.",
          "empty"
        ),
      ];
    }

    const { project, matchedBy, confidence, canonicalIdentity, isNewlyCreated } =
      this.resolveResult;

    const items: TreeItem[] = [
      this.makeItem(`$(package) ${project.name}`, "Project Name", "projectName"),
      this.makeItem(
        `$(git-branch) ${matchedBy}`,
        `Identity matched by: ${matchedBy}`,
        "matchedBy"
      ),
      this.makeItem(
        `$(pulse) ${confidence}% confidence`,
        `Identity confidence score`,
        "confidence"
      ),
      this.makeItem(
        `$(tag) ${project.slug}`,
        `Project slug: ${project.slug}`,
        "slug"
      ),
      this.makeItem(
        `$(circle-filled) ${project.status}`,
        `Project status: ${project.status}`,
        "status"
      ),
      this.makeItem(
        `$(link) ${this.truncate(canonicalIdentity, 50)}`,
        `Canonical Identity: ${canonicalIdentity}`,
        "identity"
      ),
    ];

    if (project.description) {
      items.push(
        this.makeItem(
          `$(info) ${this.truncate(project.description, 60)}`,
          project.description,
          "description"
        )
      );
    }

    if (isNewlyCreated) {
      items.push(
        this.makeItem(
          "$(sparkle) Newly created",
          "This project was automatically provisioned on first resolution",
          "new"
        )
      );
    }

    return items;
  }

  private makeItem(
    label: string,
    tooltip?: string,
    contextValue?: string
  ): vscode.TreeItem {
    const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
    if (tooltip) item.tooltip = tooltip;
    if (contextValue) item.contextValue = contextValue;
    return item;
  }

  private truncate(str: string, maxLen: number): string {
    return str.length > maxLen ? str.slice(0, maxLen - 1) + "…" : str;
  }
}
