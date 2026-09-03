import * as vscode from "vscode";
import { AiMemoryClient, InMemoryCache } from "@aimemory/client-core";
import { VSCodeSecretStorageAdapter } from "../adapters/secret-storage.adapter.js";
import { OutputChannelLogger } from "../adapters/output-channel.logger.js";
import { CONFIG, PLATFORM_ID, EXTENSION_VERSION } from "../constants.js";

/**
 * Creates a fully-configured AiMemoryClient instance using VS Code adapters.
 * All platform integration (SecretStorage, OutputChannel, fetch) is wired here.
 */
export function createAiMemoryClient(
  context: vscode.ExtensionContext,
  logger: OutputChannelLogger
): AiMemoryClient {
  const config = vscode.workspace.getConfiguration();

  const apiUrl: string =
    config.get<string>(CONFIG.API_URL) ?? "http://localhost:3000";

  const logLevel = (config.get<string>(CONFIG.LOG_LEVEL) ?? "INFO") as
    | "DEBUG"
    | "INFO"
    | "WARN"
    | "ERROR";
  logger.setLevel(logLevel);

  const storage = new VSCodeSecretStorageAdapter(context.secrets);
  const cache = new InMemoryCache(300); // 300-entry in-memory cache

  return new AiMemoryClient({
    baseUrl: apiUrl,
    platform: PLATFORM_ID,
    clientId: context.globalState.get<string>("aimemory.clientId"),
    storage,
    cache,
    logger,
    timeoutMs: 15000,
    maxRetries: 3,
  });
}
