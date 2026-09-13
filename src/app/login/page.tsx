"use client";

import { useState, useTransition, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts";
import { Navbar } from "@/components/shared/navbar";
import { Footer } from "@/components/shared/footer";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get("redirect") || "/projects";
  const justLoggedOut = searchParams.get("loggedOut") === "true";

  const { login, devBootstrap, setMachineApiKey } = useAuth();

  // Human login form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [, startTransition] = useTransition();

  // Machine / Developer token state (clearly separated secondary flow)
  const [showMachineAccess, setShowMachineAccess] = useState(false);
  const [machineToken, setMachineToken] = useState("");
  const [machineLoading, setMachineLoading] = useState(false);
  const [machineError, setMachineError] = useState<string | null>(null);

  const isDev = process.env.NODE_ENV !== "production";

  async function handleHumanLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError("Please provide both email and password.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await login({
        email: email.trim(),
        password,
      });

      startTransition(() => {
        router.push(redirectPath);
        router.refresh();
      });
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Sign in failed. Please check your credentials.");
      }
      setLoading(false);
    }
  }

  async function handleDevBootstrap() {
    setLoading(true);
    setError(null);

    try {
      await devBootstrap();
      startTransition(() => {
        router.push(redirectPath);
        router.refresh();
      });
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Developer bootstrap failed.");
      }
      setLoading(false);
    }
  }

  async function handleMachineTokenConnect(e: React.FormEvent) {
    e.preventDefault();
    const cleanKey = machineToken.trim();
    if (!cleanKey) {
      setMachineError("Please enter your Bearer API token.");
      return;
    }

    setMachineLoading(true);
    setMachineError(null);

    try {
      const isValid = await setMachineApiKey(cleanKey);
      if (isValid) {
        startTransition(() => {
          router.push(redirectPath);
          router.refresh();
        });
      } else {
        setMachineError("Invalid or revoked API key.");
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setMachineError(err.message);
      } else {
        setMachineError("Verification failed.");
      }
    } finally {
      setMachineLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xl sm:p-8 transition-all max-w-md w-full mx-auto">
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
          Sign In
        </span>
      </div>

      <h1 className="mt-5 text-2xl font-extrabold tracking-tight text-slate-900">
        Sign in to your account
      </h1>
      <p className="mt-1 text-xs text-slate-500 leading-relaxed">
        Access your multi-tenant workspaces, shared memories, and AI integrations.
      </p>

      {/* Just Logged Out Banner */}
      {justLoggedOut && (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/80 p-3 text-xs text-emerald-800">
          <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
          <span>You have been successfully signed out.</span>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50/80 p-3 text-xs text-rose-800">
          <span className="mt-0.5 flex h-2 w-2 shrink-0 rounded-full bg-rose-500" />
          <span>{error}</span>
        </div>
      )}

      {/* Primary Human Form */}
      <form onSubmit={handleHumanLogin} className="mt-6 space-y-4">
        <div>
          <label
            htmlFor="email"
            className="block text-xs font-semibold text-slate-700 mb-1.5"
          >
            Email Address
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            placeholder="you@company.com"
            disabled={loading}
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-3 focus:ring-indigo-500/10 transition-all"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-xs font-semibold text-slate-700 mb-1.5"
          >
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            placeholder="••••••••"
            disabled={loading}
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-3 focus:ring-indigo-500/10 transition-all"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full mt-2 inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50 transition-all cursor-pointer"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Signing in...
            </span>
          ) : (
            "Sign In"
          )}
        </button>
      </form>

      {/* Secondary Links */}
      <div className="mt-5 text-center text-xs text-slate-500">
        Don&apos;t have a workspace?{" "}
        <Link
          href="/signup"
          className="font-semibold text-indigo-600 hover:text-indigo-700 underline underline-offset-2"
        >
          Create Workspace
        </Link>
      </div>

      {/* Local Developer 1-Click Bootstrap */}
      {isDev && (
        <div className="mt-6 pt-5 border-t border-slate-100">
          <div className="rounded-xl border border-amber-200/80 bg-amber-50/60 p-3 text-left">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-amber-900 flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                Local Dev Quick Sign-In
              </span>
              <span className="text-[9px] uppercase tracking-wider font-semibold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                Dev Only
              </span>
            </div>
            <p className="mt-1 text-[11px] text-amber-800">
              Sign into <code className="font-mono text-amber-950 font-bold">dev@aimemory.local</code> with instant access to <code className="font-mono text-amber-950">Legacy Workspace</code>.
            </p>
            <button
              type="button"
              onClick={handleDevBootstrap}
              disabled={loading}
              className="mt-2.5 w-full rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-amber-700 transition-all cursor-pointer"
            >
              1-Click Dev Sign-In
            </button>
          </div>
        </div>
      )}

      {/* Machine & Developer Access Separator */}
      <div className="mt-6 pt-5 border-t border-slate-100 text-left">
        <button
          type="button"
          onClick={() => setShowMachineAccess(!showMachineAccess)}
          className="flex items-center justify-between w-full text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors"
        >
          <span>Developer / Machine Token Sign-In</span>
          <span className="text-[10px] text-slate-400">
            {showMachineAccess ? "Hide ▲" : "Show ▼"}
          </span>
        </button>

        {showMachineAccess && (
          <form onSubmit={handleMachineTokenConnect} className="mt-3 space-y-2.5">
            <p className="text-[11px] text-slate-500">
              Paste a Bearer secret token (<code className="font-mono text-[10px] text-indigo-600">aimem_live_...</code>) for legacy machine testing.
            </p>
            {machineError && (
              <p className="text-[11px] text-rose-600">{machineError}</p>
            )}
            <input
              type="password"
              value={machineToken}
              onChange={(e) => setMachineToken(e.target.value)}
              placeholder="aimem_live_..."
              className="w-full font-mono text-xs rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900 focus:outline-none focus:border-indigo-500"
            />
            <button
              type="submit"
              disabled={machineLoading}
              className="w-full rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-900 transition-all cursor-pointer"
            >
              {machineLoading ? "Verifying..." : "Connect Machine Token"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 font-sans">
      <Navbar />
      <main className="flex flex-1 items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
        <Suspense fallback={<div className="h-64 flex items-center justify-center text-xs text-slate-400">Loading...</div>}>
          <LoginForm />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}
