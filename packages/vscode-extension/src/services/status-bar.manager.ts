import * as vscode from "vscode";
import { COMMANDS } from "../constants.js";

export type StatusBarState =
  | "disconnected"
  | "connecting"
  | "resolving"
  | "connected"
  | "rate-limited"
  | "error"
  | "untrusted";

/**
 * Manages the AiMemory status bar item in the VS Code status bar.
 *
 * State transitions:
 *   disconnected → connecting → resolving → connected
 *                                         ↓
 *                                    rate-limited / error
 */
export class StatusBarManager {
  private readonly item: vscode.StatusBarItem;
  private currentState: StatusBarState = "disconnected";
  private rateLimitRetrySeconds = 0;
  private rateLimitTimer?: ReturnType<typeof setInterval>;

  constructor() {
    this.item = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100 // Priority — higher number = further right
    );
    this.update("disconnected");
  }

  getState(): StatusBarState {
    return this.currentState;
  }

  setDisconnected(): void {
    this.clearRateLimitTimer();
    this.update("disconnected");
  }

  setConnecting(): void {
    this.clearRateLimitTimer();
    this.update("connecting");
  }

  setResolving(): void {
    this.clearRateLimitTimer();
    this.update("resolving");
  }

  setConnected(projectName: string, matchedBy: string): void {
    this.clearRateLimitTimer();
    this.update("connected", { projectName, matchedBy });
  }

  setRateLimited(retryAfterSeconds: number): void {
    this.rateLimitRetrySeconds = retryAfterSeconds;
    this.update("rate-limited", { retrySeconds: this.rateLimitRetrySeconds });

    this.clearRateLimitTimer();
    this.rateLimitTimer = setInterval(() => {
      this.rateLimitRetrySeconds = Math.max(0, this.rateLimitRetrySeconds - 1);
      if (this.rateLimitRetrySeconds <= 0) {
        this.clearRateLimitTimer();
        this.setDisconnected();
      } else {
        this.update("rate-limited", { retrySeconds: this.rateLimitRetrySeconds });
      }
    }, 1000);
  }

  setError(): void {
    this.clearRateLimitTimer();
    this.update("error");
  }

  setUntrusted(): void {
    this.clearRateLimitTimer();
    this.update("untrusted");
  }

  show(): void {
    this.item.show();
  }

  hide(): void {
    this.item.hide();
  }

  dispose(): void {
    this.clearRateLimitTimer();
    this.item.dispose();
  }

  private update(
    state: StatusBarState,
    data?: { projectName?: string; matchedBy?: string; retrySeconds?: number }
  ): void {
    this.currentState = state;

    switch (state) {
      case "disconnected":
        this.item.text = "$(circle-slash) AiMemory";
        this.item.tooltip = "AiMemorySync: No API Key configured. Click to connect.";
        this.item.command = COMMANDS.SET_API_KEY;
        this.item.backgroundColor = undefined;
        break;

      case "connecting":
        this.item.text = "$(sync~spin) AiMemory: Connecting";
        this.item.tooltip = "AiMemorySync: Validating API key...";
        this.item.command = undefined;
        this.item.backgroundColor = undefined;
        break;

      case "resolving":
        this.item.text = "$(sync~spin) AiMemory: Resolving";
        this.item.tooltip = "AiMemorySync: Resolving project identity for workspace...";
        this.item.command = undefined;
        this.item.backgroundColor = undefined;
        break;

      case "connected":
        this.item.text = `$(check) AiMemory: ${data?.projectName ?? "Connected"}`;
        this.item.tooltip = `AiMemorySync — Project: ${data?.projectName ?? "Unknown"}\nMatched by: ${data?.matchedBy ?? "unknown"}\nClick to open dashboard`;
        this.item.command = COMMANDS.OPEN_DASHBOARD;
        this.item.backgroundColor = undefined;
        break;

      case "rate-limited":
        this.item.text = `$(history) AiMemory: Rate Limited`;
        this.item.tooltip = `AiMemorySync: Rate limit active. Resuming in ${data?.retrySeconds ?? 0}s...`;
        this.item.command = undefined;
        this.item.backgroundColor = new vscode.ThemeColor(
          "statusBarItem.warningBackground"
        );
        break;

      case "error":
        this.item.text = "$(alert) AiMemory: Offline";
        this.item.tooltip = "AiMemorySync: Backend unreachable. Click to retry.";
        this.item.command = COMMANDS.RESOLVE_PROJECT;
        this.item.backgroundColor = new vscode.ThemeColor(
          "statusBarItem.errorBackground"
        );
        break;

      case "untrusted":
        this.item.text = "$(shield) AiMemory: Untrusted";
        this.item.tooltip =
          "AiMemorySync: Workspace not trusted. Trust this workspace to enable AI memory.";
        this.item.command = undefined;
        this.item.backgroundColor = new vscode.ThemeColor(
          "statusBarItem.warningBackground"
        );
        break;
    }
  }

  private clearRateLimitTimer(): void {
    if (this.rateLimitTimer !== undefined) {
      clearInterval(this.rateLimitTimer);
      this.rateLimitTimer = undefined;
    }
  }
}
