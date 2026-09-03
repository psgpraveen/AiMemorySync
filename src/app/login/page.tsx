"use client";

import { useState, useEffect, useTransition, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { setApiKey, getApiKey, verifyApiKey, bootstrapApiKey, ApiError } from "@/lib/api-client";
import { Navbar } from "@/components/shared/navbar";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get("redirect") || "/projects";

  const [inputKey, setInputKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [bootstrappedKey, setBootstrappedKey] = useState<{ rawKey: string; name: string } | null>(null);
  const isDev = process.env.NODE_ENV !== "production";

  useEffect(() => {
    const current = getApiKey();
    if (current) {
      startTransition(() => {
        setInputKey(current);
      });
    }
  }, []);

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    const cleanKey = inputKey.trim();
    if (!cleanKey) {
      setError("Please enter your Bearer API key.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Verify key against the live backend
      const result = await verifyApiKey(cleanKey);
      if (result.valid) {
        // 2. Persist to storage
        setApiKey(cleanKey);
        startTransition(() => {
          router.push(redirectPath);
          router.refresh();
        });
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to verify API key. Please check your network connection.");
      }
      setLoading(false);
    }
  }

  async function handleBootstrapDev() {
    setLoading(true);
    setError(null);

    try {
      const result = await bootstrapApiKey();
      setBootstrappedKey({ rawKey: result.rawKey, name: result.apiKey.name });
      setInputKey(result.rawKey);
      setApiKey(result.rawKey);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to generate development key");
      }
    } finally {
      setLoading(false);
    }
  }

  function handleContinueWithBootstrapped() {
    startTransition(() => {
      router.push(redirectPath);
      router.refresh();
    });
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 sm:p-8">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded bg-zinc-900 font-mono text-xs font-bold text-white dark:bg-zinc-100 dark:text-zinc-900">
          M
        </span>
        <span className="font-mono text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          AiMemorySync Auth
        </span>
      </div>

      <h1 className="mt-4 text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
        Sign In with API Key
      </h1>
      <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
        Connect your developer workspace using your Bearer secret API token.
      </p>

      {bootstrappedKey ? (
        <div className="mt-6 space-y-4 rounded-lg border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <h3 className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
              New API Key Generated!
            </h3>
          </div>
          <p className="text-xs text-emerald-700 dark:text-emerald-400">
            A fresh developer key has been configured and saved for your session:
          </p>
          <div className="rounded border border-emerald-200 bg-white p-2 font-mono text-xs text-zinc-900 dark:border-emerald-900 dark:bg-zinc-900 dark:text-zinc-100 break-all select-all">
            {bootstrappedKey.rawKey}
          </div>
          <button
            type="button"
            onClick={handleContinueWithBootstrapped}
            className="w-full rounded bg-emerald-600 py-2 text-xs font-medium text-white hover:bg-emerald-700 transition"
          >
            Continue to Dashboard &rarr;
          </button>
        </div>
      ) : (
        <form onSubmit={handleConnect} className="mt-6 space-y-4">
          <div>
            <label
              htmlFor="apiKey"
              className="block text-xs font-medium text-zinc-700 dark:text-zinc-300"
            >
              Secret API Key
            </label>
            <div className="relative mt-1">
              <input
                id="apiKey"
                type="password"
                value={inputKey}
                onChange={(e) => setInputKey(e.target.value)}
                placeholder="aimem_live_..."
                required
                className="block w-full rounded border border-zinc-300 bg-white px-3 py-2 font-mono text-xs text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-hidden dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500"
              />
            </div>
          </div>

          {error && (
            <div className="rounded border border-red-200 bg-red-50 p-2.5 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-400">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || isPending}
            className="w-full rounded bg-zinc-900 py-2 text-xs font-medium text-white shadow-xs hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition"
          >
            {loading || isPending ? "Verifying..." : "Connect Workspace"}
          </button>

          {isDev && (
            <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Local Development Environment:
              </p>
              <button
                type="button"
                onClick={handleBootstrapDev}
                disabled={loading}
                className="mt-2 w-full rounded border border-dashed border-zinc-300 bg-zinc-50 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-300 dark:hover:bg-zinc-800 transition"
              >
                ⚡ Generate One-Click Development Key
              </button>
            </div>
          )}
        </form>
      )}

      <div className="mt-6 border-t border-zinc-100 pt-4 text-center dark:border-zinc-800">
        <Link
          href="/integrations"
          className="text-xs text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          Learn about Supported Integrations &rarr;
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950">
      <Navbar />

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-12 sm:px-6">
        <Suspense
          fallback={
            <div className="rounded-xl border border-zinc-200 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-900 animate-pulse h-64" />
          }
        >
          <LoginForm />
        </Suspense>
      </main>
    </div>
  );
}
