import * as path from "path";
import { runTests } from "@vscode/test-electron";

async function main() {
  try {
    // The folder containing the Extension Manifest package.json
    // Passed to `--extensionDevelopmentPath`
    const extensionDevelopmentPath = path.resolve(__dirname, "../../");

    // The path to the extension test runner script
    // Passed to --extensionTestsPath
    const extensionTestsPath = path.resolve(__dirname, "./suite/index.js");

    console.log("Launching real VS Code Extension Development Host via @vscode/test-electron...");
    console.log(`Extension Development Path: ${extensionDevelopmentPath}`);
    console.log(`Extension Tests Path: ${extensionTestsPath}`);

    const testSandboxDir = path.resolve(__dirname, "../../.vscode-test");
    const userDataDir = path.join(testSandboxDir, "user-data");
    const extensionsDir = path.join(testSandboxDir, "extensions");

    // Run the integration test in isolated sandbox
    await runTests({
      version: "1.136.1",
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: [
        `--user-data-dir=${userDataDir}`,
        `--extensions-dir=${extensionsDir}`,
        "--disable-extensions",
        "--disable-gpu",
        "--disable-updates",
        "--no-sandbox",
      ],
    });

    console.log("VS Code Extension Host execution finished successfully.");
  } catch (err) {
    console.error("Failed to run VS Code Extension Host tests:", err);
    process.exit(1);
  }
}

main();
