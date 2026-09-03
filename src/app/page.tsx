import Link from "next/link";
import { Navbar } from "@/components/shared/navbar";
import { Footer } from "@/components/shared/footer";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-white text-slate-900 mesh-gradient-bg">
      <Navbar />

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-16 pb-20 sm:pt-24 sm:pb-28">
        {/* Radiant Ambient Gradients */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] bg-linear-to-tr from-indigo-500/12 via-violet-500/10 to-sky-400/10 blur-[100px] pointer-events-none -z-10" />

        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 text-center">
          {/* Release & Author Pill */}
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200/80 bg-white/90 px-4 py-1.5 text-xs font-medium text-indigo-700 shadow-xs backdrop-blur-md">
            <span className="flex h-2 w-2 rounded-full bg-indigo-600 animate-pulse" />
            <span className="font-semibold">Universal AI Memory v0.1.0</span>
            <span className="text-slate-300">·</span>
            <span className="text-slate-700">Created by <strong className="text-indigo-900 font-semibold">PSG Praveen</strong> (@psgpraveen)</span>
          </div>

          <h1 className="mt-8 text-4xl font-extrabold tracking-tight sm:text-6xl text-slate-900">
            Universal AI Memory & <br className="hidden sm:inline" />
            <span className="bg-linear-to-r from-indigo-600 via-violet-600 to-purple-600 bg-clip-text text-transparent">
              Context Synchronization
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-base sm:text-lg text-slate-600 leading-relaxed">
            Persistent, deterministic AI memory across Antigravity, VS Code, Cursor, and ChatGPT. 
            Capture architectural decisions, conventions, and bug solutions in a shared, zero-leakage knowledge layer.
          </p>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/projects"
              className="inline-flex items-center gap-2 rounded-xl bg-linear-to-r from-indigo-600 to-violet-600 px-6 py-3 text-sm font-semibold text-white shadow-md shadow-indigo-500/25 hover:from-indigo-500 hover:to-violet-500 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <span>Explore Projects</span>
              <span aria-hidden="true">&rarr;</span>
            </Link>

            <Link
              href="/integrations/antigravity/setup"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-800 shadow-xs hover:bg-slate-50 hover:border-slate-400 transition-all"
            >
              <span>Setup Antigravity Plugin</span>
            </Link>

            <Link
              href="/settings/api-keys"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white/70 px-5 py-3 text-sm font-medium text-slate-600 hover:text-slate-900 hover:border-slate-300 transition"
            >
              <span>API Key Manager</span>
            </Link>
          </div>

          {/* Supported Platforms Pill Bar */}
          <div className="mt-14 pt-8 border-t border-slate-200/80 flex flex-wrap items-center justify-center gap-2.5 text-xs text-slate-500">
            <span className="font-semibold text-slate-700 mr-1">Supported Platforms:</span>
            <span className="rounded-lg bg-white border border-slate-200 px-3 py-1 font-mono font-medium text-slate-700 shadow-2xs">Antigravity IDE</span>
            <span className="rounded-lg bg-white border border-slate-200 px-3 py-1 font-mono font-medium text-slate-700 shadow-2xs">VS Code Extension</span>
            <span className="rounded-lg bg-white border border-slate-200 px-3 py-1 font-mono font-medium text-slate-700 shadow-2xs">Universal MCP Server</span>
            <span className="rounded-lg bg-slate-50 border border-dashed border-slate-300 px-3 py-1 font-mono text-slate-400">Cursor (Ready)</span>
            <span className="rounded-lg bg-slate-50 border border-dashed border-slate-300 px-3 py-1 font-mono text-slate-400">Claude Desktop</span>
            <span className="rounded-lg bg-slate-50 border border-dashed border-slate-300 px-3 py-1 font-mono text-slate-400">ChatGPT</span>
          </div>
        </div>
      </section>

      {/* Feature Grid */}
      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {/* Feature 1 */}
          <div className="rounded-2xl border border-slate-200/90 bg-white/90 p-6 shadow-xs backdrop-blur-xs hover:border-indigo-400/60 hover:shadow-md transition-all">
            <div className="h-10 w-10 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-lg shadow-2xs">
              🎯
            </div>
            <h2 className="mt-4 text-sm font-semibold text-slate-900">
              Automatic Discovery
            </h2>
            <p className="mt-2 text-xs text-slate-500 leading-relaxed">
              3-tier deterministic identity resolution using Git remote URLs, manifest fingerprints, and local workspace digests.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="rounded-2xl border border-slate-200/90 bg-white/90 p-6 shadow-xs backdrop-blur-xs hover:border-indigo-400/60 hover:shadow-md transition-all">
            <div className="h-10 w-10 rounded-xl bg-purple-50 border border-purple-100 text-purple-600 flex items-center justify-center font-bold text-lg shadow-2xs">
              ⚡
            </div>
            <h2 className="mt-4 text-sm font-semibold text-slate-900">
              Universal MCP Server
            </h2>
            <p className="mt-2 text-xs text-slate-500 leading-relaxed">
              Standard stdio Model Context Protocol bridge with pre-flight anti-poisoning credential scrubbing and zero direct database queries.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="rounded-2xl border border-slate-200/90 bg-white/90 p-6 shadow-xs backdrop-blur-xs hover:border-indigo-400/60 hover:shadow-md transition-all">
            <div className="h-10 w-10 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-lg shadow-2xs">
              📊
            </div>
            <h2 className="mt-4 text-sm font-semibold text-slate-900">
              Context Budget Engine
            </h2>
            <p className="mt-2 text-xs text-slate-500 leading-relaxed">
              Dynamically packs prioritized architectural decisions and conventions into token-bounded Markdown blocks for AI prompts.
            </p>
          </div>

          {/* Feature 4 */}
          <div className="rounded-2xl border border-slate-200/90 bg-white/90 p-6 shadow-xs backdrop-blur-xs hover:border-indigo-400/60 hover:shadow-md transition-all">
            <div className="h-10 w-10 rounded-xl bg-amber-50 border border-amber-100 text-amber-600 flex items-center justify-center font-bold text-lg shadow-2xs">
              🛡️
            </div>
            <h2 className="mt-4 text-sm font-semibold text-slate-900">
              Cryptographic Security
            </h2>
            <p className="mt-2 text-xs text-slate-500 leading-relaxed">
              SHA-256 Bearer tokens, granular scope authorization, and strict stdio isolation ensuring zero credential leaks.
            </p>
          </div>
        </div>

        {/* Memory Categories Banner */}
        <div className="mt-10 rounded-2xl border border-slate-200/90 bg-white/80 p-6 shadow-xs">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Unified Memory Taxonomy
          </h3>
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-left">
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-4">
              <span className="font-mono text-[11px] font-bold text-indigo-600">01 / DECISION</span>
              <p className="text-xs font-semibold text-slate-800 mt-1">Architectural Choices</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Rationale, tech stack, data models</p>
            </div>
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-4">
              <span className="font-mono text-[11px] font-bold text-purple-600">02 / REQUIREMENT</span>
              <p className="text-xs font-semibold text-slate-800 mt-1">Product Specs</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Functional scopes & acceptance criteria</p>
            </div>
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-4">
              <span className="font-mono text-[11px] font-bold text-emerald-600">03 / CONVENTION</span>
              <p className="text-xs font-semibold text-slate-800 mt-1">Code & Patterns</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Naming standards, design rules</p>
            </div>
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-4">
              <span className="font-mono text-[11px] font-bold text-amber-600">04 / BUG_SOLUTION</span>
              <p className="text-xs font-semibold text-slate-800 mt-1">Verified Fixes</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Root cause & permanent resolutions</p>
            </div>
          </div>
        </div>

        {/* Creator Attribution Spotlight */}
        <div className="mt-10 rounded-2xl border border-indigo-100 bg-linear-to-r from-indigo-50/80 via-white to-purple-50/80 p-6 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <span className="text-[10px] font-mono font-bold tracking-wider uppercase text-indigo-600">
              Project Leadership & Architecture
            </span>
            <h3 className="text-base font-bold text-slate-900 mt-0.5">
              Architected & Developed by PSG Praveen
            </h3>
            <p className="text-xs text-slate-600 mt-1 max-w-xl">
              Engineered with Next.js 16, React 19, TypeScript, PostgreSQL, Prisma ORM, and Model Context Protocol. Built for cross-agent multi-session continuity.
            </p>
          </div>
          <a
            href="https://github.com/psgpraveen"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-indigo-600 transition shadow-xs shrink-0"
          >
            <span>Follow @psgpraveen</span>
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
              <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
            </svg>
          </a>
        </div>
      </section>

      <Footer />
    </div>
  );
}
