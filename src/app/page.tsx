import Link from "next/link";
import { Navbar } from "@/components/shared/navbar";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950">
      <Navbar />

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center px-4 py-16 sm:px-6">
        <div className="rounded-xl border border-zinc-200 bg-white p-8 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 sm:p-12">
          <div className="inline-flex items-center gap-2 rounded-md bg-zinc-100 px-2.5 py-1 text-xs font-mono font-medium text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
            Phase 4A &bull; Developer Tooling
          </div>

          <h1 className="mt-4 text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-4xl">
            AiMemorySync
          </h1>

          <p className="mt-3 text-base text-zinc-600 dark:text-zinc-400">
            Persistent, deterministic AI memory and context synchronization.
            Capture architectural decisions, product requirements, conventions,
            and bug solutions in one centralized, project-scoped repository.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link
              href="/projects"
              className="inline-flex items-center gap-2 rounded-md bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white shadow-xs hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              <span>Open Projects Dashboard</span>
              <span aria-hidden="true">&rarr;</span>
            </Link>
          </div>

          <div className="mt-12 grid grid-cols-2 gap-4 border-t border-zinc-100 pt-8 dark:border-zinc-800 sm:grid-cols-4">
            <div>
              <p className="text-xs font-medium text-zinc-400 dark:text-zinc-500">
                Category 1
              </p>
              <p className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Decisions
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-400 dark:text-zinc-500">
                Category 2
              </p>
              <p className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Requirements
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-400 dark:text-zinc-500">
                Category 3
              </p>
              <p className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Conventions
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-400 dark:text-zinc-500">
                Category 4
              </p>
              <p className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Bug Solutions
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
