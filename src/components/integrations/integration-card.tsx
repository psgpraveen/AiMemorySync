import Link from "next/link";
import type { IntegrationDefinition } from "@/lib/integrations/types";

interface IntegrationCardProps {
  integration: IntegrationDefinition;
  isConnected?: boolean;
}

export function IntegrationCard({ integration, isConnected }: IntegrationCardProps) {
  const isAvailable = integration.status === "available";

  return (
    <div className="flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs transition-all hover:border-indigo-400/80 hover:shadow-md hover:-translate-y-0.5">
      <div>
        {/* Top Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 border border-slate-200 font-mono text-sm font-bold text-slate-800 shadow-2xs">
              {integration.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {integration.name}
              </h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[11px] font-medium text-slate-500">
                  {integration.category}
                </span>
                <span className="text-slate-300">&bull;</span>
                <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600">
                  {integration.installationType.toUpperCase()}
                </span>
              </div>
            </div>
          </div>

          <div>
            {isConnected ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Connected
              </span>
            ) : isAvailable ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 text-[11px] font-medium text-indigo-700">
                Available
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 border border-slate-200 px-2.5 py-0.5 text-[11px] font-medium text-slate-500">
                Coming Soon
              </span>
            )}
          </div>
        </div>

        {/* Tagline & Description */}
        <p className="mt-3 text-xs font-semibold text-slate-800">
          {integration.tagline}
        </p>
        <p className="mt-1 text-xs text-slate-500 leading-relaxed line-clamp-2">
          {integration.description}
        </p>

        {/* Feature bullets */}
        <ul className="mt-4 space-y-1.5 text-[11px] text-slate-600">
          {integration.features.slice(0, 3).map((feat, i) => (
            <li key={i} className="flex items-center gap-1.5">
              <span className="text-emerald-600 font-bold">✓</span>
              <span className="truncate">{feat}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Action Footer */}
      <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
        <Link
          href={`/integrations/${integration.id}`}
          className="text-xs font-semibold text-slate-600 hover:text-indigo-600 transition-colors"
        >
          View Details &rarr;
        </Link>

        {isAvailable ? (
          <Link
            href={integration.setupRoute || `/integrations/${integration.id}`}
            className="rounded-xl bg-linear-to-r from-indigo-600 to-violet-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:from-indigo-500 hover:to-violet-500 transition-all hover:scale-[1.02]"
          >
            {isConnected ? "Manage Setup" : "Setup Integration"}
          </Link>
        ) : (
          <button
            disabled
            className="rounded-xl border border-slate-200 px-3.5 py-1.5 text-xs font-medium text-slate-400 cursor-not-allowed bg-slate-50"
          >
            In Roadmap
          </button>
        )}
      </div>
    </div>
  );
}
