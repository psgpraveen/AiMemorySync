import { runAuthTests } from "./auth.test.js";
import { runToolsTests } from "./tools.test.js";
import { runIntegrationTests } from "./integration.test.js";
import { runContinuityTest } from "./e2e-continuity.test.js";

async function runAll() {
  console.log("==========================================================");
  console.log("AI-MEMORY-SYNC: Universal MCP Server Test Suite");
  console.log("==========================================================");

  const auth = await runAuthTests();
  const tools = await runToolsTests();
  const integration = await runIntegrationTests();
  const continuityPassed = await runContinuityTest();

  const totalPassed = auth.passed + tools.passed + integration.passed + (continuityPassed ? 1 : 0);
  const totalFailed = auth.failed + tools.failed + integration.failed + (continuityPassed ? 0 : 1);

  console.log("\n==========================================================");
  console.log(`TOTAL MCP TESTS: ${totalPassed} PASSED, ${totalFailed} FAILED`);
  console.log("==========================================================\n");

  if (totalFailed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runAll().catch((err) => {
  console.error("Test runner failed:", err);
  process.exit(1);
});
