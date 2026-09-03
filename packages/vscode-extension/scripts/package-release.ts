import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";

const EXTENSION_DIR = path.resolve(__dirname, "..");
const PACKAGE_JSON_PATH = path.join(EXTENSION_DIR, "package.json");
const RELEASES_DIR = path.join(EXTENSION_DIR, "releases");

interface PackageJson {
  name: string;
  displayName: string;
  version: string;
  publisher: string;
  description: string;
  author: string;
  license: string;
  icon?: string;
  repository?: { type: string; url: string };
  homepage?: string;
  bugs?: { url: string };
  categories?: string[];
  keywords?: string[];
}

function log(step: string, message: string) {
  console.log(`\x1b[36m[${step}]\x1b[0m ${message}`);
}

function logSuccess(message: string) {
  console.log(`\x1b[32m✔ ${message}\x1b[0m`);
}

function logError(message: string) {
  console.error(`\x1b[31m✖ ${message}\x1b[0m`);
}

function run(cmd: string, stepName: string) {
  log(stepName, `Running: ${cmd}`);
  try {
    execSync(cmd, {
      cwd: EXTENSION_DIR,
      stdio: "inherit",
      env: { ...process.env, FORCE_COLOR: "1" },
    });
  } catch (err: unknown) {
    logError(`${stepName} failed! Release packaging aborted.`);
    process.exit(1);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const skipTests = args.includes("--skip-tests");
  const force = args.includes("--force");
  const isCleanOnly = args.includes("--clean-only");

  console.log("\n========================================================");
  console.log("  AiMemorySync Extension Release & Packaging Engine     ");
  console.log("========================================================\n");

  // Step 1: Clean previous build artifacts
  log("CLEAN", "Cleaning previous build artifacts...");
  const distDir = path.join(EXTENSION_DIR, "dist");
  if (fs.existsSync(distDir)) {
    fs.rmSync(distDir, { recursive: true, force: true });
  }

  // Remove root .vsix files that might have been created manually
  const rootFiles = fs.readdirSync(EXTENSION_DIR);
  for (const f of rootFiles) {
    if (f.endsWith(".vsix")) {
      fs.rmSync(path.join(EXTENSION_DIR, f), { force: true });
    }
  }
  logSuccess("Cleaned dist/ and root .vsix files.");

  if (isCleanOnly) {
    console.log("Clean completed successfully.");
    process.exit(0);
  }

  // Step 2: Read & Validate package.json metadata
  log("AUDIT", "Validating extension package.json metadata...");
  if (!fs.existsSync(PACKAGE_JSON_PATH)) {
    logError(`package.json not found at ${PACKAGE_JSON_PATH}`);
    process.exit(1);
  }

  const pkg: PackageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, "utf-8"));

  const requiredFields: (keyof PackageJson)[] = [
    "name",
    "displayName",
    "version",
    "publisher",
    "description",
    "license",
  ];

  for (const field of requiredFields) {
    if (!pkg[field]) {
      logError(`Missing mandatory metadata field: "${field}" in package.json`);
      process.exit(1);
    }
  }

  // Check icon exists
  if (pkg.icon) {
    const iconPath = path.join(EXTENSION_DIR, pkg.icon);
    if (!fs.existsSync(iconPath)) {
      logError(`Configured icon "${pkg.icon}" not found at ${iconPath}`);
      process.exit(1);
    }
  }

  logSuccess(`Metadata valid: ${pkg.displayName} (${pkg.name}) v${pkg.version}`);

  // Step 3: Check release target file collision
  if (!fs.existsSync(RELEASES_DIR)) {
    fs.mkdirSync(RELEASES_DIR, { recursive: true });
  }

  const releaseFilename = `${pkg.name}-${pkg.version}.vsix`;
  const releasePath = path.join(RELEASES_DIR, releaseFilename);

  if (fs.existsSync(releasePath) && !force) {
    logError(
      `Release file "${releaseFilename}" already exists in releases/ directory!`
    );
    console.error(
      `\x1b[33mTo release a new version, bump the version first:\n  npm run version:patch\nOr to overwrite the existing local build:\n  npm run package:extension -- --force\x1b[0m\n`
    );
    process.exit(1);
  }

  // Step 4: Quality Gate Validation (Phase 3)
  if (!skipTests) {
    console.log("\n--- Phase 3: Release Validation Quality Gates ---");
    run("npm run typecheck", "TYPECHECK");
    run("npm run lint", "LINT");
    run("npm run test", "TESTS");
    logSuccess("All Quality Gates Passed (typecheck, lint, test suite)!");
  } else {
    log("SKIP", "Quality gates skipped via --skip-tests flag.");
  }

  // Step 5: Build Extension
  console.log("\n--- Building Extension Bundle ---");
  run("npm run build", "BUILD");
  logSuccess("Extension bundle compiled with tsup.");

  // Step 6: Package VSIX
  console.log("\n--- Packaging VSIX ---");
  run(
    `npx @vscode/vsce package --no-dependencies -o "releases/${releaseFilename}"`,
    "PACKAGE"
  );

  // Step 7: Verify generated VSIX
  if (!fs.existsSync(releasePath)) {
    logError(`Expected VSIX not found at ${releasePath}`);
    process.exit(1);
  }

  const stats = fs.statSync(releasePath);
  const sizeKb = (stats.size / 1024).toFixed(2);
  const fileBuffer = fs.readFileSync(releasePath);
  const sha256 = crypto.createHash("sha256").update(fileBuffer).digest("hex");

  console.log("\n========================================================");
  console.log("  VSIX RELEASE PACKAGE GENERATED SUCCESSFULLY!          ");
  console.log("========================================================");
  console.log(`  Package:    ${releaseFilename}`);
  console.log(`  Location:   ${releasePath}`);
  console.log(`  Size:       ${sizeKb} KB`);
  console.log(`  SHA-256:    ${sha256}`);
  console.log("========================================================\n");
  console.log("To install in Antigravity IDE / VS Code:");
  console.log(`  code --install-extension "${releasePath}"`);
  console.log("Or open Extensions View -> ... -> 'Install from VSIX...'\n");
}

main().catch((err) => {
  logError(`Packaging failed: ${err.message}`);
  process.exit(1);
});
