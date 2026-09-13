"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts";
import { Modal } from "@/components/shared/modal";

export function Navbar() {
  const router = useRouter();
  const {
    session,
    apiKey,
    keyStatus,
    isSwitchingTenant,
    logout,
    switchWorkspace,
    setMachineApiKey,
  } = useAuth();

  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const [inputKey, setInputKey] = useState("");
  const [savedSuccess, setSavedSuccess] = useState(false);

  function openKeyModal() {
    setInputKey(apiKey || "");
    setIsKeyModalOpen(true);
  }

  async function handleLogout() {
    await logout();
    router.push("/login?loggedOut=true");
    router.refresh();
  }

  async function handleSwitchWorkspace(tenantId: string) {
    if (!tenantId || tenantId === session?.activeTenant.id) return;
    try {
      await switchWorkspace(tenantId);
      router.refresh();
    } catch {
      // Handled in context
    }
  }

  async function handleSaveKey(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = inputKey.trim();
    if (!trimmed) {
      await setMachineApiKey(null);
      setIsKeyModalOpen(false);
      return;
    }
    await setMachineApiKey(trimmed);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      setIsKeyModalOpen(false);
      router.refresh();
    }, 400);
  }

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur-md shadow-2xs">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-6">
            <Link
              href="/"
              className="flex items-center gap-2.5 font-sans text-sm font-bold tracking-tight text-slate-900 hover:opacity-90 group"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-linear-to-tr from-indigo-600 via-indigo-500 to-violet-500 text-xs font-bold text-white shadow-xs group-hover:scale-105 transition-transform">
                M
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="font-semibold text-base tracking-tight text-slate-900">
                  AiMemory<span className="text-indigo-600">Sync</span>
                </span>
                <span className="hidden md:inline-flex items-center rounded-full bg-slate-100 border border-slate-200/60 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                  by psgpraveen
                </span>
              </div>
            </Link>

            <nav className="flex items-center gap-1 sm:gap-2 text-xs font-medium">
              <Link
                href="/projects"
                className="rounded-lg px-3 py-1.5 text-slate-600 transition hover:bg-slate-100 hover:text-slate-950"
              >
                Projects
              </Link>
              <Link
                href="/integrations"
                className="rounded-lg px-3 py-1.5 text-slate-600 transition hover:bg-slate-100 hover:text-slate-950"
              >
                Integrations
              </Link>
              <Link
                href="/settings/api-keys"
                className="rounded-lg px-3 py-1.5 text-slate-600 transition hover:bg-slate-100 hover:text-slate-950"
              >
                API Keys
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Active Workspace / Tenant Selector */}
            {session && (
              <div className="flex items-center gap-2">
                {session.memberships.length > 1 ? (
                  <select
                    value={session.activeTenant.id}
                    onChange={(e) => handleSwitchWorkspace(e.target.value)}
                    disabled={isSwitchingTenant}
                    className="rounded-lg border border-indigo-200 bg-indigo-50/70 px-2.5 py-1 text-xs font-semibold text-indigo-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    title="Switch Workspace"
                  >
                    {session.memberships.map((m) => (
                      <option key={m.tenantId} value={m.tenantId}>
                        {m.name} ({m.role})
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-indigo-200/70 bg-indigo-50/70 px-2.5 py-1 text-xs font-medium text-indigo-800">
                    <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                    <span>{session.activeTenant.name}</span>
                    <span className="text-[10px] text-indigo-500 uppercase font-bold">
                      {session.activeTenant.role}
                    </span>
                  </span>
                )}

                <span className="hidden md:inline-block text-xs text-slate-600 font-medium">
                  {session.user.name}
                </span>
              </div>
            )}

            {/* Developer Machine API Key Trigger (Secondary) */}
            <button
              onClick={() => setIsKeyModalOpen(true)}
              className="hidden lg:inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50 transition shadow-2xs"
              title="Configure Machine API Key"
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  keyStatus === "valid"
                    ? "bg-emerald-500"
                    : keyStatus === "invalid"
                    ? "bg-red-500"
                    : "bg-slate-300"
                }`}
              />
              <span>API Key</span>
            </button>

            {/* Log Out or Sign In */}
            {session || keyStatus === "valid" ? (
              <button
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-red-600 hover:border-red-200 hover:bg-red-50/50 transition shadow-2xs cursor-pointer"
                title="Log out"
              >
                <svg
                  className="h-3.5 w-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                <span>Log Out</span>
              </button>
            ) : (
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 rounded-lg bg-linear-to-r from-indigo-600 to-violet-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:from-indigo-500 hover:to-violet-500 transition shadow-xs"
              >
                <svg
                  className="h-3.5 w-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                  <polyline points="10 17 15 12 10 7" />
                  <line x1="15" y1="12" x2="3" y2="12" />
                </svg>
                <span>Sign In</span>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Machine API Key Modal for Developer Inspection */}
      <Modal
        isOpen={isKeyModalOpen}
        onClose={() => setIsKeyModalOpen(false)}
        title="Machine API Key Configuration"
      >
        <form onSubmit={handleSaveKey} className="space-y-4">
          <p className="text-xs text-slate-600">
            For local machine or agent testing. Provide a Bearer API token (<code className="font-mono text-[11px] text-indigo-600">aimem_live_...</code>).
          </p>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Active Key
            </label>
            <input
              type="password"
              value={inputKey}
              onChange={(e) => setInputKey(e.target.value)}
              placeholder="aimem_live_..."
              className="w-full font-mono text-xs rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          {savedSuccess && (
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-2.5 text-xs text-emerald-800">
              API key configured successfully.
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsKeyModalOpen(false)}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
            >
              Save Key
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
