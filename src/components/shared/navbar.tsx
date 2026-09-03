"use client";

import { useState, useEffect, startTransition } from "react";

import Link from "next/link";

import { getApiKey, setApiKey, verifyApiKey } from "@/lib/api-client";
import { Modal } from "@/components/shared/modal";

export function Navbar() {
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  // Always start empty to match SSR output (avoids hydration mismatch).
  // useEffect populates from localStorage after first client render.
  const [currentKey, setCurrentKey] = useState<string>("");
  const [inputKey, setInputKey] = useState<string>("");
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [keyStatus, setKeyStatus] = useState<"none" | "valid" | "invalid">("none");

  useEffect(() => {
    const stored = getApiKey() || "";
    startTransition(() => {
      setCurrentKey(stored);
      setInputKey(stored);
    });

    if (stored) {
      verifyApiKey(stored)
        .then((res) => {
          startTransition(() => {
            setKeyStatus(res.valid ? "valid" : "invalid");
          });
        })
        .catch(() => {
          startTransition(() => {
            setKeyStatus("invalid");
          });
        });
    }
  }, []);

  function handleSaveKey(e: React.FormEvent) {
    e.preventDefault();
    const clean = inputKey.trim();
    setApiKey(clean || null);
    setCurrentKey(clean);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      setIsKeyModalOpen(false);
      window.location.reload();
    }, 400);
  }

  function handleClearKey() {
    setApiKey(null);
    setCurrentKey("");
    setInputKey("");
    setIsKeyModalOpen(false);
    window.location.href = "/login?loggedOut=true";
  }

  function handleLogout() {
    setApiKey(null);
    setCurrentKey("");
    setInputKey("");
    setKeyStatus("none");
    window.location.href = "/login?loggedOut=true";
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
            <button
              onClick={() => setIsKeyModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition shadow-2xs"
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  keyStatus === "valid"
                    ? "bg-emerald-500 shadow-xs shadow-emerald-500/50"
                    : keyStatus === "invalid"
                    ? "bg-red-500 animate-pulse"
                    : "bg-amber-500"
                }`}
              />
              <span className="hidden sm:inline">
                {keyStatus === "valid"
                  ? "API Key Active"
                  : keyStatus === "invalid"
                  ? "Invalid API Key"
                  : "Set API Key"}
              </span>
            </button>

            {keyStatus === "valid" ? (
              <button
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-red-600 hover:border-red-200 hover:bg-red-50/50 transition shadow-2xs"
                title="Log out of current workspace"
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

      {/* API Key Modal */}
      <Modal
        isOpen={isKeyModalOpen}
        onClose={() => setIsKeyModalOpen(false)}
        title="API Key Configuration"
      >
        <form onSubmit={handleSaveKey} className="space-y-4">
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            AiMemorySync API endpoints require a Bearer API key. Enter your secret token below to authenticate web dashboard requests.
          </p>

          <div>
            <label
              htmlFor="apiKey"
              className="block text-xs font-medium text-zinc-700 dark:text-zinc-300"
            >
              Bearer API Key
            </label>
            <input
              id="apiKey"
              type="password"
              value={inputKey}
              onChange={(e) => setInputKey(e.target.value)}
              placeholder="aimem_live_..."
              className="mt-1 block w-full rounded border border-zinc-300 bg-white px-3 py-1.5 font-mono text-xs text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-hidden dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500"
            />
          </div>

          <div className="rounded border border-zinc-200 bg-zinc-50 p-2.5 dark:border-zinc-800 dark:bg-zinc-950">
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Need a key? Run in your terminal:
            </p>
            <code className="mt-1 block rounded bg-zinc-200 px-2 py-1 font-mono text-[11px] text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
              npm run key:generate
            </code>
          </div>

          {savedSuccess && (
            <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
              API key saved successfully! Refreshing...
            </p>
          )}

          <div className="flex items-center justify-between pt-2">
            {currentKey ? (
              <button
                type="button"
                onClick={handleClearKey}
                className="text-xs text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
              >
                Clear Key
              </button>
            ) : <div />}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsKeyModalOpen(false)}
                className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                Save & Apply
              </button>
            </div>
          </div>
        </form>
      </Modal>
    </>
  );
}
