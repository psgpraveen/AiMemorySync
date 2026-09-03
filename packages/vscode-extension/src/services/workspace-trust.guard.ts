import * as vscode from "vscode";

/**
 * Enforces VS Code Workspace Trust policy.
 *
 * In untrusted workspaces, automatic signal extraction and network requests
 * are blocked to prevent a malicious workspace from triggering unintended
 * API calls or leaking workspace information.
 *
 * Ref: https://code.visualstudio.com/api/extension-guides/workspace-trust
 */
export class WorkspaceTrustGuard {
  /**
   * Returns true if the current workspace is fully trusted.
   * Returns false if the workspace is untrusted or if trust status is unknown.
   */
  isTrusted(): boolean {
    return vscode.workspace.isTrusted;
  }

  /**
   * Returns true if the given workspace folder is in a trusted workspace.
   * Since VS Code applies trust at workspace level, this delegates to isTrusted().
   */
  isFolderTrusted(_folder: vscode.WorkspaceFolder): boolean {
    return vscode.workspace.isTrusted;
  }

  /**
   * Registers a callback to be called when workspace trust changes.
   * Returns a Disposable that unregisters the listener.
   */
  onTrustChange(callback: (trusted: boolean) => void): vscode.Disposable {
    return vscode.workspace.onDidGrantWorkspaceTrust(() => {
      callback(vscode.workspace.isTrusted);
    });
  }
}
