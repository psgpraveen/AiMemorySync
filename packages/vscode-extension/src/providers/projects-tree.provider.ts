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
      return [
        this.makeItem("Resolving project...", {
          icon: "sync~spin",
          contextValue: "loading",
        }),
      ];
    }

    if (this.errorMessage) {
      return [
        this.makeItem(this.errorMessage, {
          description: "Error",
          tooltip: `Error: ${this.errorMessage}\nCheck output channel for details`,
          icon: "alert",
          contextValue: "error",
        }),
      ];
    }

    if (!this.resolveResult) {
      return [
        this.makeItem("No project resolved", {
          tooltip:
            "Open a workspace with a Git repository or package.json, then run 'AiMemory: Resolve Current Project'.",
          icon: "info",
          contextValue: "empty",
        }),
      ];
    }

    const { project, matchedBy, confidence, canonicalIdentity, isNewlyCreated } =
      this.resolveResult;

    const items: TreeItem[] = [
      this.makeItem(project.name, {
        description: "Project",
        tooltip: `Project Name: ${project.name}`,
        icon: "package",
        contextValue: "projectName",
      }),
      this.makeItem(matchedBy, {
        description: "Match Method",
        tooltip: `Identity matched by: ${matchedBy}`,
        icon: "git-branch",
        contextValue: "matchedBy",
      }),
      this.makeItem(`${confidence}% confidence`, {
        description: "Confidence",
        tooltip: `Identity confidence score: ${confidence}%`,
        icon: "pulse",
        contextValue: "confidence",
      }),
      this.makeItem(project.slug, {
        description: "Slug",
        tooltip: `Project slug: ${project.slug}`,
        icon: "tag",
        contextValue: "slug",
      }),
      this.makeItem(project.status, {
        description: "Status",
        tooltip: `Project status: ${project.status}`,
        icon: project.status === "ACTIVE" ? "circle-filled" : "circle-outline",
        contextValue: "status",
      }),
      this.makeItem(this.truncate(canonicalIdentity, 50), {
        description: "Identity",
        tooltip: `Canonical Identity: ${canonicalIdentity}`,
        icon: "link",
        contextValue: "identity",
      }),
    ];

    if (project.description) {
      items.push(
        this.makeItem(this.truncate(project.description, 60), {
          description: "Description",
          tooltip: project.description,
          icon: "info",
          contextValue: "description",
        })
      );
    }

    if (isNewlyCreated) {
      items.push(
        this.makeItem("Newly created", {
          description: "Provisioned",
          tooltip: "This project was automatically provisioned on first resolution",
          icon: "sparkle",
          contextValue: "new",
        })
      );
    }

    return items;
  }

  private makeItem(
    label: string,
    options?: {
      description?: string;
      tooltip?: string;
      contextValue?: string;
      icon?: string;
    }
  ): vscode.TreeItem {
    const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
    if (options?.description) item.description = options.description;
    if (options?.tooltip) item.tooltip = options.tooltip;
    if (options?.contextValue) item.contextValue = options.contextValue;
    if (options?.icon) item.iconPath = new vscode.ThemeIcon(options.icon);
    return item;
  }

  private truncate(str: string, maxLen: number): string {
    return str.length > maxLen ? str.slice(0, maxLen - 1) + "…" : str;
  }
}
