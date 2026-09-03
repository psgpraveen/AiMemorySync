import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { AiMemoryClient } from "@aimemory/client-core";
import { resolveMcpConfig } from "./config.js";
import { createMcpServer } from "./server.js";
import { McpLogger } from "./security/logger.js";

async function main() {
  const config = resolveMcpConfig();
  const logger = new McpLogger(config.debug);

  logger.info("Initializing AiMemorySync Universal MCP Server v0.1.0");
  logger.info(`Backend target: ${config.apiUrl}`);

  if (!config.apiKey) {
    logger.error(
      "Missing API key. Set the AIMEMORY_API_KEY environment variable in your MCP configuration."
    );
    process.exit(1);
  }

  const client = new AiMemoryClient({
    baseUrl: config.apiUrl,
    apiKey: config.apiKey,
    timeoutMs: 15000,
  });

  const { server } = createMcpServer(client, config, undefined, logger);
  const transport = new StdioServerTransport();

  await server.connect(transport);
  logger.info("AiMemorySync MCP Server connected and listening on stdio.");

  // Graceful shutdown handling
  const shutdown = async () => {
    logger.info("Shutting down MCP server...");
    await server.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  process.stderr.write(`[FATAL] Unhandled exception in MCP Server: ${err.message}\n`);
  process.exit(1);
});
