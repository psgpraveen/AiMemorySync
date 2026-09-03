const vscode = require("vscode");
const assert = require("assert");

async function runExtensionHostTests() {
  console.log("\n==========================================================");
  console.log("REAL VS CODE EXTENSION HOST TESTS (@vscode/test-electron)");
  console.log("==========================================================\n");

  // 1. Verify extension is loaded in the extension registry
  console.log("1. Checking extension registration in VS Code Extension Host...");
  const extension = vscode.extensions.getExtension("aimemory.aimemory-vscode");
  assert.ok(extension, "Extension aimemory.aimemory-vscode was not found in VS Code extension registry!");
  console.log(`   ✔ Found extension: ${extension.id} (version: ${extension.packageJSON.version})`);

  // 2. Activate extension
  console.log("\n2. Activating extension in Extension Host...");
  if (!extension.isActive) {
    await extension.activate();
  }
  assert.strictEqual(extension.isActive, true, "Extension failed to activate in VS Code!");
  console.log("   ✔ Extension successfully activated without unhandled errors");

  // 3. Verify all 12 registered commands in VS Code command registry
  console.log("\n3. Verifying registered VS Code commands...");
  const allCommands = await vscode.commands.getCommands(true);
  const requiredCommands = [
    "aimemory.setApiKey",
    "aimemory.removeApiKey",
    "aimemory.checkConnection",
    "aimemory.resolveProject",
    "aimemory.copyContext",
    "aimemory.previewContext",
    "aimemory.openDashboard",
    "aimemory.refreshAll",
    "aimemory.addMemory",
    "aimemory.editMemory",
    "aimemory.deprecateMemory",
    "aimemory.archiveMemory",
  ];

  for (const cmd of requiredCommands) {
    const isRegistered = allCommands.includes(cmd);
    assert.ok(isRegistered, `Required command '${cmd}' was NOT registered in VS Code!`);
    console.log(`   ✔ Command registered: ${cmd}`);
  }

  // 4. Test command execution in real VS Code runtime
  console.log("\n4. Testing command execution in Extension Host...");
  // Test checkConnection command execution (should execute handler cleanly)
  try {
    await vscode.commands.executeCommand("aimemory.checkConnection");
    console.log("   ✔ Executed 'aimemory.checkConnection' successfully");
  } catch (err) {
    // Should not throw unhandled exception
    console.error("   ✖ Failed to execute 'aimemory.checkConnection':", err);
    throw err;
  }

  console.log("\n==========================================================");
  console.log("ALL REAL EXTENSION HOST TESTS PASSED IN VS CODE!");
  console.log("==========================================================\n");
}

module.exports = { runExtensionHostTests };
