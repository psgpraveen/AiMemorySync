import * as vscode from "vscode";
import type { SecureStorageAdapter } from "@aimemory/client-core";

/**
 * Bridges VS Code's OS-backed encrypted SecretStorage to the @aimemory/client-core
 * SecureStorageAdapter interface.
 *
 * SECURITY:
 * - API keys are stored exclusively in VS Code's SecretStorage, which maps to:
 *   - macOS:   Keychain
 *   - Windows: Windows Credential Manager
 *   - Linux:   libsecret / gnome-keyring
 * - Keys are NEVER written to disk, settings.json, or globalState.
 * - If SecretStorage is unavailable (e.g., headless CI), failures are surfaced
 *   as informational errors — no silent fallback to plaintext storage.
 */
export class VSCodeSecretStorageAdapter implements SecureStorageAdapter {
  constructor(private readonly secrets: vscode.SecretStorage) {}

  async get(key: string): Promise<string | null> {
    try {
      const value = await this.secrets.get(key);
      return value ?? null;
    } catch {
      // SecretStorage unavailable — return null so the caller can handle missing auth
      return null;
    }
  }

  async set(key: string, value: string): Promise<void> {
    await this.secrets.store(key, value);
  }

  async delete(key: string): Promise<void> {
    await this.secrets.delete(key);
  }
}
