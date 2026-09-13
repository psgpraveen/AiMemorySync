"use client";

// Antigravity IDE Integration Setup Wizard
import { useState, useEffect, startTransition } from "react";
import Link from "next/link";
import { Navbar } from "@/components/shared/navbar";
import { Footer } from "@/components/shared/footer";
import { CodeBlock } from "@/components/integrations/code-block";
import { useAuth } from "@/contexts";
import {
  API_ENDPOINTS,
  getApiKey,
  verifyApiKey,
  listApiKeys,
  createApiKey,
  testIntegration,
  ApiKeyDto,
  TestIntegrationResponse,
} from "@/lib/api-client";

export default function AntigravitySetupWizardPage() {
  const { session } = useAuth();
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

  const [serverOrigin] = useState(() => {
    if (typeof window !== "undefined" && window.location?.origin) {
      return window.location.origin;
    }
    return "http://localhost:3000";
  });

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
                  AIMEMORY_API_URL: serverOrigin,
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
                  AIMEMORY_API_URL: serverOrigin,
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
    { num: 3, label: "Extension" },
    { num: 4, label: "Connect" },
    { num: 5, label: "Skills" },
    { num: 6, label: "Verify" },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-white mesh-gradient-bg text-slate-900 transition-colors">
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
                    <span className="text-emerald-500 font-bold">✓</span>
                    Node.js 18+ runtime installed
                  </span>
                  <code className="text-[11px] text-zinc-500">node -v</code>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-zinc-800 dark:text-zinc-200">
                    <span className="text-emerald-500 font-bold">✓</span>
                    Antigravity workspace active
                  </span>
                  <span className="text-[11px] text-zinc-500">.agents/ directory</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-zinc-800 dark:text-zinc-200">
                    {session ? (
                      <span className="text-emerald-500 font-bold">✓</span>
                    ) : (
                      <span className="text-amber-500 font-bold">•</span>
                    )}
                    AiMemorySync Account
                  </span>
                  <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                    {session?.user ? `Signed in (${session.user.name || session.user.email})` : "Not Signed In"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-zinc-800 dark:text-zinc-200">
                    {isKeyValid ? (
                      <span className="text-emerald-500 font-bold">✓</span>
                    ) : (
                      <span className="text-slate-400 font-bold">•</span>
                    )}
                    Antigravity Machine API Key
                  </span>
                  <span className="text-[11px] font-mono text-zinc-500">
                    {isKeyValid ? "Configured" : "Will generate in Step 2"}
                  </span>
                </div>
              </div>

              {session ? (
                <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50/80 p-3.5 text-xs text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300">
                  <div className="space-y-0.5">
                    <p className="font-semibold flex items-center gap-1.5">
                      <span>✓ Account Verified</span>
                    </p>
                    <p className="text-emerald-800/90 dark:text-emerald-400">
                      Logged in as <strong>{session.user.email}</strong>. Click below to generate your dedicated machine API key for Antigravity.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(2)}
                    className="rounded-lg bg-emerald-600 px-3.5 py-1.5 font-medium text-white hover:bg-emerald-700 transition cursor-pointer shadow-xs whitespace-nowrap ml-4"
                  >
                    Continue to Step 2 &rarr;
                  </button>
                </div>
              ) : !isKeyValid ? (
                <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 p-3.5 text-xs dark:border-amber-900/50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300">
                  <span>Sign in to your account to generate an integration API key.</span>
                  <Link
                    href="/login?redirect=/integrations/antigravity/setup"
                    className="rounded bg-amber-600 px-3 py-1 font-medium text-white hover:bg-amber-700 transition"
                  >
                    Sign In
                  </Link>
                </div>
              ) : null}
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

          {/* STEP 3: Download & Install Extension */}
          {currentStep === 3 && (
            <div className="space-y-5">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-100 font-mono text-xs font-bold text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
                  3
                </span>
                <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                  Download & Install AiMemory Extension (.vsix)
                </h2>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                Antigravity natively runs standard IDE extensions. Download the official AiMemorySync extension package and install it directly.
              </p>

              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                    AiMemorySync Native Extension (v0.1.2)
                  </h3>
                  <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                    Includes automatic workspace discovery, Project & Memory sidebar tree views, OS keychain secret storage, and status bar telemetry.
                  </p>
                </div>
                <a
                  href="/api/integrations/vscode/download"
                  download="aimemory-vscode-0.1.2.vsix"
                  className="rounded bg-zinc-900 px-4 py-2 text-xs font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition shrink-0 shadow-xs"
                >
                  Download Extension (.vsix)
                </a>
              </div>

              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                  How to Install in Antigravity:
                </h3>
                <ol className="list-decimal list-inside space-y-1.5 text-xs text-zinc-600 dark:text-zinc-400">
                  <li>Open the <strong>Extensions</strong> view in Antigravity (press <kbd className="rounded border bg-zinc-100 px-1 py-0.5 text-[10px] dark:bg-zinc-800">Ctrl+Shift+X</kbd> or <kbd className="rounded border bg-zinc-100 px-1 py-0.5 text-[10px] dark:bg-zinc-800">Cmd+Shift+X</kbd>).</li>
                  <li>Click the <strong>&hellip;</strong> (Views and More Actions) menu in the top right of the Extensions panel.</li>
                  <li>Click <strong>Install from VSIX...</strong> and select the downloaded <code>aimemory-vscode-0.1.2.vsix</code>.</li>
                  <li>Alternatively, install directly via your terminal:</li>
                </ol>
                <CodeBlock
                  code="code --install-extension aimemory-vscode-0.1.2.vsix"
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
                  Connect Extension to Live Backend
                </h2>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                Configure your API key and server URL inside Antigravity so the extension can automatically synchronize your project memories.
              </p>

              <div className="space-y-4 text-xs">
                <div className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-4 dark:border-zinc-800 dark:bg-zinc-950/40 space-y-2.5">
                  <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200 text-[10px] font-bold">1</span>
                    Set Your Secret API Key
                  </h3>
                  <p className="text-zinc-600 dark:text-zinc-400">
                    Open the Command Palette in Antigravity (<kbd className="rounded border bg-zinc-100 px-1 py-0.5 text-[10px] dark:bg-zinc-800">Ctrl+Shift+P</kbd>), run:
                  </p>
                  <CodeBlock
                    code="AiMemory: Connect / Set API Key"
                    language="text"
                    filename="Command Palette"
                  />
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    Paste your active secret key generated in Step 2: <code className="font-mono text-[10px] text-emerald-600 dark:text-emerald-400 select-all">{selectedKey || activeKey || "aimem_live_..."}</code>
                  </p>
                </div>

                <div className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-4 dark:border-zinc-800 dark:bg-zinc-950/40 space-y-2.5">
                  <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200 text-[10px] font-bold">2</span>
                    Set Backend Server URL
                  </h3>
                  <p className="text-zinc-600 dark:text-zinc-400">
                    Open Settings (<kbd className="rounded border bg-zinc-100 px-1 py-0.5 text-[10px] dark:bg-zinc-800">Ctrl+,</kbd>), search for <strong>aimemory.apiUrl</strong>, and set it to:
                  </p>
                  <CodeBlock
                    code={serverOrigin}
                    language="text"
                    filename="Settings: aimemory.apiUrl"
                  />
                </div>
              </div>
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
                  href={API_ENDPOINTS.INTEGRATIONS.DOWNLOAD("antigravity")}
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
                      <span className="text-zinc-700 dark:text-zinc-300">4. Integration Extension Package Ready</span>
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
      <Footer />
    </div>
  );
}
