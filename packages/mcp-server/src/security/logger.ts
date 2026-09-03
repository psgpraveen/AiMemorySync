/**
 * Stderr-only logger with pattern-based sensitive credential redaction.
 *
 * CRITICAL RULE: Standard output (`process.stdout`) is strictly reserved for JSON-RPC framing
 * in MCP Stdio transports. All diagnostic output, errors, and traces MUST write to `process.stderr`.
 */

export class McpLogger {
  constructor(private readonly debugEnabled: boolean = false) {}

  /**
   * Redacts sensitive patterns without corrupting legitimate words like 'project key', 'package key', etc.
   */
  public sanitize(message: string): string {
    return message
      // Redact live and test API keys (aimem_live_..., aimem_test_...)
      .replace(/aimem_(?:live|test)_[a-zA-Z0-9_-]{16,}/g, "[REDACTED_API_KEY]")
      // Redact Bearer tokens
      .replace(/(Bearer\s+)[a-zA-Z0-9_.-]{16,}/gi, "$1[REDACTED_TOKEN]")
      // Redact JSON credential values: "apiKey": "...", "token": "...", "password": "...", "secret": "..."
      .replace(
        /("(?:apiKey|token|password|secret|authorization)"\s*:\s*)"[^"]+"/gi,
        '$1"[REDACTED]"'
      )
      // Redact standard local absolute machine drive paths if detected (e.g. C:\Users\... or D:\...)
      .replace(/(?:[a-zA-Z]:|\/home|\/Users)\\[\w.-]+(?:\\[\w.-]+)*/g, "[REDACTED_LOCAL_PATH]");
  }

  public info(message: string, meta?: unknown): void {
    const timestamp = new Date().toISOString();
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : "";
    process.stderr.write(`[INFO] [${timestamp}] ${this.sanitize(message + metaStr)}\n`);
  }

  public warn(message: string, meta?: unknown): void {
    const timestamp = new Date().toISOString();
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : "";
    process.stderr.write(`[WARN] [${timestamp}] ${this.sanitize(message + metaStr)}\n`);
  }

  public error(message: string, error?: unknown): void {
    const timestamp = new Date().toISOString();
    let errStr = "";
    if (error instanceof Error) {
      errStr = ` ${error.name}: ${error.message}`;
    } else if (error) {
      errStr = ` ${JSON.stringify(error)}`;
    }
    process.stderr.write(`[ERROR] [${timestamp}] ${this.sanitize(message + errStr)}\n`);
  }

  public debug(message: string, meta?: unknown): void {
    if (!this.debugEnabled) return;
    const timestamp = new Date().toISOString();
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : "";
    process.stderr.write(`[DEBUG] [${timestamp}] ${this.sanitize(message + metaStr)}\n`);
  }
}
