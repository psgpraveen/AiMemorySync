import { NextRequest, NextResponse } from "next/server";
import { SimpleZipBuilder } from "@/lib/zip-builder";
import { ValidationError } from "@/lib/errors";
import { handleApiError } from "@/lib/api/error-handler";
import fs from "fs";
import path from "path";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ integrationId: string }> }
) {
  try {
    const { integrationId } = await context.params;

    if (integrationId.toLowerCase() !== "antigravity") {
      throw new ValidationError(
        `Direct plugin download is currently not supported for '${integrationId}'`
      );
    }

    const zip = new SimpleZipBuilder();

    // 1. Generic mcp_config.json
    const mcpConfig = JSON.stringify(
      {
        mcpServers: {
          aimemory: {
            command: "node",
            args: ["packages/mcp-server/dist/index.js"],
            env: {
              AIMEMORY_API_URL: "http://localhost:3000",
              AIMEMORY_API_KEY: "PASTE_YOUR_API_KEY_HERE",
            },
          },
        },
      },
      null,
      2
    );
    zip.addFile("mcp_config.json", mcpConfig);

    // 2. Read template files directly from repository if available, else use embedded clean fallbacks
    const pluginDir = path.resolve(process.cwd(), ".agents/plugins/aimemory");

    const readPluginFile = (relPath: string, fallback: string): string => {
      try {
        const fullPath = path.join(pluginDir, relPath);
        if (fs.existsSync(fullPath)) {
          return fs.readFileSync(fullPath, "utf-8");
        }
      } catch {
        // Fallback
      }
      return fallback;
    };

    const guardrailsContent = readPluginFile(
      "rules/aimemory-guardrails.md",
      `# AiMemorySync Guardrails & Safety Rules\n\n## 1. Anti-Poisoning\nNever save secrets, credentials, or API keys into memory.\n`
    );
    zip.addFile("rules/aimemory-guardrails.md", guardrailsContent);

    const contextSkillContent = readPluginFile(
      "skills/aimemory-context/SKILL.md",
      `---\nname: aimemory-context\ndescription: Retrieves persistent project memory context.\n---\n`
    );
    zip.addFile("skills/aimemory-context/SKILL.md", contextSkillContent);

    const captureSkillContent = readPluginFile(
      "skills/aimemory-capture/SKILL.md",
      `---\nname: aimemory-capture\ndescription: Explicitly records verified decisions into persistent memory.\n---\n`
    );
    zip.addFile("skills/aimemory-capture/SKILL.md", captureSkillContent);

    // 3. Plugin README
    const readme = `# AiMemorySync Antigravity Plugin

## Installation
Extract the contents of this archive directly into your project's \`.agents/plugins/aimemory/\` directory:

\`\`\`text
your-project/
└── .agents/
    └── plugins/
        └── aimemory/
            ├── mcp_config.json
            ├── rules/
            │   └── aimemory-guardrails.md
            └── skills/
                ├── aimemory-context/
                │   └── SKILL.md
                └── aimemory-capture/
                    └── SKILL.md
\`\`\`

## Configuration
Edit \`mcp_config.json\` and replace \`PASTE_YOUR_API_KEY_HERE\` with your active secret key.
`;
    zip.addFile("README.md", readme);

    const zipBuffer = zip.build();

    return new NextResponse(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": 'attachment; filename="antigravity-aimemory-plugin.zip"',
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
