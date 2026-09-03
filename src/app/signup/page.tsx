"use client";

import { useState, useTransition, Suspense } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { setApiKey, signupWorkspace, ApiError } from "@/lib/api-client";
import { Navbar } from "@/components/shared/navbar";
import { Footer } from "@/components/shared/footer";

function SignupForm() {
  const router = useRouter();
  const [workspaceName, setWorkspaceName] = useState("");
  const [primaryPlatform, setPrimaryPlatform] = useState("Antigravity IDE");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [createdResult, setCreatedResult] = useState<{ rawKey: string; name: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const platforms = [
    { id: "Antigravity IDE", label: "Antigravity IDE" },
    { id: "VS Code", label: "VS Code" },
    { id: "Cursor", label: "Cursor" },
    { id: "Universal MCP", label: "Universal MCP" },
  ];

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    const cleanName = workspaceName.trim();
    if (!cleanName) {
      setError("Please specify a name for your workspace.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await signupWorkspace({
        workspaceName: cleanName,
        primaryPlatform,
      });

      // Persist the newly generated key
      setApiKey(res.rawKey);
      setCreatedResult({
        rawKey: res.rawKey,
        name: res.workspaceName,
      });
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to create workspace. Please check your network connection.");
      }
    } finally {
      setLoading(false);
    }
  }

  function handleCopyKey() {
    if (!createdResult) return;
    navigator.clipboard.writeText(createdResult.rawKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleProceedToDashboard() {
    startTransition(() => {
      router.push("/projects");
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
        <span className="rounded-full bg-emerald-50 border border-emerald-200/60 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-700">
          Get Started Free
        </span>
      </div>

      <h1 className="mt-5 text-2xl font-extrabold tracking-tight text-slate-900">
        Create Your AI Workspace
      </h1>
      <p className="mt-1 text-xs text-slate-500 leading-relaxed">
        Provision persistent project memory and get your universal Bearer API token instantly.
      </p>

      {createdResult ? (
        <div className="mt-6 space-y-4 rounded-xl border border-emerald-200 bg-emerald-50/70 p-5">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
            <h3 className="text-xs font-bold text-emerald-900">
              Workspace & API Token Ready!
            </h3>
          </div>
          <p className="text-xs text-emerald-800 leading-relaxed">
            Welcome to <strong>{createdResult.name}</strong>. Here is your secret Bearer API token. It has already been saved to your browser session:
          </p>

          <div className="flex items-center gap-2">
            <div className="flex-1 rounded-lg border border-emerald-300/80 bg-white p-2.5 font-mono text-xs text-slate-900 break-all select-all shadow-2xs">
              {createdResult.rawKey}
            </div>
            <button
              type="button"
              onClick={handleCopyKey}
              className="rounded-lg bg-emerald-700 px-3 py-2.5 text-xs font-semibold text-white hover:bg-emerald-600 transition shrink-0"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>

          <button
            type="button"
            onClick={handleProceedToDashboard}
            disabled={isPending}
            className="w-full rounded-xl bg-emerald-600 py-3 text-xs font-bold text-white shadow-xs hover:bg-emerald-500 transition-all hover:scale-[1.01]"
          >
            {isPending ? "Entering Dashboard..." : "Enter Projects Dashboard →"}
          </button>
        </div>
      ) : (
        <form onSubmit={handleSignup} className="mt-6 space-y-4">
          <div>
            <label
              htmlFor="workspaceName"
              className="block text-xs font-semibold text-slate-700"
            >
              Workspace / Developer Name
            </label>
            <div className="relative mt-1.5">
              <input
                id="workspaceName"
                type="text"
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                placeholder="e.g. My Next.js Projects or psgpraveen-dev"
                required
                className="block w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-hidden transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Primary AI Environment
            </label>
            <div className="grid grid-cols-2 gap-2">
              {platforms.map((p) => (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => setPrimaryPlatform(p.id)}
                  className={`rounded-xl border py-2 px-3 text-xs font-medium text-left transition ${
                    primaryPlatform === p.id
                      ? "border-indigo-500 bg-indigo-50/60 text-indigo-900 font-semibold"
                      : "border-slate-200 bg-slate-50/50 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {p.label}
                </button>
              ))}
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
            className="w-full rounded-xl bg-linear-to-r from-indigo-600 to-violet-600 py-3 text-xs font-bold text-white shadow-xs hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50 transition-all hover:scale-[1.01]"
          >
            {loading || isPending ? "Creating Workspace..." : "Create Workspace & Generate Token"}
          </button>
        </form>
      )}

      <div className="mt-6 border-t border-slate-100 pt-4 flex items-center justify-between text-xs text-slate-500">
        <span>Already have an API token?</span>
        <Link
          href="/login"
          className="font-semibold text-indigo-600 hover:text-indigo-500 transition-colors"
        >
          Sign In Here &rarr;
        </Link>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white mesh-gradient-bg text-slate-900 transition-colors relative overflow-hidden">
      {/* Ambient Radiant Glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[350px] bg-linear-to-tr from-indigo-500/10 via-violet-500/10 to-transparent blur-[90px] pointer-events-none -z-10" />

      <Navbar />

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-16 sm:px-6">
        <Suspense
          fallback={
            <div className="rounded-2xl border border-slate-200 bg-white p-8 animate-pulse h-72" />
          }
        >
          <SignupForm />
        </Suspense>
      </main>

      <Footer />
    </div>
  );
}
