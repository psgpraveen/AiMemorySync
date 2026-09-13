"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Navbar } from "@/components/shared/navbar";
import { Footer } from "@/components/shared/footer";
import { Modal } from "@/components/shared/modal";
import { useApiKeys } from "@/contexts";
import type { CreateApiKeyResponse } from "@/lib/api-client";

export default function ApiKeysPage() {
  const {
    apiKeys: keys,
    loading,
    error: contextError,
    fetchApiKeys,
    createApiKey: apiCreateKey,
    revokeApiKey: apiRevokeKey,
  } = useApiKeys();

  const [localError, setLocalError] = useState<string | null>(null);
  const error = localError || contextError;

  // Creation modal state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [selectedIntegration, setSelectedIntegration] = useState("Antigravity");
  const [scopeRead, setScopeRead] = useState(true);
  const [scopeWrite, setScopeWrite] = useState(true);
  const [scopeAdmin, setScopeAdmin] = useState(false);
  const [expirationDays, setExpirationDays] = useState<number | undefined>(undefined);
  const [creating, setCreating] = useState(false);

  // One-time reveal modal state
  const [createdResult, setCreatedResult] = useState<CreateApiKeyResponse | null>(null);
  const [copied, setCopied] = useState(false);

  // Revoke state
  const [revokingId, setRevokingId] = useState<string | null>(null);

  useEffect(() => {
    void fetchApiKeys();
  }, [fetchApiKeys]);

  function handleIntegrationChange(integration: string) {
    setSelectedIntegration(integration);
    if (!keyName || keyName.includes("Key")) {
      setKeyName(`${integration} Key`);
    }
    if (integration === "Custom Admin") {
      setScopeRead(true);
      setScopeWrite(true);
      setScopeAdmin(true);
    } else {
      setScopeRead(true);
      setScopeWrite(true);
      setScopeAdmin(false);
    }
  }

  async function handleCreateKey(e: React.FormEvent) {
    e.preventDefault();
    if (!keyName.trim()) return;
    setCreating(true);
    setLocalError(null);

    const scopes: string[] = [];
    if (scopeRead) scopes.push("read");
    if (scopeWrite) scopes.push("write");
    if (scopeAdmin) scopes.push("admin");

    try {
      const res = await apiCreateKey({
        name: keyName.trim(),
        scopes: scopes.length > 0 ? scopes : ["read"],
        expiresInDays: expirationDays,
      });

      setCreatedResult(res);
      setIsCreateOpen(false);
      setKeyName("");
      setLocalError(null);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setLocalError(err.message);
      } else {
        setLocalError("Failed to create API key");
      }
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(id: string) {
    if (!confirm("Are you sure you want to revoke this API key? This action is immediate and irreversible.")) {
      return;
    }

    setRevokingId(id);
    try {
      await apiRevokeKey(id);
    } catch (err: unknown) {
      if (err instanceof Error) {
        alert(err.message);
      } else {
        alert("Failed to revoke key");
      }
    } finally {
      setRevokingId(null);
    }
  }

  function handleCopyKey() {
    if (!createdResult) return;
    navigator.clipboard.writeText(createdResult.rawKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex min-h-screen flex-col bg-white mesh-gradient-bg text-slate-900 transition-colors">
      <Navbar />

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-10 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-6">
          <div>
            <div className="flex items-center gap-2">
              <Link
                href="/projects"
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-500"
              >
                &larr; Back to Dashboard
              </Link>
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
              API Keys Management
            </h1>
            <p className="mt-1 text-xs text-slate-500">
              Manage developer secret keys and access tokens for Antigravity, MCP servers, and integrations.
            </p>
          </div>

          <button
            onClick={() => {
              handleIntegrationChange("Antigravity");
              setIsCreateOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-linear-to-r from-indigo-600 to-violet-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:from-indigo-500 hover:to-violet-500 transition-all hover:scale-[1.02] self-start sm:self-auto"
          >
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Create API Key
          </button>
        </div>

        {/* Content */}
        {error && (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-400">
            {error}
          </div>
        )}

        {loading ? (
          <div className="mt-8 space-y-3">
            <div className="h-16 rounded-lg bg-zinc-200 dark:bg-zinc-800/60 animate-pulse" />
            <div className="h-16 rounded-lg bg-zinc-200 dark:bg-zinc-800/60 animate-pulse" />
          </div>
        ) : keys.length === 0 ? (
          <div className="mt-12 rounded-xl border border-dashed border-zinc-300 p-12 text-center dark:border-zinc-800">
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              No API keys generated yet
            </p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Generate an API key to connect Antigravity or any MCP client.
            </p>
            <button
              onClick={() => setIsCreateOpen(true)}
              className="mt-4 rounded bg-zinc-900 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900"
            >
              Create Your First Key
            </button>
          </div>
        ) : (
          <div className="mt-8 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-zinc-200 bg-zinc-50/50 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Name & Token</th>
                  <th className="px-4 py-3 font-medium">Scopes</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Created / Last Used</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {keys.map((key) => {
                  const isRevoked = key.revokedAt !== null && key.revokedAt !== undefined;
                  const isExpired = key.expiresAt ? new Date(key.expiresAt) < new Date() : false;

                  return (
                    <tr key={key.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
                      <td className="px-4 py-3.5">
                        <div className="font-medium text-zinc-900 dark:text-zinc-100">
                          {key.name}
                        </div>
                        <div className="mt-0.5 font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                          {key.prefix}••••••••{key.last4}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex flex-wrap gap-1">
                          {key.scopes.map((scope) => (
                            <span
                              key={scope}
                              className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                            >
                              {scope}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        {isRevoked ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700 dark:bg-red-950/40 dark:text-red-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                            Revoked
                          </span>
                        ) : isExpired ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                            Expired
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            Active
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                        <div>Created: {new Date(key.createdAt).toLocaleDateString()}</div>
                        <div>
                          Last used:{" "}
                          {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleDateString() : "Never"}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        {!isRevoked && (
                          <button
                            onClick={() => handleRevoke(key.id)}
                            disabled={revokingId === key.id}
                            className="rounded border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-900/40 dark:text-red-400 dark:hover:bg-red-950/30 transition"
                          >
                            {revokingId === key.id ? "Revoking..." : "Revoke"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Creation Modal */}
        <Modal
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          title="Create New API Key"
        >
          <form onSubmit={handleCreateKey} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Integration Preset
              </label>
              <div className="mt-1.5 grid grid-cols-2 sm:grid-cols-4 gap-2">
                {["Antigravity", "VS Code", "Cursor", "Custom Admin"].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => handleIntegrationChange(preset)}
                    className={`rounded border px-2.5 py-1.5 text-xs font-medium transition ${
                      selectedIntegration === preset
                        ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                        : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label
                htmlFor="keyName"
                className="block text-xs font-medium text-zinc-700 dark:text-zinc-300"
              >
                Key Name
              </label>
              <input
                id="keyName"
                type="text"
                required
                value={keyName}
                onChange={(e) => setKeyName(e.target.value)}
                placeholder="e.g. Antigravity Desktop Key"
                className="mt-1 block w-full rounded border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-hidden dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Permissions (Least Privilege)
              </label>
              <div className="space-y-2 rounded border border-zinc-200 bg-zinc-50/50 p-3 dark:border-zinc-800 dark:bg-zinc-950/40">
                <label className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={scopeRead}
                    onChange={(e) => setScopeRead(e.target.checked)}
                    className="rounded border-zinc-300 text-zinc-900 focus:ring-zinc-500"
                  />
                  <span>
                    <strong>read</strong>: Discover projects, query memories, fetch assembled AI context
                  </span>
                </label>
                <label className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={scopeWrite}
                    onChange={(e) => setScopeWrite(e.target.checked)}
                    className="rounded border-zinc-300 text-zinc-900 focus:ring-zinc-500"
                  />
                  <span>
                    <strong>write</strong>: Create memories, update items, deprecate and soft-archive
                  </span>
                </label>
                <label className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={scopeAdmin}
                    onChange={(e) => setScopeAdmin(e.target.checked)}
                    className="rounded border-zinc-300 text-zinc-900 focus:ring-zinc-500"
                  />
                  <span>
                    <strong>admin</strong>: Manage and revoke API keys (reserve for administrative tokens)
                  </span>
                </label>
              </div>
            </div>

            <div>
              <label
                htmlFor="expiration"
                className="block text-xs font-medium text-zinc-700 dark:text-zinc-300"
              >
                Expiration (Optional)
              </label>
              <select
                id="expiration"
                value={expirationDays ?? ""}
                onChange={(e) =>
                  setExpirationDays(e.target.value ? parseInt(e.target.value, 10) : undefined)
                }
                className="mt-1 block w-full rounded border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-900 focus:border-zinc-500 focus:outline-hidden dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              >
                <option value="">Never Expires</option>
                <option value="30">30 Days</option>
                <option value="90">90 Days</option>
                <option value="365">1 Year</option>
              </select>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creating}
                className="rounded bg-zinc-900 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 disabled:opacity-50"
              >
                {creating ? "Generating..." : "Generate Key"}
              </button>
            </div>
          </form>
        </Modal>

        {/* One-Time Reveal Modal */}
        <Modal
          isOpen={createdResult !== null}
          onClose={() => setCreatedResult(null)}
          title="Save Your API Key"
        >
          {createdResult && (
            <div className="space-y-4">
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/50 dark:bg-amber-950/20">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300">
                  <svg
                    className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                  <span>Copy this key now!</span>
                </div>
                <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                  For your security, this secret token is never stored in plaintext and will{" "}
                  <strong>never be displayed again</strong>.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Key Name: {createdResult.apiKey.name}
                </label>
                <div className="mt-1 flex items-center gap-2">
                  <div className="flex-1 rounded border border-zinc-200 bg-zinc-100 px-3 py-2 font-mono text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 break-all select-all">
                    {createdResult.rawKey}
                  </div>
                  <button
                    onClick={handleCopyKey}
                    className="shrink-0 rounded bg-zinc-900 px-3 py-2 text-xs font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 transition"
                  >
                    {copied ? "Copied!" : "Copy Key"}
                  </button>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => setCreatedResult(null)}
                  className="rounded bg-zinc-900 px-4 py-2 text-xs font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 transition"
                >
                  I Have Safely Saved It
                </button>
              </div>
            </div>
          )}
        </Modal>
      </main>
      <Footer />
    </div>
  );
}
