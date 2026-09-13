"use client";

import { useState } from "react";
import type { Memory, MemoryPriority, MemoryType } from "@prisma/client";
import { useMemories } from "@/contexts";

interface MemoryCardProps {
  memory: Memory;
  onEdit: (memory: Memory) => void;
  onUpdated: (memory: Memory) => void;
}

const TYPE_LABELS: Record<MemoryType, string> = {
  DECISION: "Decision",
  REQUIREMENT: "Requirement",
  CONVENTION: "Convention",
  BUG_SOLUTION: "Bug Solution",
};

const PRIORITY_STYLES: Record<MemoryPriority, { label: string; class: string }> =
  {
    CRITICAL: {
      label: "Critical",
      class: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400",
    },
    HIGH: {
      label: "High",
      class:
        "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
    },
    NORMAL: {
      label: "Normal",
      class: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
    },
    LOW: {
      label: "Low",
      class: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
    },
  };

export function MemoryCard({ memory, onEdit, onUpdated }: MemoryCardProps) {
  const { deprecateMemory, archiveMemory } = useMemories();
  const [acting, setActing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const formattedDate = new Date(memory.updatedAt).toLocaleDateString(
    undefined,
    {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  );

  async function handleDeprecate() {
    if (acting) return;
    setActing(true);
    setActionError(null);
    try {
      const updated = await deprecateMemory(memory.id);
      onUpdated(updated);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Failed to deprecate memory");
    } finally {
      setActing(false);
    }
  }

  async function handleArchive() {
    if (acting) return;
    if (!window.confirm("Are you sure you want to archive this memory? It will no longer be included in active context.")) {
      return;
    }
    setActing(true);
    setActionError(null);
    try {
      const updated = await archiveMemory(memory.id);
      onUpdated(updated);
    } catch (err: unknown) {
      setActionError(
        err instanceof Error ? err.message : "Failed to archive memory"
      );
    } finally {
      setActing(false);
    }
  }

  const priorityMeta = PRIORITY_STYLES[memory.priority];

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      {actionError && (
        <div className="mb-3 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-600 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-400">
          {actionError}
        </div>
      )}

      {/* Badges & Status */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {/* Type Badge */}
          <span className="rounded border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[11px] font-medium text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
            {TYPE_LABELS[memory.type]}
          </span>

          {/* Priority Badge */}
          <span
            className={`rounded px-2 py-0.5 text-[11px] font-medium ${priorityMeta.class}`}
          >
            {priorityMeta.label}
          </span>

          {/* Scope Badge */}
          <span
            className={`rounded border px-2 py-0.5 text-[11px] font-medium ${
              memory.projectId === null
                ? "border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-800/60 dark:bg-purple-950/40 dark:text-purple-300"
                : "border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400"
            }`}
          >
            {memory.projectId === null ? "Tenant / Personal" : "Project"}
          </span>

          {/* Status Badge */}
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
              memory.status === "ACTIVE"
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
                : memory.status === "DEPRECATED"
                ? "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400"
                : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
            }`}
          >
            {memory.status}
          </span>
        </div>

        <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
          Updated {formattedDate}
        </span>
      </div>

      {/* Title */}
      <h4 className="mt-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        {memory.title}
      </h4>

      {/* Content */}
      <p className="mt-2 whitespace-pre-wrap text-xs text-zinc-600 dark:text-zinc-400">
        {memory.content}
      </p>

      {/* Actions */}
      <div className="mt-4 flex items-center justify-end gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800/80">
        <button
          type="button"
          onClick={() => onEdit(memory)}
          disabled={acting}
          className="rounded px-2.5 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
        >
          Edit
        </button>

        {memory.status === "ACTIVE" && (
          <button
            type="button"
            onClick={handleDeprecate}
            disabled={acting}
            className="rounded px-2.5 py-1 text-xs font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-50 dark:text-amber-400 dark:hover:bg-amber-950/30"
          >
            {acting ? "..." : "Deprecate"}
          </button>
        )}

        {memory.status !== "ARCHIVED" && (
          <button
            type="button"
            onClick={handleArchive}
            disabled={acting}
            className="rounded px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-950/30"
          >
            {acting ? "..." : "Archive"}
          </button>
        )}
      </div>
    </div>
  );
}
