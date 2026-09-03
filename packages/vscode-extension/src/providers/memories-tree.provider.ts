import * as vscode from "vscode";
import type { MemoryDto, MemoryType } from "@aimemory/client-core";

// Tree node types
export type MemoryNode = MemoryGroupNode | MemoryItemNode;

export class MemoryGroupNode {
  readonly kind = "group" as const;
  constructor(
    public readonly type: MemoryType,
    public readonly memories: MemoryDto[]
  ) {}
}

export class MemoryItemNode {
  readonly kind = "item" as const;
  constructor(public readonly memory: MemoryDto) {}
}

const TYPE_LABELS: Record<MemoryType, string> = {
  DECISION: "Decisions",
  REQUIREMENT: "Requirements",
  CONVENTION: "Conventions",
  BUG_SOLUTION: "Bug Solutions",
};

const TYPE_THEME_ICONS: Record<MemoryType, string> = {
  DECISION: "milestone",
  REQUIREMENT: "checklist",
  CONVENTION: "book",
  BUG_SOLUTION: "bug",
};

const PRIORITY_THEME_ICONS: Record<string, string> = {
  CRITICAL: "flame",
  HIGH: "arrow-up",
  NORMAL: "dash",
  LOW: "arrow-down",
};

/**
 * Tree data provider for the "Project Memories" view (aimemory-memories).
 *
 * Memories are grouped by type (DECISION, REQUIREMENT, CONVENTION, BUG_SOLUTION)
 * and show priority icons inline. Each leaf node has contextValue "memoryItem"
 * so the view/item/context menus for edit/deprecate/archive appear.
 */
export class MemoriesTreeDataProvider
  implements vscode.TreeDataProvider<MemoryNode>
{
  private _onDidChangeTreeData = new vscode.EventEmitter<MemoryNode | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private memories: MemoryDto[] = [];
  private isLoading = false;
  private errorMessage: string | null = null;
  private projectName: string | null = null;

  setLoading(loading: boolean): void {
    this.isLoading = loading;
    this._onDidChangeTreeData.fire();
  }

  setMemories(memories: MemoryDto[], projectName: string): void {
    this.memories = memories;
    this.projectName = projectName;
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
    this.memories = [];
    this.projectName = null;
    this.isLoading = false;
    this.errorMessage = null;
    this._onDidChangeTreeData.fire();
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: MemoryNode): vscode.TreeItem {
    if (element.kind === "group") {
      return this.buildGroupItem(element);
    }
    return this.buildMemoryItem(element);
  }

  getChildren(element?: MemoryNode): MemoryNode[] {
    // Loading state
    if (this.isLoading) {
      return [];
    }

    // Error state
    if (this.errorMessage) {
      return [];
    }

    // Top-level: return group nodes
    if (!element) {
      if (this.memories.length === 0 && !this.isLoading) {
        return []; // Show empty state via welcome view
      }

      const groups = this.buildGroups();
      return groups;
    }

    // Group level: return memory items
    if (element.kind === "group") {
      return element.memories.map((m) => new MemoryItemNode(m));
    }

    return [];
  }

  private buildGroups(): MemoryGroupNode[] {
    const activeMemories = this.memories.filter((m) => m.status === "ACTIVE");
    const byType = new Map<MemoryType, MemoryDto[]>();

    const order: MemoryType[] = ["DECISION", "REQUIREMENT", "CONVENTION", "BUG_SOLUTION"];
    for (const type of order) {
      byType.set(type, []);
    }

    for (const memory of activeMemories) {
      const group = byType.get(memory.type);
      if (group) group.push(memory);
    }

    return order
      .filter((type) => (byType.get(type)?.length ?? 0) > 0)
      .map((type) => new MemoryGroupNode(type, byType.get(type)!));
  }

  private buildGroupItem(node: MemoryGroupNode): vscode.TreeItem {
    const label = TYPE_LABELS[node.type];
    const item = new vscode.TreeItem(
      label,
      vscode.TreeItemCollapsibleState.Expanded
    );
    item.description = `${node.memories.length}`;
    item.tooltip = `${label} (${node.memories.length} active)`;
    item.iconPath = new vscode.ThemeIcon(TYPE_THEME_ICONS[node.type] ?? "folder");
    item.contextValue = "memoryGroup";
    return item;
  }

  private buildMemoryItem(node: MemoryItemNode): vscode.TreeItem {
    const { memory } = node;
    const item = new vscode.TreeItem(
      memory.title,
      vscode.TreeItemCollapsibleState.None
    );

    item.iconPath = new vscode.ThemeIcon(
      PRIORITY_THEME_ICONS[memory.priority] ?? "dash"
    );
    item.tooltip = new vscode.MarkdownString(
      `**${memory.title}**\n\n${memory.content}\n\n_Priority: ${memory.priority} · Type: ${memory.type}_`
    );
    item.description = memory.priority.toLowerCase();
    item.contextValue = "memoryItem";

    // Store memory data for commands
    item.command = {
      command: "aimemory.editMemory",
      title: "Edit Memory",
      arguments: [memory],
    };

    return item;
  }

  /** Returns the MemoryDto for a given node (used by commands) */
  getMemoryDto(node: MemoryNode): MemoryDto | null {
    if (node.kind === "item") return node.memory;
    return null;
  }
}
