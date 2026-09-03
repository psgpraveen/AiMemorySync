/**
 * Safe diagnostic metadata for logging.
 * NEVER pass API keys, Authorization headers, or raw memory content here.
 */
export interface SafeLogMetadata {
  method?: string;
  url?: string;
  status?: number;
  durationMs?: number;
  retryCount?: number;
  clientId?: string;
  platform?: string;
  projectId?: string;
  memoryId?: string;
  [key: string]: unknown;
}

/**
 * Pluggable logger adapter interface.
 */
export interface LoggerAdapter {
  debug(message: string, metadata?: SafeLogMetadata): void;
  info(message: string, metadata?: SafeLogMetadata): void;
  warn(message: string, metadata?: SafeLogMetadata): void;
  error(message: string, metadata?: SafeLogMetadata): void;
}

/**
 * Default silent no-op logger.
 */
export class NoopLogger implements LoggerAdapter {
  debug(): void {}
  info(): void {}
  warn(): void {}
  error(): void {}
}

/**
 * Standard console logger adapter for development diagnostics.
 */
export class ConsoleLogger implements LoggerAdapter {
  debug(message: string, metadata?: SafeLogMetadata): void {
    console.debug(`[AiMemory:DEBUG] ${message}`, metadata ?? "");
  }

  info(message: string, metadata?: SafeLogMetadata): void {
    console.info(`[AiMemory:INFO] ${message}`, metadata ?? "");
  }

  warn(message: string, metadata?: SafeLogMetadata): void {
    console.warn(`[AiMemory:WARN] ${message}`, metadata ?? "");
  }

  error(message: string, metadata?: SafeLogMetadata): void {
    console.error(`[AiMemory:ERROR] ${message}`, metadata ?? "");
  }
}
