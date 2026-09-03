interface ErrorStateProps {
  title?: string;
  message: string;
  code?: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = "An error occurred",
  message,
  code,
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-left dark:border-red-900/50 dark:bg-red-950/20">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-red-800 dark:text-red-300">
            {title}
          </h3>
          <p className="mt-1 text-sm text-red-700 dark:text-red-400">
            {message}
          </p>
          {code && (
            <p className="mt-1 font-mono text-xs text-red-600 dark:text-red-500">
              Code: {code}
            </p>
          )}
          {code === "UNAUTHORIZED" && (
            <div className="mt-3 flex items-center gap-3">
              <a
                href="/login"
                className="inline-flex items-center gap-1.5 rounded bg-red-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-900 transition"
              >
                Sign In with New API Key &rarr;
              </a>
              <span className="text-xs text-red-700 dark:text-red-300">
                or run <code className="rounded bg-red-100 px-1 py-0.5 font-mono dark:bg-red-950">npm run key:generate</code>
              </span>
            </div>
          )}
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            className="shrink-0 rounded border border-red-300 bg-white px-3 py-1 text-xs font-medium text-red-800 hover:bg-red-50 dark:border-red-800 dark:bg-zinc-900 dark:text-red-300 dark:hover:bg-zinc-800"
          >
            Try Again
          </button>
        )}
      </div>
    </div>
  );
}
