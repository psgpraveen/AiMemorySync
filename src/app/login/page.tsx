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
  const justLoggedOut = searchParams.get("loggedOut") === "true";

  const [inputKey, setInputKey] = useState("");
  const [currentActiveKey, setCurrentActiveKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [bootstrappedKey, setBootstrappedKey] = useState<{ rawKey: string; name: string } | null>(null);
  const isDev = process.env.NODE_ENV !== "production";

  useEffect(() => {
    const current = getApiKey();
    if (current && !justLoggedOut) {
      verifyApiKey(current)
        .then((res) => {
          if (res.valid) {
            setCurrentActiveKey(current);
          } else {
            setCurrentActiveKey(null);
          }
        })
        .catch(() => {
          setCurrentActiveKey(null);
        });
    }
  }, [justLoggedOut]);

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    const cleanKey = inputKey.trim();
    if (!cleanKey) {
      setError("Please enter your Bearer API token.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Verify token against the live backend
      const result = await verifyApiKey(cleanKey);
      if (result.valid) {
        // 2. Persist to browser storage
        setApiKey(cleanKey);
        startTransition(() => {
          router.push(redirectPath);
          router.refresh();
        });
      } else {
        setError("The provided API key is invalid, inactive, or revoked.");
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

  function handleLogoutActive() {
    setApiKey(null);
    setCurrentActiveKey(null);
    setInputKey("");
    router.replace("/login?loggedOut=true");
  }

  function handleContinueWithBootstrapped() {
    startTransition(() => {
      router.push(redirectPath);
      router.refresh();
    });
  }

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xl sm:p-8 transition-all">
      {/* Brand Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-linear-to-tr from-indigo-600 via-indigo-500 to-violet-500 font-sans text-xs font-bold text-white shadow-xs">
            M
          </span>
          <span className="font-bold text-sm tracking-tight text-slate-900">
            AiMemory<span className="text-indigo-600">Sync</span>
          </span>
        </div>
        <span className="rounded-full bg-indigo-50 border border-indigo-200/60 px-2.5 py-0.5 text-[10px] font-semibold text-indigo-700">
          Auth Portal
        </span>
      </div>

      <h1 className="mt-5 text-2xl font-extrabold tracking-tight text-slate-900">
        Sign In with API Token
      </h1>
      <p className="mt-1 text-xs text-slate-500 leading-relaxed">
        Authenticate your session using your project Bearer secret token (<code className="font-mono text-[11px] text-indigo-600">aimem_live_...</code>).
      </p>

      {/* Just Logged Out Banner */}
      {justLoggedOut && (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/80 p-3 text-xs text-emerald-800">
          <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
          <span>You have been successfully signed out of your workspace.</span>
        </div>
      )}

      {/* Active Session Warning */}
      {currentActiveKey && (
        <div className="mt-5 rounded-xl border border-indigo-200/80 bg-indigo-50/60 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-xs font-bold text-indigo-950">Currently Connected</span>
          </div>
          <p className="text-xs text-indigo-900">
            Your browser already holds an active, verified Bearer API key:
          </p>
          <div className="rounded-lg border border-indigo-200 bg-white px-3 py-2 font-mono text-xs text-slate-800 break-all select-all">
            {currentActiveKey.slice(0, 14)}••••••••{currentActiveKey.slice(-4)}
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Link
              href={redirectPath}
              className="flex-1 rounded-xl bg-linear-to-r from-indigo-600 to-violet-600 py-2 text-center text-xs font-semibold text-white shadow-xs hover:from-indigo-500 hover:to-violet-500 transition"
            >
              Continue to Dashboard &rarr;
            </Link>
            <button
              type="button"
              onClick={handleLogoutActive}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition"
            >
              Log Out
            </button>
          </div>
        </div>
      )}

      {/* Bootstrapped One-Time Reveal */}
      {bootstrappedKey ? (
        <div className="mt-6 space-y-4 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
            <h3 className="text-xs font-bold text-emerald-800">
              New Development Key Generated!
            </h3>
          </div>
          <p className="text-xs text-emerald-700">
            A fresh developer key has been configured and saved to your browser:
          </p>
          <div className="rounded-lg border border-emerald-300/70 bg-white p-2.5 font-mono text-xs text-slate-900 break-all select-all shadow-2xs">
            {bootstrappedKey.rawKey}
          </div>
          <button
            type="button"
            onClick={handleContinueWithBootstrapped}
            className="w-full rounded-xl bg-emerald-600 py-2.5 text-xs font-semibold text-white hover:bg-emerald-500 shadow-xs transition"
          >
            Continue to Dashboard &rarr;
          </button>
        </div>
      ) : !currentActiveKey ? (
        <form onSubmit={handleConnect} className="mt-6 space-y-4">
          <div>
            <label
              htmlFor="apiKey"
              className="block text-xs font-semibold text-slate-700"
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
                className="block w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 font-mono text-xs text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-hidden transition-all"
              />
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50/80 p-3 text-xs text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || isPending}
            className="w-full rounded-xl bg-linear-to-r from-indigo-600 to-violet-600 py-2.5 text-xs font-semibold text-white shadow-xs hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50 transition"
          >
            {loading || isPending ? "Verifying..." : "Verify & Sign In"}
          </button>

          {isDev && (
            <div className="pt-3 border-t border-slate-100">
              <p className="text-[11px] text-slate-500 font-medium">
                Local Testing Shortcut:
              </p>
              <button
                type="button"
                onClick={handleBootstrapDev}
                disabled={loading}
                className="mt-2 w-full rounded-xl border border-dashed border-indigo-200 bg-indigo-50/40 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 transition"
              >
                ⚡ Generate Instant Developer Key
              </button>
            </div>
          )}
        </form>
      ) : null}

      <div className="mt-6 border-t border-slate-100 pt-4 flex items-center justify-between text-xs text-slate-500">
        <span>New to AiMemorySync?</span>
        <Link
          href="/signup"
          className="font-semibold text-indigo-600 hover:text-indigo-500 transition-colors"
        >
          Create Workspace &rarr;
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white mesh-gradient-bg text-slate-900 transition-colors relative overflow-hidden">
      {/* Subtle Radiant Glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[350px] bg-linear-to-tr from-indigo-500/10 via-violet-500/10 to-transparent blur-[90px] pointer-events-none -z-10" />

      <Navbar />

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-16 sm:px-6">
        <Suspense
          fallback={
            <div className="rounded-2xl border border-slate-200 bg-white p-8 animate-pulse h-72" />
          }
        >
          <LoginForm />
        </Suspense>
      </main>

      <Footer />
    </div>
  );
}
