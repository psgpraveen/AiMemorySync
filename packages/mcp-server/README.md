# @aimemory/mcp-server

Universal Model Context Protocol (MCP) server for **AiMemorySync**.

Connects AI coding assistants (Antigravity, Claude Desktop, ChatGPT, Cursor, VS Code AI) directly to persistent project memory.

## Features

- **8 AI Tools**:
  - `aimemory_resolve_project`: Auto-resolves repository identity without leaking local machine paths.
  - `aimemory_get_current_project`: Inspects currently resolved session project state.
  - `aimemory_get_context`: Formats token/character-budgeted Markdown AI context.
  - `aimemory_list_memories`: Queries project memories with category and priority filters.
  - `aimemory_create_memory`: Explicitly creates persistent memories with pre-flight secret guardrails.
  - `aimemory_update_memory`: Updates existing memory items.
  - `aimemory_deprecate_memory`: Soft-deprecates superseded memories.
  - `aimemory_archive_memory`: Soft-archives memories.
- **Dynamic Resource**:
  - `aimemory://projects/{id}/context`: Direct Markdown resource reading.
- **Security**:
  - Zero direct database access (built on `@aimemory/client-core`).
  - Stdio transport isolation (`process.stdout` reserved exclusively for JSON-RPC).
  - Targeted regex redaction of keys and authorization tokens in `process.stderr`.

## Configuration

Set the following environment variables:

- `AIMEMORY_API_KEY`: Your AiMemorySync secret key (`aimem_live_...`).
- `AIMEMORY_API_URL`: Backend URL (defaults to `http://localhost:3000`).
