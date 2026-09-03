import Link from "next/link";
import type { IntegrationDefinition } from "@/lib/integrations/types";

interface IntegrationCardProps {
  integration: IntegrationDefinition;
  isConnected?: boolean;
}

export function IntegrationCard({ integration, isConnected }: IntegrationCardProps) {
  const isAvailable = integration.status === "available";

  return (
    <div className="flex flex-col justify-between rounded-xl border border-zinc-200 bg-white p-5 shadow-xs transition hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700">
      <div>
        {/* Top Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 font-mono text-sm font-bold text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
              {integration.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                {integration.name}
              </h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                  {integration.category}
                </span>
                <span className="text-zinc-300 dark:text-zinc-700">&bull;</span>
                <span className="rounded bg-zinc-100 px-1.5 py-0.2 font-mono text-[10px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                  {integration.installationType.toUpperCase()}
                </span>
              </div>
            </div>
          </div>

          <div>
            {isConnected ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Connected
              </span>
            ) : isAvailable ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 dark:bg-blue-950/40 dark:text-blue-400">
                Available
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                Coming Soon
              </span>
            )}
          </div>
        </div>

        {/* Tagline & Description */}
        <p className="mt-3 text-xs font-medium text-zinc-700 dark:text-zinc-300">
          {integration.tagline}
        </p>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed line-clamp-2">
          {integration.description}
        </p>

        {/* Feature bullets */}
        <ul className="mt-4 space-y-1 text-[11px] text-zinc-600 dark:text-zinc-400">
          {integration.features.slice(0, 3).map((feat, i) => (
            <li key={i} className="flex items-center gap-1.5">
              <span className="text-emerald-500 font-bold">&check;</span>
              <span className="truncate">{feat}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Action Footer */}
      <div className="mt-5 pt-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
        <Link
          href={`/integrations/${integration.id}`}
          className="text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          View Details
        </Link>

        {isAvailable ? (
          <Link
            href={integration.setupRoute || `/integrations/${integration.id}`}
            className="rounded bg-zinc-900 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition"
          >
            {isConnected ? "Manage Setup" : "Setup Integration"}
          </Link>
        ) : (
          <button
            disabled
            className="rounded border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-400 dark:border-zinc-800 dark:text-zinc-600 cursor-not-allowed"
          >
            In Roadmap
          </button>
        )}
      </div>
    </div>
  );
}
