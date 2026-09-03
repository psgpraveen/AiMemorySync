import type { McpServerConfig } from "./types/mcp.js";

export function resolveMcpConfig(): McpServerConfig {
  const apiKey = (process.env.AIMEMORY_API_KEY ?? "").trim();
  let apiUrl = (process.env.AIMEMORY_API_URL ?? "http://localhost:3000").trim();

  // Strip trailing slashes
  apiUrl = apiUrl.replace(/\/+$/, "");

  const debug =
    process.env.AIMEMORY_DEBUG === "true" ||
    process.env.AIMEMORY_DEBUG === "1" ||
    process.argv.includes("--debug");

  return {
    apiUrl,
    apiKey,
    debug,
  };
}
