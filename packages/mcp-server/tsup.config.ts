import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node18",
  dts: true,
  clean: true,
  sourcemap: true,
  minify: false,
  banner: {
    js: "#!/usr/bin/env node\n",
  },
  noExternal: ["@aimemory/client-core"],
  outExtension({ format }) {
    return {
      js: ".js",
      dts: ".d.ts",
    };
  },
});
