import type { AiMemoryClient } from "@aimemory/client-core";

/**
 * Module-level singleton holder for the active AiMemoryClient instance.
 *
 * The client is created during extension activation and replaced if the user
 * changes the API URL setting (requires a reload). Access via getClient() and
 * check isInitialized() before accessing.
 */
let _client: AiMemoryClient | null = null;

export function setClient(client: AiMemoryClient): void {
  _client = client;
}

export function getClient(): AiMemoryClient | null {
  return _client;
}

export function isInitialized(): boolean {
  return _client !== null;
}

export function clearClient(): void {
  _client = null;
}
