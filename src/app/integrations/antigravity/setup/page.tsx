"use client";

import { useState, useEffect, startTransition } from "react";
import Link from "next/link";
import { Navbar } from "@/components/shared/navbar";
import { CodeBlock } from "@/components/integrations/code-block";
import {
  getApiKey,
  verifyApiKey,
  listApiKeys,
  createApiKey,
  testIntegration,
  ApiKeyDto,
  TestIntegrationResponse,
} from "@/lib/api-client";

export default function AntigravitySetupWizardPage() {
  const [currentStep, setCurrentStep] = useState(1);

  // Step 1: Account
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [isKeyValid, setIsKeyValid] = useState<boolean | null>(null);

  // Step 2: Keys
  const [availableKeys, setAvailableKeys] = useState<ApiKeyDto[]>([]);
  const [selectedKey, setSelectedKey] = useState<string>("");
  const [newKeyName, setNewKeyName] = useState("Antigravity MCP Key");
  const [generatingKey, setGeneratingKey] = useState(false);
  const [newlyGeneratedKey, setNewlyGeneratedKey] = useState<string | null>(null);

  // Step 4: Config
  const [configOption, setConfigOption] = useState<"template" | "withKey">("template");

  // Step 6: Test
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestIntegrationResponse | null>(null);

  useEffect(() => {
    const key = getApiKey();
    if (key) {
      startTransition(() => {
        setActiveKey(key);
        setSelectedKey(key);
      });
      verifyApiKey(key)
        .then((res) => {
          startTransition(() => {
            setIsKeyValid(res.valid);
          });
        })
        .catch(() => {
          startTransition(() => {
            setIsKeyValid(false);
          });
        });
    } else {
      startTransition(() => {
        setIsKeyValid(false);
      });
    }

    listApiKeys()
      .then((keys) => {
        startTransition(() => {
          setAvailableKeys(keys.filter((k) => !k.revokedAt));
        });
      })
      .catch(() => {});
  }, []);

  async function handleGenerateDedicatedKey() {
    setGeneratingKey(true);
    try {
      const res = await createApiKey({
        name: newKeyName,
        scopes: ["read", "write"],
      });
      setNewlyGeneratedKey(res.rawKey);
      setSelectedKey(res.rawKey);
      setActiveKey(res.rawKey);
      setIsKeyValid(true);
      const updated = await listApiKeys();
      setAvailableKeys(updated.filter((k) => !k.revokedAt));
    } catch (err: unknown) {
      if (err instanceof Error) {
        alert(err.message);
      } else {
        alert("Failed to generate key");
      }
    } finally {
      setGeneratingKey(false);
    }
  }

  async function handleRunTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await testIntegration({
        integration: "antigravity",
        apiKey: selectedKey || activeKey || undefined,
      });
      setTestResult(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Network error while running connection test";
      setTestResult({
        success: false,
        message: msg,
        checks: {
          apiReachable: false,
          apiKeyValid: false,
          scopesValid: false,
          mcpReady: false,
        },
      });
    } finally {
      setTesting(false);
    }
  }

  const mcpConfigCode =
    configOption === "withKey" && (selectedKey || activeKey)
      ? JSON.stringify(
          {
            mcpServers: {
              aimemory: {
                command: "node",
                args: ["packages/mcp-server/dist/index.js"],
                env: {
                  AIMEMORY_API_URL: "http://localhost:3000",
                  AIMEMORY_API_KEY: selectedKey || activeKey,
                },
              },
            },
          },
          null,
          2
        )
      : JSON.stringify(
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

  const stepsList = [
    { num: 1, label: "Account" },
    { num: 2, label: "API Key" },
    { num: 3, label: "Install" },
    { num: 4, label: "Configure" },
    { num: 5, label: "Skills" },
    { num: 6, label: "Verify" },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950">
      <Navbar />

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 py-10 sm:px-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
          <Link href="/integrations" className="hover:text-zinc-900 dark:hover:text-zinc-100">
            Integrations
          </Link>
          <span>/</span>
          <Link
            href="/integrations/antigravity"
            className="hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            Antigravity
          </Link>
          <span>/</span>
          <span className="text-zinc-900 dark:text-zinc-100 font-medium">Setup Wizard</span>
        </div>

        {/* Wizard Header */}
        <div className="mt-4 border-b border-zinc-200 pb-6 dark:border-zinc-800">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Antigravity Integration Wizard
          </h1>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Follow these 6 steps to connect the AiMemorySync MCP server directly into Antigravity.
          </p>

          {/* Stepper Progress Bar */}
          <div className="mt-8 flex items-center justify-between">
            {stepsList.map((step) => {
              const isActive = currentStep === step.num;
              const isPast = currentStep > step.num;
              return (
                <button
                  key={step.num}
                  onClick={() => setCurrentStep(step.num)}
                  className="flex flex-col items-center gap-1.5 focus:outline-hidden"
                >
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full font-mono text-xs font-bold transition ${
                      isPast
                        ? "bg-emerald-600 text-white"
                        : isActive
                        ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 ring-4 ring-zinc-200 dark:ring-zinc-800"
                        : "bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                    }`}
                  >
                    {isPast ? "✓" : step.num}
                  </div>
                  <span
                    className={`text-[11px] font-medium ${
                      isActive
                        ? "text-zinc-900 dark:text-zinc-100 font-semibold"
                        : "text-zinc-500 dark:text-zinc-400"
                    }`}
                  >
                    {step.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Wizard Step Body */}
        <div className="mt-8 rounded-xl border border-zinc-200 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 sm:p-8">
          {/* STEP 1: Account / Prerequisites */}
          {currentStep === 1 && (
            <div className="space-y-5">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-100 font-mono text-xs font-bold text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
                  1
                </span>
                <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                  Prerequisites & Account Verification
                </h2>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                Before configuring the integration, ensure the following requirements are met on your machine:
              </p>

              <div className="space-y-2.5 rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-950/40 text-xs">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-zinc-800 dark:text-zinc-200">
                    <span className="text-emerald-500 font-bold">&check;</span>
                    Node.js 18+ runtime installed
                  </span>
                  <code className="text-[11px] text-zinc-500">node -v</code>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-zinc-800 dark:text-zinc-200">
                    <span className="text-emerald-500 font-bold">&check;</span>
                    Antigravity workspace active
                  </span>
                  <span className="text-[11px] text-zinc-500">.agents/ directory</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-zinc-800 dark:text-zinc-200">
                    {isKeyValid ? (
                      <span className="text-emerald-500 font-bold">&check;</span>
                    ) : (
                      <span className="text-amber-500 font-bold">&bull;</span>
                    )}
                    AiMemorySync API Key configured
                  </span>
                  <span className="text-[11px] font-mono text-zinc-500">
                    {isKeyValid ? "Active & Verified" : "Not Configured"}
                  </span>
                </div>
              </div>

              {!isKeyValid && (
                <div className="flex items-center justify-between rounded border border-amber-200 bg-amber-50 p-3 text-xs dark:border-amber-900/50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300">
                  <span>You need an API key to complete setup.</span>
                  <Link
                    href="/login?redirect=/integrations/antigravity/setup"
                    className="rounded bg-amber-600 px-3 py-1 font-medium text-white hover:bg-amber-700 transition"
                  >
                    Sign In with Key
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: API Key Generation */}
          {currentStep === 2 && (
            <div className="space-y-5">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-100 font-mono text-xs font-bold text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
                  2
                </span>
                <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                  Select or Generate an Integration API Key
                </h2>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                The MCP server communicates securely with the AiMemorySync backend using this secret key. We recommend generating a dedicated key with <code>read</code> and <code>write</code> scopes.
              </p>

              {newlyGeneratedKey ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20 space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                    <span>✓ Dedicated Antigravity Key Created!</span>
                  </div>
                  <div className="rounded border border-emerald-300 bg-white p-2 font-mono text-xs text-zinc-900 dark:border-emerald-900 dark:bg-zinc-900 dark:text-zinc-100 break-all select-all">
                    {newlyGeneratedKey}
                  </div>
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                    This key has been automatically selected for your MCP configuration.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {availableKeys.length > 0 && (
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                        Choose Existing API Key
                      </label>
                      <select
                        value={selectedKey}
                        onChange={(e) => setSelectedKey(e.target.value)}
                        className="mt-1 block w-full rounded border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                      >
                        <option value="">-- Choose Key --</option>
                        {availableKeys.map((k) => (
                          <option key={k.id} value={k.id}>
                            {k.name} ({k.prefix}••••{k.last4}) - Scopes: {k.scopes.join(", ")}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="rounded-lg border border-dashed border-zinc-300 p-4 dark:border-zinc-800 space-y-3">
                    <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                      Or Generate a Dedicated Antigravity Key
                    </h3>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={newKeyName}
                        onChange={(e) => setNewKeyName(e.target.value)}
                        placeholder="Antigravity Key Name"
                        className="flex-1 rounded border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                      />
                      <button
                        type="button"
                        onClick={handleGenerateDedicatedKey}
                        disabled={generatingKey}
                        className="rounded bg-zinc-900 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 disabled:opacity-50 transition"
                      >
                        {generatingKey ? "Generating..." : "Generate Key"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: Install MCP Server */}
          {currentStep === 3 && (
            <div className="space-y-5">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-100 font-mono text-xs font-bold text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
                  3
                </span>
                <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                  Build or Install the Universal MCP Server
                </h2>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                The MCP server executable acts as the standard protocol bridge between Antigravity and your AiMemorySync cloud/local API.
              </p>

              <div>
                <h3 className="text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Local Workspace Compilation (Recommended)
                </h3>
                <CodeBlock
                  code="npm run build:mcp"
                  language="bash"
                  filename="terminal"
                />
                <p className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                  This compiles <code>packages/mcp-server/src/index.ts</code> into <code>packages/mcp-server/dist/index.js</code> with all SDK dependencies bundled.
                </p>
              </div>

              <div>
                <h3 className="text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Verify Standalone Execution
                </h3>
                <CodeBlock
                  code="node packages/mcp-server/dist/index.js"
                  language="bash"
                  filename="terminal"
                />
              </div>
            </div>
          )}

          {/* STEP 4: Configure Antigravity */}
          {currentStep === 4 && (
            <div className="space-y-5">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-100 font-mono text-xs font-bold text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
                  4
                </span>
                <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                  Configure Antigravity MCP Server
                </h2>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                Place this configuration into your workspace at <code>.agents/plugins/aimemory/mcp_config.json</code>.
              </p>

              {/* Template vs withKey toggle */}
              <div className="flex items-center gap-3 text-xs">
                <span className="font-medium text-zinc-700 dark:text-zinc-300">Configuration Format:</span>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="configOption"
                    checked={configOption === "template"}
                    onChange={() => setConfigOption("template")}
                  />
                  <span>Template (Placeholder)</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="configOption"
                    checked={configOption === "withKey"}
                    onChange={() => setConfigOption("withKey")}
                  />
                  <span>Embed Active Key</span>
                </label>
              </div>

              {configOption === "withKey" && (
                <div className="rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-400">
                  ⚠️ <strong>Security Warning:</strong> This configuration snippet contains your live secret token. Ensure <code>.agents/</code> or <code>mcp_config.json</code> is included in your <code>.gitignore</code> so it is never committed to Git!
                </div>
              )}

              <CodeBlock
                code={mcpConfigCode}
                language="json"
                filename=".agents/plugins/aimemory/mcp_config.json"
              />
            </div>
          )}

          {/* STEP 5: Download & Install Plugin Skills */}
          {currentStep === 5 && (
            <div className="space-y-5">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-100 font-mono text-xs font-bold text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
                  5
                </span>
                <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                  Install AiMemory Skills & Guardrail Rules
                </h2>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                Antigravity utilizes custom skills and guardrail markdown rules to guide the agent when loading context and saving memories.
              </p>

              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                    Official Antigravity Plugin Package (.zip)
                  </h3>
                  <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                    Contains generic mcp_config.json, aimemory-guardrails.md, aimemory-context, and aimemory-capture skills (zero credentials).
                  </p>
                </div>
                <a
                  href="/api/integrations/antigravity/download"
                  download="antigravity-aimemory-plugin.zip"
                  className="rounded bg-zinc-900 px-4 py-2 text-xs font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition shrink-0"
                >
                  Download Plugin ZIP
                </a>
              </div>

              <div className="space-y-2 text-xs text-zinc-600 dark:text-zinc-400">
                <h4 className="font-semibold text-zinc-900 dark:text-zinc-100">
                  Target Directory Structure:
                </h4>
                <div className="rounded bg-zinc-100 p-3 font-mono text-[11px] dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 leading-relaxed">
                  {`your-project/
└── .agents/
    └── plugins/
        └── aimemory/
            ├── mcp_config.json
            ├── rules/
            │   └── aimemory-guardrails.md
            └── skills/
                ├── aimemory-context/SKILL.md
                └── aimemory-capture/SKILL.md`}
                </div>
              </div>
            </div>
          )}

          {/* STEP 6: Live Verification Test */}
          {currentStep === 6 && (
            <div className="space-y-5">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-100 font-mono text-xs font-bold text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
                  6
                </span>
                <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                  Live Full-Chain Connection Test
                </h2>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                Verify that your API key is authentic, active, has required permissions, and that the MCP server executable is ready for Antigravity.
              </p>

              <button
                type="button"
                onClick={handleRunTest}
                disabled={testing}
                className="w-full rounded bg-zinc-900 py-2.5 text-xs font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 disabled:opacity-50 transition"
              >
                {testing ? "Testing Connection..." : "Run Full-Chain Verification Test"}
              </button>

              {testResult && (
                <div
                  className={`rounded-xl border p-5 space-y-4 ${
                    testResult.success
                      ? "border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/40 dark:bg-emerald-950/20"
                      : "border-red-200 bg-red-50/60 dark:border-red-900/40 dark:bg-red-950/20"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${
                        testResult.success ? "bg-emerald-500" : "bg-red-500"
                      }`}
                    />
                    <h3
                      className={`text-xs font-semibold ${
                        testResult.success
                          ? "text-emerald-800 dark:text-emerald-300"
                          : "text-red-800 dark:text-red-300"
                      }`}
                    >
                      {testResult.message}
                    </h3>
                  </div>

                  {/* Checklist */}
                  <div className="space-y-2 border-t pt-3 border-zinc-200 dark:border-zinc-800 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-700 dark:text-zinc-300">1. Backend API Reachable</span>
                      <span className={testResult.checks.apiReachable ? "text-emerald-600 font-bold" : "text-red-600 font-bold"}>
                        {testResult.checks.apiReachable ? "✓ PASS" : "✕ FAIL"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-700 dark:text-zinc-300">2. Secret API Key Valid & Active</span>
                      <span className={testResult.checks.apiKeyValid ? "text-emerald-600 font-bold" : "text-red-600 font-bold"}>
                        {testResult.checks.apiKeyValid ? "✓ PASS" : "✕ FAIL"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-700 dark:text-zinc-300">3. Scopes Valid (read + write)</span>
                      <span className={testResult.checks.scopesValid ? "text-emerald-600 font-bold" : "text-red-600 font-bold"}>
                        {testResult.checks.scopesValid ? "✓ PASS" : "✕ FAIL"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-700 dark:text-zinc-300">4. MCP Server Binary Ready</span>
                      <span className={testResult.checks.mcpReady ? "text-emerald-600 font-bold" : "text-red-600 font-bold"}>
                        {testResult.checks.mcpReady ? "✓ PASS" : "✕ FAIL"}
                      </span>
                    </div>
                  </div>

                  {testResult.success && (
                    <div className="pt-2 flex justify-end">
                      <Link
                        href="/projects"
                        className="rounded bg-emerald-600 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-700 transition"
                      >
                        Launch Projects Dashboard &rarr;
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Stepper Navigation Footer */}
          <div className="mt-8 flex items-center justify-between border-t border-zinc-100 pt-5 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => setCurrentStep((prev) => Math.max(1, prev - 1))}
              disabled={currentStep === 1}
              className="rounded border border-zinc-300 bg-white px-3.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 transition"
            >
              &larr; Previous Step
            </button>

            {currentStep < 6 ? (
              <button
                type="button"
                onClick={() => setCurrentStep((prev) => Math.min(6, prev + 1))}
                className="rounded bg-zinc-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition"
              >
                Next Step &rarr;
              </button>
            ) : (
              <Link
                href="/projects"
                className="rounded bg-zinc-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition"
              >
                Complete Setup
              </Link>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
