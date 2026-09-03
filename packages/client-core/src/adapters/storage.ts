/**
 * Abstract interface for platform-delegated secure credential storage.
 * In VS Code / Cursor: maps to context.secrets.
 * In Browser: maps to IndexedDB with WebCrypto or secure storage extension.
 * In Node CLI: maps to OS Keyring / keytar.
 */
export interface SecureStorageAdapter {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}

/**
 * Ephemeral In-Memory storage adapter.
 * Intended ONLY for unit testing, non-persistent CLI runs, or ephemeral sessions.
 * Note: This does not persist or encrypt tokens at rest.
 */
export class EphemeralStorageAdapter implements SecureStorageAdapter {
  private store = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async clear(): Promise<void> {
    this.store.clear();
  }
}
