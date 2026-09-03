"use client";

import { useState, useEffect, startTransition } from "react";
import Link from "next/link";
import { Navbar } from "@/components/shared/navbar";
import { Footer } from "@/components/shared/footer";
import { IntegrationCard } from "@/components/integrations/integration-card";
import { getAllIntegrations } from "@/lib/integrations/registry";
import { getApiKey, verifyApiKey } from "@/lib/api-client";

export default function IntegrationsDashboardPage() {
  const allIntegrations = getAllIntegrations();
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [hasValidKey, setHasValidKey] = useState<boolean | null>(null);

  useEffect(() => {
    const key = getApiKey();
    if (!key) {
      startTransition(() => {
        setHasValidKey(false);
      });
      return;
    }
    verifyApiKey(key)
      .then((res) => {
        startTransition(() => {
          setHasValidKey(res.valid);
        });
      })
      .catch(() => {
        startTransition(() => {
          setHasValidKey(false);
        });
      });
  }, []);

  const filtered =
    selectedCategory === "ALL"
      ? allIntegrations
      : allIntegrations.filter((item) => item.category === selectedCategory);

  return (
    <div className="flex min-h-screen flex-col bg-white mesh-gradient-bg text-slate-900 transition-colors">
      <Navbar />

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-10 sm:px-6 lg:px-8">
        {/* Header banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-6">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50/80 px-2.5 py-0.5 font-mono text-[11px] text-indigo-700 mb-2 font-medium">
              Platform Ecosystem &bull; Universal MCP Ready
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Integrations & AI Clients
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Connect persistent project memory to Antigravity, VS Code, Cursor, and future AI agents.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/settings/api-keys"
              className="inline-flex items-center gap-1.5 rounded border border-zinc-300 bg-white px-3.5 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 transition"
            >
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                />
              </svg>
              Manage API Keys
            </Link>
          </div>
        </div>

        {/* Auth prompt if not configured */}
        {hasValidKey === false && (
          <div className="mt-6 flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs dark:border-amber-900/50 dark:bg-amber-950/20">
            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300">
              <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
              <span>
                <strong>No active API key connected.</strong> Connect your API key to enable live verification and plugin installation.
              </span>
            </div>
            <Link
              href="/login"
              className="rounded bg-amber-600 px-3 py-1.5 font-medium text-white hover:bg-amber-700 transition"
            >
              Connect API Key &rarr;
            </Link>
          </div>
        )}

        {/* Category Filters */}
        <div className="mt-8 flex items-center gap-2 overflow-x-auto pb-2">
          {[
            { id: "ALL", label: "All Platforms" },
            { id: "AI_AGENT", label: "AI Agents" },
            { id: "IDE", label: "IDEs & Editors" },
            { id: "CHAT", label: "Chat & Assistants" },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                selectedCategory === cat.id
                  ? "bg-linear-to-r from-indigo-600 to-violet-600 text-white shadow-xs"
                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Integrations Grid */}
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((integration) => (
            <IntegrationCard
              key={integration.id}
              integration={integration}
              isConnected={integration.id === "antigravity" && hasValidKey === true}
            />
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
