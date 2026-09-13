"use client";

import { useState, useTransition, Suspense } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts";
import { Navbar } from "@/components/shared/navbar";
import { Footer } from "@/components/shared/footer";

function SignupForm() {
  const router = useRouter();
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tenantName, setTenantName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [, startTransition] = useTransition();

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password || !tenantName.trim()) {
      setError("Please fill in all required fields.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await register({
        name: name.trim(),
        email: email.trim(),
        password,
        tenantName: tenantName.trim(),
      });

      // Force full document navigation to guarantee the new HttpOnly cookie is attached to RSC requests
      if (typeof window !== "undefined") {
        window.location.href = "/projects";
      } else {
        startTransition(() => {
          router.push("/projects");
          router.refresh();
        });
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to create workspace. Please try again.");
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
        <span className="rounded-full bg-emerald-50 border border-emerald-200/60 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-700">
          Get Started Free
        </span>
      </div>

      <h1 className="mt-5 text-2xl font-extrabold tracking-tight text-slate-900">
        Create Your Account & Workspace
      </h1>
      <p className="mt-1 text-xs text-slate-500 leading-relaxed">
        Join AiMemorySync to coordinate shared memory across Cursor, Antigravity, and VS Code.
      </p>

      {/* Error Alert */}
      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50/80 p-3 text-xs text-rose-800">
          <span className="mt-0.5 flex h-2 w-2 shrink-0 rounded-full bg-rose-500" />
          <span>{error}</span>
        </div>
      )}

      {/* Registration Form */}
      <form onSubmit={handleRegister} className="mt-6 space-y-4">
        <div>
          <label htmlFor="name" className="block text-xs font-semibold text-slate-700 mb-1.5">
            Full Name
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoComplete="name"
            placeholder="Jane Doe"
            disabled={loading}
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-3 focus:ring-indigo-500/10 transition-all"
          />
        </div>

        <div>
          <label htmlFor="email" className="block text-xs font-semibold text-slate-700 mb-1.5">
            Work Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            placeholder="jane@company.com"
            disabled={loading}
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-3 focus:ring-indigo-500/10 transition-all"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-xs font-semibold text-slate-700 mb-1.5">
            Password (min 8 characters)
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
            placeholder="••••••••"
            disabled={loading}
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-3 focus:ring-indigo-500/10 transition-all"
          />
        </div>

        <div>
          <label htmlFor="tenantName" className="block text-xs font-semibold text-slate-700 mb-1.5">
            Workspace Name
          </label>
          <input
            id="tenantName"
            type="text"
            value={tenantName}
            onChange={(e) => setTenantName(e.target.value)}
            required
            placeholder="Acme Engineering"
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
              Creating Workspace...
            </span>
          ) : (
            "Create Workspace & Account"
          )}
        </button>
      </form>

      {/* Existing Account Link */}
      <div className="mt-5 text-center text-xs text-slate-500">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-semibold text-indigo-600 hover:text-indigo-700 underline underline-offset-2"
        >
          Sign In
        </Link>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 font-sans">
      <Navbar />
      <main className="flex flex-1 items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
        <Suspense fallback={<div className="h-64 flex items-center justify-center text-xs text-slate-400">Loading...</div>}>
          <SignupForm />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}
