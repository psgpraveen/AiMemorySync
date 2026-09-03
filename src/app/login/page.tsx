"use client";

import { useState, useEffect, useTransition, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { setApiKey, getApiKey, verifyApiKey, bootstrapApiKey, ApiError } from "@/lib/api-client";
import { Navbar } from "@/components/shared/navbar";
import { Footer } from "@/components/shared/footer";

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
    <div className="rounded-2xl border border-zinc-200/80 bg-white/90 p-6 shadow-xl backdrop-blur-md dark:border-zinc-800/80 dark:bg-zinc-900/90 sm:p-8 transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-linear-to-tr from-indigo-600 to-violet-500 font-sans text-xs font-bold text-white shadow-xs">
            M
          </span>
          <span className="font-semibold text-sm tracking-tight text-zinc-900 dark:text-zinc-50">
            AiMemory<span className="text-indigo-600 dark:text-indigo-400">Sync</span>
          </span>
        </div>
        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
          Auth
        </span>
      </div>

      <h1 className="mt-5 text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
        Connect Workspace
      </h1>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
        Authenticate your session using your secret Bearer API token (`aimem_live_...`).
      </p>

      {bootstrappedKey ? (
        <div className="mt-6 space-y-4 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/30">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
            <h3 className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
              New Development Key Generated!
            </h3>
          </div>
          <p className="text-xs text-emerald-700 dark:text-emerald-400">
            A fresh developer key has been configured and saved to your browser:
          </p>
          <div className="rounded-lg border border-emerald-300/70 bg-white p-2.5 font-mono text-xs text-zinc-900 dark:border-emerald-800 dark:bg-zinc-950 dark:text-zinc-100 break-all select-all shadow-2xs">
            {bootstrappedKey.rawKey}
          </div>
          <button
            type="button"
            onClick={handleContinueWithBootstrapped}
            className="w-full rounded-lg bg-emerald-600 py-2.5 text-xs font-semibold text-white hover:bg-emerald-500 shadow-xs transition"
          >
            Continue to Projects Dashboard &rarr;
          </button>
        </div>
      ) : (
        <form onSubmit={handleConnect} className="mt-6 space-y-4">
          <div>
            <label
              htmlFor="apiKey"
              className="block text-xs font-medium text-zinc-700 dark:text-zinc-300"
            >
              Bearer API Token
            </label>
            <div className="relative mt-1.5">
              <input
                id="apiKey"
                type="password"
                value={inputKey}
                onChange={(e) => setInputKey(e.target.value)}
                placeholder="aimem_live_..."
                required
                className="block w-full rounded-xl border border-zinc-300/90 bg-white px-3.5 py-2.5 font-mono text-xs text-zinc-900 placeholder-zinc-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-hidden dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder-zinc-500 transition-all"
              />
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50/80 p-3 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || isPending}
            className="w-full rounded-xl bg-indigo-600 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-500 disabled:opacity-50 transition"
          >
            {loading || isPending ? "Verifying..." : "Verify & Sign In"}
          </button>

          {isDev && (
            <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800/80">
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Local Testing Shortcut:
              </p>
              <button
                type="button"
                onClick={handleBootstrapDev}
                disabled={loading}
                className="mt-2 w-full rounded-xl border border-dashed border-zinc-300 bg-zinc-50/80 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-950/60 dark:text-zinc-300 dark:hover:bg-zinc-800/80 transition"
              >
                ⚡ Generate Instant Developer Key
              </button>
            </div>
          )}
        </form>
      )}

      <div className="mt-6 border-t border-zinc-100 pt-4 text-center dark:border-zinc-800">
        <Link
          href="/integrations"
          className="text-xs text-zinc-500 hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400 transition-colors"
        >
          Explore Supported Integrations &rarr;
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white mesh-gradient-bg text-slate-900 transition-colors relative overflow-hidden">
      {/* Subtle Background Glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-linear-to-tr from-indigo-500/10 via-violet-500/10 to-transparent blur-[90px] pointer-events-none -z-10" />

      <Navbar />

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-12 sm:px-6">
        <Suspense
          fallback={
            <div className="rounded-2xl border border-zinc-200 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-900 animate-pulse h-72" />
          }
        >
          <LoginForm />
        </Suspense>
      </main>

      <Footer />
    </div>
  );
}
