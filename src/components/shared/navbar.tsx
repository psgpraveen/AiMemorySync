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
    window.location.reload();
  }

  return (
    <>
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-6">
            <Link
              href="/projects"
              className="flex items-center gap-2 font-mono text-base font-bold tracking-tight text-zinc-900 hover:opacity-90 dark:text-zinc-50"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded bg-zinc-900 text-xs font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900">
                M
              </span>
              <span>AiMemorySync</span>
            </Link>
            <nav className="flex items-center gap-4 text-sm font-medium">
              <Link
                href="/projects"
                className="text-zinc-600 transition-colors hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
              >
                Projects
              </Link>
              <Link
                href="/integrations"
                className="text-zinc-600 transition-colors hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
              >
                Integrations
              </Link>
              <Link
                href="/settings/api-keys"
                className="text-zinc-600 transition-colors hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
              >
                API Keys
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsKeyModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 transition"
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  keyStatus === "valid"
                    ? "bg-emerald-500"
                    : keyStatus === "invalid"
                    ? "bg-red-500 animate-pulse"
                    : "bg-amber-500"
                }`}
              />
              {keyStatus === "valid"
                ? "API Key Active"
                : keyStatus === "invalid"
                ? "Invalid API Key"
                : "Set API Key"}
            </button>

            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400" />
              Active
            </span>
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
