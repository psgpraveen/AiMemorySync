import * as path from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "tsup";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  entry: { extension: path.resolve(__dirname, "src/extension.ts") },
  tsconfig: path.resolve(__dirname, "tsconfig.json"),
  format: ["cjs"],          // VS Code extensions must be CommonJS
  target: "node18",
  platform: "node",
  external: ["vscode"],     // vscode is provided at runtime by the extension host
  outDir: path.resolve(__dirname, "dist"),
  bundle: true,
  minify: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  dts: false,               // VS Code extensions don't need declaration files
  noExternal: [
    "@aimemory/client-core", // Bundle the local SDK into the extension
  ],
});
