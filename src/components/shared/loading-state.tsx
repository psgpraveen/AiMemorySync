interface LoadingStateProps {
  message?: string;
}

export function LoadingState({ message = "Loading..." }: LoadingStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-800 dark:border-zinc-700 dark:border-t-zinc-200" />
      <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">{message}</p>
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="h-5 w-1/3 rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="mt-2 h-4 w-1/4 rounded bg-zinc-100 dark:bg-zinc-800/60" />
      <div className="mt-4 h-4 w-full rounded bg-zinc-100 dark:bg-zinc-800/60" />
      <div className="mt-2 h-4 w-2/3 rounded bg-zinc-100 dark:bg-zinc-800/60" />
    </div>
  );
}
