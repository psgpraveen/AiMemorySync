import * as vscode from "vscode";

/**
 * Standardized notification helpers.
 * All user-facing messages route through these helpers to keep phrasing consistent.
 */

export async function showInfo(
  message: string,
  ...actions: string[]
): Promise<string | undefined> {
  return vscode.window.showInformationMessage(`AiMemorySync: ${message}`, ...actions);
}

export async function showWarning(
  message: string,
  ...actions: string[]
): Promise<string | undefined> {
  return vscode.window.showWarningMessage(`AiMemorySync: ${message}`, ...actions);
}

export async function showError(
  message: string,
  ...actions: string[]
): Promise<string | undefined> {
  return vscode.window.showErrorMessage(`AiMemorySync: ${message}`, ...actions);
}

/** Prompts for an API key, returning trimmed value or undefined if cancelled */
export async function promptApiKey(): Promise<string | undefined> {
  const value = await vscode.window.showInputBox({
    title: "AiMemorySync — Enter API Key",
    prompt:
      "Paste your AiMemorySync API key (starts with aimem_live_). The key will be stored securely in your OS keychain.",
    password: true,
    placeHolder: "aimem_live_...",
    ignoreFocusOut: true,
    validateInput: (value) => {
      if (!value || !value.trim()) return "API key cannot be empty";
      if (!value.trim().startsWith("aimem_")) {
        return "Invalid key format — must start with aimem_live_";
      }
      return null;
    },
  });

  return value?.trim();
}

/** Prompts for memory type via QuickPick */
export async function promptMemoryType(): Promise<
  "DECISION" | "REQUIREMENT" | "CONVENTION" | "BUG_SOLUTION" | undefined
> {
  const types = [
    { label: "$(milestone) Decision", description: "An architectural or technical decision", value: "DECISION" as const },
    { label: "$(checklist) Requirement", description: "A functional or non-functional requirement", value: "REQUIREMENT" as const },
    { label: "$(book) Convention", description: "A coding pattern, style convention, or best practice", value: "CONVENTION" as const },
    { label: "$(bug) Bug Solution", description: "A documented solution to a known bug or issue", value: "BUG_SOLUTION" as const },
  ];

  const selected = await vscode.window.showQuickPick(types, {
    title: "AiMemorySync — Memory Type",
    placeHolder: "Select the type of memory to create",
  });

  return selected?.value;
}

/** Prompts for memory priority */
export async function promptMemoryPriority(): Promise<
  "CRITICAL" | "HIGH" | "NORMAL" | "LOW" | undefined
> {
  const priorities = [
    { label: "$(flame) Critical", description: "Must never be violated", value: "CRITICAL" as const },
    { label: "$(arrow-up) High", description: "Important but not critical", value: "HIGH" as const },
    { label: "$(dash) Normal", description: "Standard importance", value: "NORMAL" as const },
    { label: "$(arrow-down) Low", description: "Nice to know", value: "LOW" as const },
  ];

  const selected = await vscode.window.showQuickPick(priorities, {
    title: "AiMemorySync — Memory Priority",
    placeHolder: "Select priority level",
  });

  return selected?.value;
}

/** Shows a confirmation dialog for destructive actions */
export async function confirmDestructiveAction(
  message: string,
  confirmLabel = "Confirm"
): Promise<boolean> {
  const answer = await vscode.window.showWarningMessage(
    `AiMemorySync: ${message}`,
    { modal: true },
    confirmLabel
  );
  return answer === confirmLabel;
}
