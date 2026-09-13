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

  const { login } = useAuth();

  // Human login form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [, startTransition] = useTransition();

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
