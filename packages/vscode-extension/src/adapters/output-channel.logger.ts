import * as vscode from "vscode";
import type { LoggerAdapter, SafeLogMetadata } from "@aimemory/client-core";
import { OUTPUT_CHANNEL_NAME } from "../constants.js";

type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

const LEVEL_RANK: Record<LogLevel, number> = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

/**
 * Bridges VS Code's OutputChannel to the @aimemory/client-core LoggerAdapter.
 *
 * SECURITY:
 * - Authorization headers and API key values are NEVER logged.
 * - Raw memory content is NOT included in structured log output.
 * - Only safe diagnostic metadata defined in SafeLogMetadata is serialized.
 */
export class OutputChannelLogger implements LoggerAdapter {
  private readonly channel: vscode.OutputChannel;
  private minLevel: LogLevel;

  constructor(level: LogLevel = "INFO") {
    this.channel = vscode.window.createOutputChannel(OUTPUT_CHANNEL_NAME);
    this.minLevel = level;
  }

  setLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  /** Exposes the underlying output channel so callers can call .show() */
  getChannel(): vscode.OutputChannel {
    return this.channel;
  }

  debug(message: string, metadata?: SafeLogMetadata): void {
    this.log("DEBUG", message, metadata);
  }

  info(message: string, metadata?: SafeLogMetadata): void {
    this.log("INFO", message, metadata);
  }

  warn(message: string, metadata?: SafeLogMetadata): void {
    this.log("WARN", message, metadata);
  }

  error(message: string, metadata?: SafeLogMetadata): void {
    this.log("ERROR", message, metadata);
  }

  dispose(): void {
    this.channel.dispose();
  }

  private log(level: LogLevel, message: string, metadata?: SafeLogMetadata): void {
    if (LEVEL_RANK[level] < LEVEL_RANK[this.minLevel]) return;

    const ts = new Date().toISOString();
    const prefix = `[${ts}] [${level.padEnd(5)}] [AiMemory]`;

    if (metadata && Object.keys(metadata).length > 0) {
      // Only serialize safe diagnostic fields — never log authorization or key values
      const safe = this.sanitize(metadata);
      this.channel.appendLine(`${prefix} ${message} ${JSON.stringify(safe)}`);
    } else {
      this.channel.appendLine(`${prefix} ${message}`);
    }
  }

  /** Strips any accidental sensitive fields from metadata before logging */
  private sanitize(metadata: SafeLogMetadata): SafeLogMetadata {
    const forbiddenSubstrings = ["key", "secret", "token", "password", "auth"];
    const sanitized: SafeLogMetadata = {};
    for (const [key, value] of Object.entries(metadata)) {
      const lower = key.toLowerCase();
      // Keep safe diagnostic fields explicitly allowed
      if (lower === "safeStatus" || lower === "method" || lower === "url" || lower === "status" || lower === "durationms" || lower === "retrycount" || lower === "platform" || lower === "clientid" || lower === "projectid" || lower === "memoryid") {
        sanitized[key] = value;
        continue;
      }
      // Strip any key that contains sensitive keywords
      if (forbiddenSubstrings.some((sub) => lower.includes(sub))) {
        continue;
      }
      sanitized[key] = value;
    }
    return sanitized;
  }
}
