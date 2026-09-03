import Link from "next/link";

export function Navbar() {
  return (
    <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-6">
          <Link
            href="/projects"
            className="flex items-center gap-2 font-mono text-base font-bold tracking-tight text-zinc-900 hover:opacity-90 dark:text-zinc-50"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded bg-zinc-900 text-xs font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900">
              M
            </span>
            <span>AiMemorySync</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm font-medium">
            <Link
              href="/projects"
              className="text-zinc-600 transition-colors hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
            >
              Projects
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400" />
            Active
          </span>
        </div>
      </div>
    </header>
  );
}
